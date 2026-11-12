import type { CurveValues, MixerShift, ToneValues } from "@/utils/looks";
import type {
  Analysis,
  ExifSummary,
  ImageFeatures,
  MaskAdjustment,
  MixerColor,
  SettingRow,
} from "@/utils/types";

const TARGET_MEDIAN = 118;
const NIGHT_MIN_MEDIAN = 55;
const TARGET_CONTRAST = 60;
const TARGET_SATURATION_PCT = 30;
const LUMINANCE_MIDPOINT = 128;
const BRIGHT_SKY_LUMINANCE = 190;

export interface BaseCorrection {
  tone: ToneValues;
  curve: CurveValues;
  mixer: Partial<Record<MixerColor, MixerShift>>;
  notes: string[];
  masks: MaskAdjustment[];
  sharpening: number;
  noiseReduction: number;
}

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const exposureRow = (value: number): SettingRow => ({
  label: "Exposition",
  value,
  min: -4,
  max: 4,
  decimals: 2,
});
const bipolarRow = (label: string, value: number): SettingRow => ({ label, value, min: -100, max: 100 });

const computeExposure = (features: ImageFeatures, analysis: Analysis): number => {
  const targetMedian = analysis.isNight
    ? Math.max(features.luminanceP50, NIGHT_MIN_MEDIAN)
    : TARGET_MEDIAN;
  const exposure = clamp(((targetMedian - features.luminanceP50) / LUMINANCE_MIDPOINT) * 1.2, -0.7, 0.7);
  if (exposure <= 0) return exposure;
  // On n'éclaircit pas franchement une image dont les hautes lumières saturent déjà.
  if (analysis.light === "backlit") return Math.min(exposure, 0.3);
  return features.clippedHighlightsPct > 3 ? exposure * 0.5 : exposure;
};

const computeShadows = (features: ImageFeatures, analysis: Analysis): number => {
  if (analysis.light === "backlit") return 25;
  if (!analysis.isNight && features.clippedShadowsPct > 4) return clamp(features.clippedShadowsPct * 3, 0, 35);
  // L'iPhone débouche trop les ombres : on leur redonne du poids.
  return features.luminanceP5 > 35 ? -clamp((features.luminanceP5 - 35) * 0.5, 0, 15) : 0;
};

const computeBlacks = (features: ImageFeatures): number => {
  if (features.clippedShadowsPct > 6) return 8;
  return features.luminanceP5 > 20 ? -clamp((features.luminanceP5 - 12) * 0.5, 0, 22) : 0;
};

const computeTemp = (features: ImageFeatures, analysis: Analysis): number => {
  // La dominante fait partie de l'ambiance à la lumière dorée et de nuit : on n'y touche pas.
  if (analysis.light === "goldenHour" || analysis.isNight) return 0;
  const correctionShare = analysis.light === "interior" ? 60 : 40;
  return clamp(-features.warmthBias * correctionShare, -15, 15);
};

const computeNoiseReduction = (iso: number | null, isNight: boolean): number => {
  if (iso === null) return isNight ? 25 : 0;
  if (iso >= 3200) return 40;
  if (iso >= 1600) return 30;
  if (iso >= 800) return 20;
  return iso >= 400 ? 10 : 0;
};

/** Retouches de couleur dictées par le contenu : ciel, végétation, peau. */
const computeContentMixer = (
  analysis: Analysis,
): Pick<BaseCorrection, "mixer" | "notes"> => {
  const mixer: Partial<Record<MixerColor, MixerShift>> = {};
  const notes: string[] = [];

  if (analysis.traits.includes("blueSky")) {
    mixer.bleu = [0, 4, -20];
    notes.push("Ciel densifié : luminance des bleus abaissée pour lui donner de la profondeur.");
  }
  if (analysis.traits.includes("lushGreens")) {
    mixer.vert = [0, -15, -4];
    mixer.jaune = [0, -8, 0];
    notes.push("Verts et jaunes calmés : l'iPhone rend la végétation trop vive.");
  }
  if (analysis.sceneType === "portrait") {
    mixer.orange = [0, -8, 6];
    notes.push("Peau éclaircie par la luminance des orangés plutôt que par l'exposition.");
  }
  return { mixer, notes };
};

