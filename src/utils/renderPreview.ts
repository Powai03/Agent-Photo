import type { GradingWheel, LightroomSettings, MixerColor } from "@/utils/types";

const LEVELS = 256;
const GAMMA = 2.2;
const HUE_HALF_WIDTH = 40;
const HUE_CENTERS: Record<MixerColor, number> = {
  rouge: 0,
  orange: 30,
  jaune: 58,
  vert: 115,
  aqua: 180,
  bleu: 225,
  violet: 272,
  magenta: 315,
};

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));
const bump = (value: number, center: number, width: number): number =>
  Math.max(0, 1 - ((value - center) / width) ** 2);

/** Courbe de tonalité complète (exposition, zones, contraste, courbe, point noir) sur 256 niveaux. */
const buildToneLut = (settings: LightroomSettings): Float32Array => {
  const { basic, toneCurve } = settings;
  const exposureGain = 2 ** basic.exposure;
  const contrast = (basic.contrast + basic.dehaze * 0.5 + basic.clarity * 0.3) / 100;
  const fade = toneCurve.fade / (LEVELS - 1);
  const lut = new Float32Array(LEVELS);

  for (let level = 0; level < LEVELS; level += 1) {
    let value = level / (LEVELS - 1);
    value = Math.min(1, value ** GAMMA * exposureGain) ** (1 / GAMMA);
    value +=
      (basic.shadows / 100) * 0.25 * (1 - value) ** 2 * Math.min(1, value * 4) +
      (basic.highlights / 100) * 0.25 * value ** 2 * Math.min(1, (1 - value) * 4) +
      (basic.blacks / 100) * 0.12 * (1 - value) ** 4 +
      (basic.whites / 100) * 0.12 * value ** 4;
    value +=
      ((toneCurve.lights * bump(value, 0.7, 0.3) +
        toneCurve.darks * bump(value, 0.3, 0.3) +
        toneCurve.highlights * bump(value, 0.9, 0.15) +
        toneCurve.shadows * bump(value, 0.1, 0.15)) /
        100) *
      0.15;
    value = clamp01(value);
    value += contrast * 0.6 * (value - 0.5) * 4 * value * (1 - value);
    lut[level] = clamp01(fade + value * (1 - fade));
  }
  return lut;
};

const hueToChannel = (p: number, q: number, hueTurn: number): number => {
  const turn = (hueTurn + 1) % 1;
  if (turn < 1 / 6) return p + (q - p) * 6 * turn;
  if (turn < 1 / 2) return q;
  if (turn < 2 / 3) return p + (q - p) * (2 / 3 - turn) * 6;
  return p;
};

const hslToRgb = (hue: number, saturation: number, lightness: number): [number, number, number] => {
  if (saturation === 0) return [lightness, lightness, lightness];
  const q =
    lightness < 0.5 ? lightness * (1 + saturation) : lightness + saturation - lightness * saturation;
  const p = 2 * lightness - q;
  const hueTurn = hue / 360;
  return [hueToChannel(p, q, hueTurn + 1 / 3), hueToChannel(p, q, hueTurn), hueToChannel(p, q, hueTurn - 1 / 3)];
};

interface GradingTint {
  red: number;
  green: number;
  blue: number;
  luminance: number;
}

const toGradingTint = (wheel: GradingWheel): GradingTint => {
  const [red, green, blue] = hslToRgb(wheel.hue, 1, 0.5);
  const strength = (wheel.saturation / 100) * 0.35;
  return {
    red: (red - 0.5) * strength,
    green: (green - 0.5) * strength,
    blue: (blue - 0.5) * strength,
    luminance: (wheel.luminance / 100) * 0.2,
  };
};

/**
 * Applique une approximation des réglages Lightroom à l'image. Les masques, la netteté et la
 * réduction du bruit ne sont pas simulés.
 */
