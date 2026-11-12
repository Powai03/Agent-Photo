import type { GradingWheel, IphoneSettings, LightroomSettings } from "@/utils/types";

const EXPOSURE_STEPS_PER_STOP = 20;

const clampInt = (value: number, min: number, max: number): number =>
  Math.round(Math.min(max, Math.max(min, value)));

const bipolar = (value: number): number => clampInt(value, -100, 100);
const unipolar = (value: number): number => clampInt(value, 0, 100);

export const clampIphone = (settings: IphoneSettings): IphoneSettings => ({
  ...settings,
  exposure: bipolar(settings.exposure),
  brilliance: bipolar(settings.brilliance),
  highlights: bipolar(settings.highlights),
  shadows: bipolar(settings.shadows),
  contrast: bipolar(settings.contrast),
  brightness: bipolar(settings.brightness),
  blackPoint: bipolar(settings.blackPoint),
  saturation: bipolar(settings.saturation),
  vibrance: bipolar(settings.vibrance),
  warmth: bipolar(settings.warmth),
  tint: bipolar(settings.tint),
  sharpness: unipolar(settings.sharpness),
  definition: unipolar(settings.definition),
  noiseReduction: unipolar(settings.noiseReduction),
  vignette: bipolar(settings.vignette),
});

const clampWheel = (wheel: GradingWheel): GradingWheel => ({
  hue: clampInt(wheel.hue, 0, 360),
  saturation: unipolar(wheel.saturation),
  luminance: bipolar(wheel.luminance),
});

export const clampLightroom = (settings: LightroomSettings): LightroomSettings => {
  const { basic, toneCurve, colorGrading, effects, detail } = settings;
  return {
    ...settings,
    basic: {
      temp: bipolar(basic.temp),
      tint: bipolar(basic.tint),
      exposure:
        Math.round(Math.min(5, Math.max(-5, basic.exposure)) * EXPOSURE_STEPS_PER_STOP) /
        EXPOSURE_STEPS_PER_STOP,
      contrast: bipolar(basic.contrast),
      highlights: bipolar(basic.highlights),
      shadows: bipolar(basic.shadows),
      whites: bipolar(basic.whites),
      blacks: bipolar(basic.blacks),
      texture: bipolar(basic.texture),
      clarity: bipolar(basic.clarity),
      dehaze: bipolar(basic.dehaze),
      vibrance: bipolar(basic.vibrance),
      saturation: bipolar(basic.saturation),
    },
    toneCurve: {
      ...toneCurve,
      highlights: bipolar(toneCurve.highlights),
      lights: bipolar(toneCurve.lights),
      darks: bipolar(toneCurve.darks),
      shadows: bipolar(toneCurve.shadows),
    },
    colorMixer: settings.colorMixer.map((entry) => ({
      color: entry.color,
      hue: bipolar(entry.hue),
      saturation: bipolar(entry.saturation),
      luminance: bipolar(entry.luminance),
    })),
    colorGrading: {
      shadows: clampWheel(colorGrading.shadows),
      midtones: clampWheel(colorGrading.midtones),
      highlights: clampWheel(colorGrading.highlights),
      blending: unipolar(colorGrading.blending),
      balance: bipolar(colorGrading.balance),
    },
    effects: {
      grainAmount: unipolar(effects.grainAmount),
      grainSize: unipolar(effects.grainSize),
      grainRoughness: unipolar(effects.grainRoughness),
      vignette: bipolar(effects.vignette),
    },
    detail: {
      sharpening: clampInt(detail.sharpening, 0, 150),
      noiseReduction: unipolar(detail.noiseReduction),
    },
  };
};
