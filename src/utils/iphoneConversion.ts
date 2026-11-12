import { computeFilterEffect, describeFilter } from "@/utils/iphoneFilters";
import type { LookDefinition } from "@/utils/looks";
import type { GradingWheel, IphoneSettings, LightroomSettings } from "@/utils/types";

const WARM_HUE = 40;
const MAGENTA_HUE = 300;
const GRADING_WARMTH_GAIN = 60;
const GRADING_TINT_GAIN = 40;
const IPHONE_UNITS_PER_STOP = 35;

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

/** Projette une roue de color grading sur un axe de teinte (chaud/froid ou magenta/vert). */
const projectWheel = (wheel: GradingWheel, axisHue: number): number =>
  (wheel.saturation / 100) * Math.cos(toRadians(wheel.hue - axisHue));

const projectGrading = (grading: LightroomSettings["colorGrading"], axisHue: number): number =>
  projectWheel(grading.highlights, axisHue) +
  projectWheel(grading.midtones, axisHue) +
  projectWheel(grading.shadows, axisHue) * 0.6;

/**
 * Traduit les réglages Lightroom en curseurs de l'app Photos pour viser la même image. La part du
 * rendu déjà apportée par le filtre est retranchée des curseurs : filtre et curseurs s'additionnent.
 * Les valeurs sont bornées ensuite par `clampIphone`.
 */
export const convertToIphone = (
  lightroom: LightroomSettings,
  fade: number,
  look: LookDefinition,
): IphoneSettings => {
  const { basic, toneCurve, colorGrading, effects, detail } = lightroom;
  const filterEffect = computeFilterEffect(look.iphoneFilter);

  return {
    filter: describeFilter(look.iphoneFilter),
    exposure: basic.exposure * IPHONE_UNITS_PER_STOP,
    brilliance: basic.shadows * 0.25 - basic.highlights * 0.15 + basic.clarity * 0.4,
    highlights: basic.highlights * 0.9 + basic.whites * 0.4 + toneCurve.highlights * 0.5,
    shadows: basic.shadows * 0.9 + toneCurve.shadows * 0.5,
    contrast:
      basic.contrast * 0.9 +
      (toneCurve.lights - toneCurve.darks) * 0.5 +
      basic.dehaze * 0.4 -
      filterEffect.contrast,
    brightness: (toneCurve.lights + toneCurve.darks) * 0.4,
    blackPoint: -basic.blacks * 0.8 - fade - filterEffect.blackPoint,
    saturation: (lightroom.isMonochrome ? -100 : basic.saturation) - filterEffect.saturation,
    vibrance: lightroom.isMonochrome ? 0 : basic.vibrance,
    warmth:
      basic.temp + projectGrading(colorGrading, WARM_HUE) * GRADING_WARMTH_GAIN - filterEffect.warmth,
    tint: basic.tint + projectGrading(colorGrading, MAGENTA_HUE) * GRADING_TINT_GAIN,
    sharpness: detail.sharpening * 0.4,
    definition: Math.max(0, basic.clarity * 0.9 + basic.texture * 0.5),
    noiseReduction: detail.noiseReduction,
    vignette: -effects.vignette * 1.2,
    tips: look.iphoneNote,
  };
};