export const renderPreview = (source: ImageData, settings: LightroomSettings): ImageData => {
  const { basic, colorMixer, colorGrading, effects } = settings;
  const { width, height } = source;
  const input = source.data;
  const output = new Uint8ClampedArray(input.length);
  const toneLut = buildToneLut(settings);

  const redGain = 1 + basic.temp * 0.003;
  const blueGain = 1 - basic.temp * 0.003;
  const greenGain = 1 - basic.tint * 0.002;
  const vibrance = basic.vibrance / 100;
  const saturationGain = 1 + (basic.saturation + basic.dehaze * 0.3) / 100;
  const mixerEntries = colorMixer.map((entry) => ({
    center: HUE_CENTERS[entry.color],
    hueShift: (entry.hue / 100) * 30,
    saturationGain: entry.saturation / 100,
    luminanceShift: (entry.luminance / 100) * 0.25,
  }));
  const shadowsTint = toGradingTint(colorGrading.shadows);
  const midtonesTint = toGradingTint(colorGrading.midtones);
  const highlightsTint = toGradingTint(colorGrading.highlights);
  const vignette = (effects.vignette / 100) * 0.7;
  const grain = (effects.grainAmount / 100) * 0.12;
  const centerX = width / 2;
  const centerY = height / 2;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      let red = toneLut[Math.min(LEVELS - 1, Math.round(input[offset] * redGain))];
      let green = toneLut[Math.min(LEVELS - 1, Math.round(input[offset + 1] * greenGain))];
      let blue = toneLut[Math.min(LEVELS - 1, Math.round(input[offset + 2] * blueGain))];

      const max = Math.max(red, green, blue);
      const min = Math.min(red, green, blue);
      const chroma = max - min;
      let lightness = (max + min) / 2;
      let saturation = chroma === 0 ? 0 : chroma / (1 - Math.abs(2 * lightness - 1) || 1);
      let hue = 0;
      if (chroma > 0) {
        if (max === red) hue = (((green - blue) / chroma) % 6) * 60;
        else if (max === green) hue = ((blue - red) / chroma + 2) * 60;
        else hue = ((red - green) / chroma + 4) * 60;
        if (hue < 0) hue += 360;
      }

      // Mélangeur : chaque couleur agit sur les teintes voisines, proportionnellement à leur saturation.
      const colorfulness = Math.min(1, saturation * 4);
      let hueShift = 0;
      let mixerSaturation = 0;
      let mixerLuminance = 0;
      for (const entry of mixerEntries) {
        const rawDistance = Math.abs(hue - entry.center);
        const distance = Math.min(rawDistance, 360 - rawDistance);
        if (distance < HUE_HALF_WIDTH) {
          const weight = (1 - distance / HUE_HALF_WIDTH) * colorfulness;
          hueShift += entry.hueShift * weight;
          mixerSaturation += entry.saturationGain * weight;
          mixerLuminance += entry.luminanceShift * weight;
        }
      }

      if (settings.isMonochrome) {
        const grey = clamp01(0.2126 * red + 0.7152 * green + 0.0722 * blue + mixerLuminance);
        red = grey;
        green = grey;
        blue = grey;
        lightness = grey;
      } else {
        hue = (hue + hueShift + 360) % 360;
        saturation *= 1 + mixerSaturation;
        saturation *= 1 + vibrance * (1 - saturation);
        saturation = clamp01(saturation * saturationGain);
        lightness = clamp01(lightness + mixerLuminance);
        [red, green, blue] = hslToRgb(hue, saturation, lightness);
      }

      const shadowsWeight = (1 - lightness) ** 2;
      const highlightsWeight = lightness ** 2;
      const midtonesWeight = 4 * lightness * (1 - lightness) * 0.6;
      const luminanceShift =
        shadowsTint.luminance * shadowsWeight +
        midtonesTint.luminance * midtonesWeight +
        highlightsTint.luminance * highlightsWeight;
      red +=
        shadowsTint.red * shadowsWeight + midtonesTint.red * midtonesWeight + highlightsTint.red * highlightsWeight + luminanceShift;
      green +=
        shadowsTint.green * shadowsWeight + midtonesTint.green * midtonesWeight + highlightsTint.green * highlightsWeight + luminanceShift;
      blue +=
        shadowsTint.blue * shadowsWeight + midtonesTint.blue * midtonesWeight + highlightsTint.blue * highlightsWeight + luminanceShift;

      const radialDistance = (((x - centerX) / centerX) ** 2 + ((y - centerY) / centerY) ** 2) / 2;
      const vignetteGain = 1 + vignette * radialDistance ** 1.2;
      const grainOffset = grain === 0 ? 0 : (Math.random() - 0.5) * grain;

      output[offset] = (red * vignetteGain + grainOffset) * 255;
      output[offset + 1] = (green * vignetteGain + grainOffset) * 255;
      output[offset + 2] = (blue * vignetteGain + grainOffset) * 255;
      output[offset + 3] = 255;
    }
  }

  return new ImageData(output, width, height);
};