/** Retouches locales : ce qui distingue le plus un développement de photographe. */
const computeMasks = (features: ImageFeatures, analysis: Analysis): MaskAdjustment[] => {
  const masks: MaskAdjustment[] = [];
  const isPortrait = analysis.sceneType === "portrait";
  const hasSubject = isPortrait || analysis.traits.includes("isolatedSubject");

  if (!analysis.isNight && features.skyTopPct >= 12) {
    const isBrightSky = features.topLuminance >= BRIGHT_SKY_LUMINANCE;
    masks.push({
      name: "Ciel",
      howTo: "Masquage → Sélectionner le ciel. Redonne du modelé au ciel sans assombrir le reste.",
      rows: [
        exposureRow(isBrightSky ? -0.45 : -0.25),
        bipolarRow("Hautes lumières", isBrightSky ? -30 : -15),
        bipolarRow("Correction du voile", 10),
        bipolarRow("Saturation", 5),
      ],
    });
  }

  if (hasSubject) {
    // Plus le sujet est sombre par rapport au fond, plus on le relève.
    const subjectLift = clamp((features.borderLuminance - features.centerLuminance) / 100, 0, 0.3);
    masks.push({
      name: "Sujet",
      howTo: "Masquage → Sélectionner le sujet. Le sujet doit être la zone la plus lumineuse et la plus nette.",
      rows: [
        exposureRow(Math.round((0.15 + subjectLift) * 20) / 20),
        bipolarRow("Texture", isPortrait ? -5 : 10),
        bipolarRow("Clarté", isPortrait ? 0 : 6),
      ],
    });
    masks.push({
      name: "Arrière-plan",
      howTo: "Masquage → Sélectionner l'arrière-plan. Un fond plus sombre et plus terne pousse le regard vers le sujet.",
      rows: [
        exposureRow(-0.25),
        bipolarRow("Saturation", -8),
        bipolarRow("Clarté", -6),
      ],
    });
  } else if (analysis.sceneType === "landscape") {
    masks.push({
      name: "Premier plan",
      howTo: "Masquage → Dégradé linéaire, tiré du bas vers le milieu. Ancre l'image et guide l'œil vers le fond.",
      rows: [exposureRow(-0.2), bipolarRow("Contraste", 10), bipolarRow("Texture", 8)],
    });
  }

  if (analysis.traits.includes("nightLights")) {
    masks.push({
      name: "Sources lumineuses",
      howTo: "Masquage → Plage de luminance, limitée aux zones les plus claires. Récupère la matière des lumières.",
      rows: [bipolarRow("Hautes lumières", -30), bipolarRow("Correction du voile", 8)],
    });
  }
  return masks;
};

/** Correction propre à la photo, indépendante du rendu : elle neutralise l'aplat avant de styliser. */
export const computeBaseCorrection = (
  features: ImageFeatures,
  analysis: Analysis,
  exif: ExifSummary | null,
): BaseCorrection => {
  const isPortrait = analysis.sceneType === "portrait";
  const iso = exif?.iso ?? null;
  const nightFactor = analysis.isNight ? 0.5 : 1;
  const contrastDeficit = TARGET_CONTRAST - features.luminanceStdDev;
  // Le contraste manquant est réparti entre le curseur et une courbe en S, plus fine dans les transitions.
  const curveStrength = clamp(contrastDeficit * 0.25, 0, 10) * nightFactor;
  const vibrance = clamp((TARGET_SATURATION_PCT - features.saturationMeanPct) * 0.8, -8, 22);
  const hasSubject = isPortrait || analysis.traits.includes("isolatedSubject");

  return {
    tone: {
      exposure: computeExposure(features, analysis),
      contrast: clamp(contrastDeficit * 0.35, -8, 15) * nightFactor,
      highlights: -clamp(
        features.clippedHighlightsPct * 6 + Math.max(0, features.luminanceP95 - 235) * 1.2,
        0,
        60,
      ),
      shadows: computeShadows(features, analysis),
      whites: features.luminanceP95 < 205 ? clamp((215 - features.luminanceP95) * 0.5, 0, 30) : 0,
      blacks: computeBlacks(features),
      texture: 0,
      clarity:
        analysis.isNight || isPortrait ? 0 : clamp((12 - features.edgeDensity) * 0.8, 0, 10),
      dehaze: analysis.isHazy ? clamp((45 - features.luminanceStdDev) * 1.2, 0, 25) : 0,
      vibrance: isPortrait ? vibrance * 0.5 : vibrance,
      saturation: 0,
      temp: computeTemp(features, analysis),
      tint: clamp(features.tintBias * 40, -10, 10),
      vignette: hasSubject ? -6 : 0,
    },
    curve: { highlights: 0, lights: curveStrength, darks: -curveStrength, shadows: 0 },
    ...computeContentMixer(analysis),
    masks: computeMasks(features, analysis),
    sharpening: analysis.isNight || (iso ?? 0) >= 1600 ? 25 : 40,
    noiseReduction: computeNoiseReduction(iso, analysis.isNight),
  };
};
