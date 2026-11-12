import { computeBaseCorrection } from "@/utils/baseCorrection";
import type { BaseCorrection } from "@/utils/baseCorrection";
import { clampIphone, clampLightroom } from "@/utils/clampSettings";
import { convertToIphone } from "@/utils/iphoneConversion";
import { AUTO_LOOK_COUNT, CURVE_KEYS, LOOKS, NATURAL_LOOK_ID, TONE_KEYS, findLook } from "@/utils/looks";
import type { CurveValues, LookDefinition, MixerShift, ToneValues } from "@/utils/looks";
import { LOOK_TRAIT_BONUSES } from "@/utils/lookTraitBonuses";
import { analyzePhoto } from "@/utils/photoAnalysis";
import { LIGHT_LABELS, MIXER_COLORS, SCENE_LABELS, TRAIT_LABELS } from "@/utils/types";
import type {
  Analysis,
  AnalysisResult,
  ExifSummary,
  GradingWheel,
  ImageFeatures,
  LightroomSettings,
  LookProposal,
  MixerColor,
  Recommendation,
  SceneType,
} from "@/utils/types";

export type Intensity = "subtle" | "balanced" | "strong";

export const INTENSITY_LABELS: Record<Intensity, string> = {
  subtle: "Subtil",
  balanced: "Équilibré",
  strong: "Marqué",
};

const INTENSITY_FACTORS: Record<Intensity, number> = { subtle: 0.6, balanced: 1, strong: 1.3 };
const CONTRAST_KEYS = ["contrast", "clarity", "blacks"] as const;
const HIGH_CONTRAST_STD_DEV = 68;
const HIGH_SATURATION_PCT = 45;
const MIN_COLOR_SHARE_PCT = 1;
const MAX_LOOKS_PER_FAMILY = 2;
const MAX_RECOMMENDATION_REASONS = 3;
const NOISY_ISO = 1600;
const MAX_STARS = 5;
const NEUTRAL_STARS = 3;
const NEUTRAL_WHEEL: GradingWheel = { hue: 0, saturation: 0, luminance: 0 };

export interface EngineOptions {
  sceneOverride: SceneType | null;
  intensity: Intensity;
  lookIds: string[];
}

interface AdaptedStyle {
  tone: Partial<ToneValues>;
  curve: Partial<CurveValues>;
  fade: number;
  mixer: Partial<Record<MixerColor, MixerShift>>;
  grainAmount: number;
  notes: string[];
}

interface LookEvaluation {
  look: LookDefinition;
  score: number;
  strengths: string[];
  cautions: string[];
}

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const scaleValues = <Key extends string>(
  values: Partial<Record<Key, number>>,
  factor: number,
): Partial<Record<Key, number>> => {
  const scaled: Partial<Record<Key, number>> = {};
  for (const key of Object.keys(values) as Key[]) {
    scaled[key] = (values[key] ?? 0) * factor;
  }
  return scaled;
};

/** Ajuste la signature d'un rendu à ce que la photo peut encaisser. */
const adaptStyle = (
  look: LookDefinition,
  features: ImageFeatures,
  analysis: Analysis,
  exif: ExifSummary | null,
  factor: number,
): AdaptedStyle => {
  const { style } = look;
  const notes: string[] = [];
  const tone = scaleValues(style.tone, factor);
  const curve = scaleValues(style.curve, factor);
  let grainAmount = style.grain[0] * factor;
  let mixer: Partial<Record<MixerColor, MixerShift>> = {};
  for (const color of MIXER_COLORS) {
    const shift = style.mixer[color];
    if (shift) mixer[color] = [shift[0] * factor, shift[1] * factor, shift[2] * factor];
  }

  if (features.luminanceStdDev > HIGH_CONTRAST_STD_DEV) {
    for (const key of CONTRAST_KEYS) tone[key] = (tone[key] ?? 0) * 0.6;
    curve.lights = (curve.lights ?? 0) * 0.6;
    curve.darks = (curve.darks ?? 0) * 0.6;
    notes.push("Contraste du rendu atténué : la photo est déjà contrastée.");
  }

  if (!style.isMonochrome && features.saturationMeanPct > HIGH_SATURATION_PCT) {
    tone.vibrance = Math.min(tone.vibrance ?? 0, (tone.vibrance ?? 0) * 0.5);
    tone.saturation = Math.min(tone.saturation ?? 0, (tone.saturation ?? 0) * 0.5);
    for (const shift of Object.values(mixer)) shift[1] = Math.min(shift[1], shift[1] * 0.5);
    notes.push("Gain de saturation réduit : les couleurs sont déjà vives.");
  }

  if (analysis.sceneType === "portrait") {
    tone.clarity = Math.min(tone.clarity ?? 0, 6);
    tone.texture = Math.min(tone.texture ?? 0, 2);
    if (!style.isMonochrome) {
      if (mixer.orange) mixer.orange[1] = clamp(mixer.orange[1], -10, 8);
      if (mixer.rouge) mixer.rouge[1] = clamp(mixer.rouge[1], -10, 10);
    }
    notes.push("Tons chair protégés : clarté, texture et saturation des orangés limitées.");
  }

  if (analysis.isNight) {
    tone.clarity = Math.min(tone.clarity ?? 0, 6);
    tone.dehaze = Math.min(tone.dehaze ?? 0, 5);
    if ((exif?.iso ?? NOISY_ISO) >= NOISY_ISO) grainAmount *= 0.5;
    notes.push("Clarté et grain retenus pour ne pas accentuer le bruit de nuit.");
  }

  if (!style.isMonochrome) {
    const presentEntries = Object.entries(mixer).filter(
      ([color]) => features.colorSharesPct[color as MixerColor] >= MIN_COLOR_SHARE_PCT,
    );
    if (presentEntries.length < Object.keys(mixer).length) {
      notes.push("Mélangeur limité aux couleurs réellement présentes dans la photo.");
    }
    mixer = Object.fromEntries(presentEntries);
  }

  return { tone, curve, fade: style.fade * factor, mixer, grainAmount, notes };
};

