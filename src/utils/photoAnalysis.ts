import { detectTraits } from "@/utils/photoTraits";
import type {
  Analysis,
  ExifSummary,
  ImageFeatures,
  LightCondition,
  SceneType,
} from "@/utils/types";

const NIGHT_MAX_EV = 4;
const INTERIOR_MAX_EV = 9.5;
const SUNNY_MIN_EV = 13.5;
const HARSH_SUN_MIN_EV = 14;
const TELEPHOTO_MIN_FOCAL = 60;
const TARGET_CONTRAST = 60;

/** Indice de lumination ramené à 100 ISO : ≈ 15 en plein soleil, < 4 de nuit. */
const computeExposureValue = (exif: ExifSummary | null): number | null => {
  if (!exif?.fNumber || !exif.exposureTime || !exif.iso) return null;
  return Math.log2(exif.fNumber ** 2 / exif.exposureTime) - Math.log2(exif.iso / 100);
};

const isFrontCamera = (exif: ExifSummary | null): boolean => /front/i.test(exif?.lensModel ?? "");

const detectLight = (
  features: ImageFeatures,
  exposureValue: number | null,
  isNight: boolean,
  capturedHour: number | null,
): LightCondition => {
  const isOutdoorLevel = exposureValue === null || exposureValue >= INTERIOR_MAX_EV;
  const isLowSunHour = capturedHour === null || capturedHour <= 9 || capturedHour >= 17;

  if (isNight) return "night";
  if (features.clippedHighlightsPct > 2 && features.luminanceP50 < 95) return "backlit";
  if (
    isOutdoorLevel &&
    isLowSunHour &&
    (exposureValue === null ? features.warmthBias > 0.12 : features.warmthBias > 0.08 && exposureValue < SUNNY_MIN_EV)
  ) {
    return "goldenHour";
  }
  if (
    (exposureValue === null || exposureValue >= HARSH_SUN_MIN_EV) &&
    features.luminanceStdDev > 68 &&
    (features.clippedHighlightsPct > 0.5 || features.clippedShadowsPct > 1)
  ) {
    return "harshSun";
  }
  if (
    (exposureValue !== null && exposureValue >= SUNNY_MIN_EV) ||
    (features.skyTopPct > 8 && features.saturationMeanPct > 25)
  ) {
    return "sunny";
  }
  if (exposureValue !== null) return exposureValue >= INTERIOR_MAX_EV ? "overcast" : "interior";
  if (features.topLuminance > 170 && features.topSaturationPct < 12 && features.luminanceStdDev < 55) {
    return "overcast";
  }
  return "unknown";
};

const detectScene = (
  features: ImageFeatures,
  exif: ExifSummary | null,
  light: LightCondition,
  isNight: boolean,
): SceneType => {
  const hasNature = features.skyTopPct >= 12 || features.greenPct >= 25;
  const isTelephoto = (exif?.focalLength35 ?? 0) > TELEPHOTO_MIN_FOCAL;
  const requiredCenterSkinPct = hasNature ? 25 : 12;

  if (
    (features.skinCenterPct >= requiredCenterSkinPct && features.skinPct >= 5) ||
    (isFrontCamera(exif) && features.skinPct >= 4)
  ) {
    return "portrait";
  }
  if (isNight) return "night";
  if (features.centerEdgeRatio >= 1.8 || (isTelephoto && features.centerEdgeRatio >= 1.3)) return "object";
  if (hasNature) return "landscape";
  if (light === "interior") return "interior";
  if (features.edgeDensity >= 12 && features.greenPct < 10 && features.saturationMeanPct < 30) return "urban";
  return "general";
};

const describeWeather = (light: LightCondition, isHazy: boolean): string => {
  if (light === "interior" || light === "night") return "Non applicable";
  if (isHazy) return "Brumeux / voilé";
  if (light === "sunny" || light === "harshSun") return "Ensoleillé";
  if (light === "goldenHour") return "Dégagé, soleil bas";
  if (light === "overcast") return "Couvert ou à l'ombre";
  return "Indéterminée";
};

const describeTimeOfDay = (capturedHour: number | null, isNight: boolean): string => {
  if (capturedHour === null) return isNight ? "Nuit (estimée)" : "Heure inconnue (pas d'EXIF)";
  if (capturedHour >= 5 && capturedHour < 8) return "Début de matinée";
  if (capturedHour >= 8 && capturedHour < 11) return "Matinée";
  if (capturedHour >= 11 && capturedHour < 14) return "Milieu de journée";
  if (capturedHour >= 14 && capturedHour < 17) return "Après-midi";
  if (capturedHour >= 17 && capturedHour < 20) return "Fin de journée";
  return "Soir / nuit";
};

