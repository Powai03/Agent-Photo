import type { ImageFeatures, LightCondition, PhotoTrait, SceneType } from "@/utils/types";

/** Caractères de la photo qu'un photographe regarderait pour choisir un rendu. */
export const detectTraits = (
  features: ImageFeatures,
  sceneType: SceneType,
  light: LightCondition,
  isNight: boolean,
): PhotoTrait[] => {
  const checks: [PhotoTrait, boolean][] = [
    ["greyTones", features.neutralPct >= 55 || features.saturationMeanPct < 18],
    ["isolatedSubject", sceneType === "object" || features.centerEdgeRatio >= 1.5],
    ["skin", sceneType === "portrait"],
    ["lushGreens", features.greenPct >= 25],
    ["blueSky", features.skyTopPct >= 15],
    ["warmLight", !isNight && (light === "goldenHour" || features.warmthBias > 0.08)],
    ["coolLight", features.warmthBias < -0.06],
    ["highContrast", features.luminanceStdDev > 65],
    ["softLight", !isNight && features.luminanceStdDev < 45],
    ["nightLights", isNight && features.luminanceP95 > 150],
    ["vividColors", features.saturationMeanPct > 40],
    ["graphic", sceneType === "urban" || features.edgeDensity >= 16],
  ];
  return checks.filter(([, isPresent]) => isPresent).map(([trait]) => trait);
};