const scaleWheel = (wheel: GradingWheel | undefined, factor: number): GradingWheel =>
  wheel ? { ...wheel, saturation: wheel.saturation * factor } : NEUTRAL_WHEEL;

/** Additionne la signature du rendu et les retouches de couleur dictées par le contenu. */
const mergeMixers = (
  styleMixer: Partial<Record<MixerColor, MixerShift>>,
  contentMixer: Partial<Record<MixerColor, MixerShift>>,
): LightroomSettings["colorMixer"] =>
  MIXER_COLORS.flatMap((color) => {
    const styleShift = styleMixer[color];
    const contentShift = contentMixer[color];
    if (!styleShift && !contentShift) return [];
    // Un rendu qui mise sur une couleur vive garde la main : on ne la désature pas par ailleurs.
    const styleSaturation = styleShift?.[1] ?? 0;
    const contentSaturation = contentShift?.[1] ?? 0;
    const keepsStyleSaturation = styleSaturation > 0 && contentSaturation < 0;
    return [
      {
        color,
        hue: (styleShift?.[0] ?? 0) + (contentShift?.[0] ?? 0),
        saturation: styleSaturation + (keepsStyleSaturation ? 0 : contentSaturation),
        luminance: (styleShift?.[2] ?? 0) + (contentShift?.[2] ?? 0),
      },
    ];
  });

const buildLightroom = (
  look: LookDefinition,
  base: BaseCorrection,
  adapted: AdaptedStyle,
  factor: number,
): LightroomSettings => {
  const { style } = look;
  const tone = Object.fromEntries(
    TONE_KEYS.map((key) => [key, base.tone[key] + (adapted.tone[key] ?? 0)]),
  ) as ToneValues;
  const curve = Object.fromEntries(
    CURVE_KEYS.map((key) => [key, base.curve[key] + (adapted.curve[key] ?? 0)]),
  ) as CurveValues;
  const fade = Math.round(adapted.fade);

  return {
    profile: look.lightroomProfile,
    isMonochrome: style.isMonochrome,
    basic: {
      temp: tone.temp,
      tint: tone.tint,
      exposure: tone.exposure,
      contrast: tone.contrast,
      highlights: tone.highlights,
      shadows: tone.shadows,
      whites: tone.whites,
      blacks: tone.blacks,
      texture: tone.texture,
      clarity: tone.clarity,
      dehaze: tone.dehaze,
      vibrance: style.isMonochrome ? 0 : tone.vibrance,
      saturation: style.isMonochrome ? 0 : tone.saturation,
    },
    toneCurve: {
      ...curve,
      fade,
      pointCurveNote:
        fade > 0 ? `Courbe à points : relever le point noir à ${fade} pour un rendu mat.` : "",
    },
    colorMixer: mergeMixers(adapted.mixer, style.isMonochrome ? {} : base.mixer),
    colorGrading: {
      shadows: scaleWheel(style.grading?.shadows, factor),
      midtones: scaleWheel(style.grading?.midtones, factor),
      highlights: scaleWheel(style.grading?.highlights, factor),
      blending: style.grading?.blending ?? 50,
      balance: style.grading?.balance ?? 0,
    },
    effects: {
      grainAmount: adapted.grainAmount,
      grainSize: adapted.grainAmount > 0 ? style.grain[1] : 0,
      grainRoughness: adapted.grainAmount > 0 ? style.grain[2] : 0,
      vignette: tone.vignette,
    },
    detail: { sharpening: base.sharpening, noiseReduction: base.noiseReduction },
    masks: base.masks,
  };
};