const describeFocal = (exif: ExifSummary | null): string => {
  if (isFrontCamera(exif)) return "Caméra frontale";
  const focal = exif?.focalLength35;
  if (!focal) return "Focale inconnue (pas d'EXIF)";
  if (focal <= 16) return `Ultra grand-angle (${focal} mm)`;
  if (focal <= 30) return `Grand-angle (${focal} mm)`;
  if (focal <= TELEPHOTO_MIN_FOCAL) return `Standard (${focal} mm)`;
  return `Téléobjectif (${focal} mm)`;
};

const listMeasurements = (
  features: ImageFeatures,
  exif: ExifSummary | null,
  exposureValue: number | null,
): string[] => [
  `Luminance médiane ${features.luminanceP50}/255`,
  `Contraste (écart-type) ${features.luminanceStdDev}`,
  `Saturation moyenne ${features.saturationMeanPct} %`,
  `Ombres bouchées ${features.clippedShadowsPct} % · hautes lumières brûlées ${features.clippedHighlightsPct} %`,
  ...(exposureValue === null ? [] : [`Lumière de la scène : IL ${exposureValue.toFixed(1)}`]),
  ...(exif?.iso ? [`${exif.iso} ISO`] : []),
  ...(exif?.camera ? [exif.camera] : []),
];

const diagnoseFlatness = (features: ImageFeatures, light: LightCondition, isHazy: boolean): string[] => {
  const isNight = light === "night";
  const keepsItsCast = isNight || light === "goldenHour";
  const diagnosis = [
    features.luminanceStdDev < 50 &&
      `Contraste faible : les tons sont resserrés (écart-type ${features.luminanceStdDev}, visé ≈ ${TARGET_CONTRAST}).`,
    features.luminanceP5 > 28 &&
      `Noirs délavés : les zones les plus sombres ne descendent qu'à ${features.luminanceP5}/255.`,
    features.luminanceP95 < 205 &&
      `Blancs éteints : les zones claires plafonnent à ${features.luminanceP95}/255.`,
    features.saturationMeanPct < 24 && `Couleurs ternes : saturation moyenne de ${features.saturationMeanPct} %.`,
    !keepsItsCast && features.warmthBias > 0.05 && "Dominante chaude sur les zones neutres.",
    !keepsItsCast && features.warmthBias < -0.05 && "Dominante froide sur les zones neutres.",
    features.clippedHighlightsPct > 1.5 &&
      `Hautes lumières brûlées sur ${features.clippedHighlightsPct} % de l'image.`,
    !isNight && features.luminanceP50 < 85 && "Image sous-exposée.",
    features.luminanceP50 > 165 && "Image très claire, qui manque de densité.",
    isHazy && "Voile atmosphérique qui délave la scène.",
  ].filter((entry) => typeof entry === "string");

  return diagnosis.length > 0
    ? diagnosis
    : ["Tonalité déjà équilibrée : la retouche se concentre sur le caractère du rendu."];
};

export const analyzePhoto = (
  features: ImageFeatures,
  exif: ExifSummary | null,
  sceneOverride: SceneType | null,
): Analysis => {
  const exposureValue = computeExposureValue(exif);
  const isNight =
    exposureValue === null
      ? features.luminanceP50 < 45 && features.luminanceMean < 60
      : exposureValue < NIGHT_MAX_EV;
  const capturedHour = exif?.capturedHour ?? null;
  const light = detectLight(features, exposureValue, isNight, capturedHour);
  const isHazy =
    !isNight && light !== "interior" && features.luminanceStdDev < 38 && features.luminanceP5 > 45;
  const detectedSceneType = detectScene(features, exif, light, isNight);
  const sceneType = sceneOverride ?? detectedSceneType;

  return {
    sceneType,
    detectedSceneType,
    isNight,
    light,
    weather: describeWeather(light, isHazy),
    timeOfDay: describeTimeOfDay(capturedHour, isNight),
    focalType: describeFocal(exif),
    exposureValue,
    isHazy,
    traits: detectTraits(features, sceneType, light, isNight),
    dominantColors: features.dominantColors,
    measurements: listMeasurements(features, exif, exposureValue),
    flatnessDiagnosis: diagnoseFlatness(features, light, isHazy),
  };
};