/** Note un rendu pour cette photo et retient les raisons, comme le ferait un photographe. */
const evaluateLook = (look: LookDefinition, analysis: Analysis): LookEvaluation => {
  const affinity = look.sceneAffinity;
  const sceneScore =
    analysis.isNight && analysis.sceneType !== "night"
      ? (affinity[analysis.sceneType] + affinity.night) / 2
      : affinity[analysis.sceneType];
  const lightBonus = look.lightBonus[analysis.light] ?? 0;
  const lightLabel = LIGHT_LABELS[analysis.light].toLowerCase();
  const matchedBonuses = (LOOK_TRAIT_BONUSES[look.id] ?? []).filter(([trait]) =>
    analysis.traits.includes(trait),
  );
  const describe = (bonuses: typeof matchedBonuses): string[] =>
    [...bonuses]
      .sort((first, second) => Math.abs(second[1]) - Math.abs(first[1]))
      .map(([trait, , reason]) => `${TRAIT_LABELS[trait]} : ${reason}.`);

  return {
    look,
    score: sceneScore + lightBonus + matchedBonuses.reduce((total, [, score]) => total + score, 0),
    strengths: [
      ...describe(matchedBonuses.filter(([, score]) => score > 0)),
      ...(lightBonus > 0 ? [`La lumière (${lightLabel}) met ce rendu en valeur.`] : []),
    ],
    cautions: [
      ...describe(matchedBonuses.filter(([, score]) => score < 0)),
      ...(lightBonus < 0 ? [`La lumière (${lightLabel}) dessert ce rendu.`] : []),
    ],
  };
};

const buildRecommendation = (rankedEvaluations: LookEvaluation[], analysis: Analysis): Recommendation => {
  const [best] = rankedEvaluations;
  const alternative = rankedEvaluations.find((evaluation) => evaluation.look.family !== best.look.family);
  const sceneLabel = SCENE_LABELS[analysis.sceneType].toLowerCase();

  return {
    lookId: best.look.id,
    name: best.look.name,
    reasons:
      best.strengths.length > 0
        ? best.strengths.slice(0, MAX_RECOMMENDATION_REASONS)
        : [`C'est le rendu le plus sûr pour une scène de type ${sceneLabel}.`],
    alternative: alternative
      ? {
          name: alternative.look.name,
          reason: alternative.strengths[0] ?? `Bon second choix pour une scène de type ${sceneLabel}.`,
        }
      : null,
  };
};

const selectEvaluations = (
  lookIds: string[],
  rankedEvaluations: LookEvaluation[],
  naturalEvaluation: LookEvaluation,
): LookEvaluation[] => {
  const allEvaluations = [naturalEvaluation, ...rankedEvaluations];
  const requestedEvaluations = lookIds
    .map((id) => allEvaluations.find((evaluation) => evaluation.look.id === id))
    .filter((evaluation) => evaluation !== undefined);
  if (requestedEvaluations.length > 0) return requestedEvaluations;

  // Le rendu conseillé en tête, puis la version naturelle comme point de comparaison.
  const selectedEvaluations = [rankedEvaluations[0], naturalEvaluation];
  const familyCounts = new Map([[rankedEvaluations[0].look.family, 1]]);
  for (const evaluation of rankedEvaluations.slice(1)) {
    const familyCount = familyCounts.get(evaluation.look.family) ?? 0;
    if (selectedEvaluations.length < AUTO_LOOK_COUNT && familyCount < MAX_LOOKS_PER_FAMILY) {
      selectedEvaluations.push(evaluation);
      familyCounts.set(evaluation.look.family, familyCount + 1);
    }
  }
  return selectedEvaluations;
};

export const buildAnalysisResult = (
  features: ImageFeatures,
  exif: ExifSummary | null,
  options: EngineOptions,
): AnalysisResult => {
  const analysis = analyzePhoto(features, exif, options.sceneOverride);
  const base = computeBaseCorrection(features, analysis, exif);
  const factor = INTENSITY_FACTORS[options.intensity];

  const naturalLook = findLook(NATURAL_LOOK_ID) ?? LOOKS[0];
  const rankedEvaluations = LOOKS.filter((look) => look.id !== NATURAL_LOOK_ID)
    .map((look) => evaluateLook(look, analysis))
    .sort((first, second) => second.score - first.score);
  const recommendation = buildRecommendation(rankedEvaluations, analysis);
  const bestScore = rankedEvaluations[0].score;

  const looks: LookProposal[] = selectEvaluations(
    options.lookIds,
    rankedEvaluations,
    evaluateLook(naturalLook, analysis),
  ).map(({ look, score, strengths, cautions }) => {
    const adapted = adaptStyle(look, features, analysis, exif, factor);
    const lightroom = buildLightroom(look, base, adapted, factor);
    return {
      lookId: look.id,
      name: look.name,
      family: look.family,
      description: look.signature,
      // Étoiles relatives au meilleur rendu : un point d'écart coûte une étoile.
      // La version naturelle n'est pas une DA : elle reste à une note neutre, comme point de comparaison.
      fitScore:
        look.id === NATURAL_LOOK_ID
          ? NEUTRAL_STARS
          : clamp(Math.round(MAX_STARS - (bestScore - score)), 1, MAX_STARS),
      isRecommended: look.id === recommendation.lookId,
      strengths,
      cautions,
      adaptations: [...adapted.notes, ...(look.style.isMonochrome ? [] : base.notes)],
      iphone: clampIphone(convertToIphone(lightroom, adapted.fade, look)),
      lightroom: clampLightroom(lightroom),
    };
  });

  return { analysis, recommendation, looks };
};
