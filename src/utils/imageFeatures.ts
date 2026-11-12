import { MIXER_COLORS } from "@/utils/types";
import type { DominantColor, ImageFeatures, MixerColor } from "@/utils/types";

const LUMINANCE_LEVELS = 256;
const CLIPPED_SHADOWS_MAX_LEVEL = 4;
const CLIPPED_HIGHLIGHTS_MIN_LEVEL = 251;
const TOP_BAND_RATIO = 0.4;
const MIN_NEUTRAL_SHARE = 0.03;
const MIN_DOMINANT_SHARE_PCT = 4;
const MAX_DOMINANT_COLORS = 4;

/** Borne haute (exclue) de chaque couleur du mélangeur sur le cercle des teintes. */
const HUE_UPPER_BOUNDS: [number, MixerColor][] = [
  [15, "rouge"],
  [45, "orange"],
  [70, "jaune"],
  [165, "vert"],
  [200, "aqua"],
  [255, "bleu"],
  [290, "violet"],
  [345, "magenta"],
  [360, "rouge"],
];

const hueToColor = (hue: number): MixerColor =>
  (HUE_UPPER_BOUNDS.find(([upperBound]) => hue < upperBound) ?? HUE_UPPER_BOUNDS[0])[1];

const computeHue = (red: number, green: number, blue: number, max: number, min: number): number => {
  const chroma = max - min;
  if (chroma === 0) return 0;
  let sector: number;
  if (max === red) sector = ((green - blue) / chroma) % 6;
  else if (max === green) sector = (blue - red) / chroma + 2;
  else sector = (red - green) / chroma + 4;
  return (sector * 60 + 360) % 360;
};

const isSkinTone = (
  red: number,
  green: number,
  blue: number,
  hue: number,
  saturation: number,
  value: number,
): boolean =>
  red > 95 &&
  green > 40 &&
  blue > 20 &&
  red > green &&
  red > blue &&
  red - green > 15 &&
  (hue < 50 || hue > 340) &&
  saturation > 0.15 &&
  saturation < 0.7 &&
  value > 0.35;

const roundToTenth = (value: number): number => Math.round(value * 10) / 10;
const toPct = (count: number, total: number): number =>
  total === 0 ? 0 : roundToTenth((count / total) * 100);
const toHex = (channel: number): string => Math.round(channel).toString(16).padStart(2, "0");

interface ColorBin {
  count: number;
  red: number;
  green: number;
  blue: number;
}

/** Densité de détail (laplacien moyen de la luminance) au centre et sur les bords. */
const computeEdgeEnergy = (
  luminance: Float32Array,
  width: number,
  height: number,
): { overall: number; centerRatio: number } => {
  let centerSum = 0;
  let centerCount = 0;
  let borderSum = 0;
  let borderCount = 0;

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x;
      const laplacian = Math.abs(
        4 * luminance[index] -
          luminance[index - 1] -
          luminance[index + 1] -
          luminance[index - width] -
          luminance[index + width],
      );
      const isCenter = x > width * 0.25 && x < width * 0.75 && y > height * 0.25 && y < height * 0.75;
      if (isCenter) {
        centerSum += laplacian;
        centerCount += 1;
      } else {
        borderSum += laplacian;
        borderCount += 1;
      }
    }
  }

  const centerMean = centerCount === 0 ? 0 : centerSum / centerCount;
  const borderMean = borderCount === 0 ? 0 : borderSum / borderCount;
  const totalCount = centerCount + borderCount;
  return {
    overall: totalCount === 0 ? 0 : roundToTenth((centerSum + borderSum) / totalCount),
    centerRatio: borderMean === 0 ? 1 : roundToTenth(centerMean / borderMean),
  };
};

export const computeImageFeatures = (image: ImageData): ImageFeatures => {
  const { data: pixels, width, height } = image;
  const pixelCount = width * height;
  const topBandHeight = Math.round(height * TOP_BAND_RATIO);

  const histogram = new Array<number>(LUMINANCE_LEVELS).fill(0);
  const luminanceMap = new Float32Array(pixelCount);
  const colorBins = Object.fromEntries(
    MIXER_COLORS.map((color) => [color, { count: 0, red: 0, green: 0, blue: 0 }]),
  ) as Record<MixerColor, ColorBin>;

  let luminanceSum = 0;
  let luminanceSquareSum = 0;
  let saturationSum = 0;
  const globalRgb = [0, 0, 0];
  const neutralRgb = [0, 0, 0];
  let neutralCount = 0;
  let colorlessCount = 0;
  let centerLuminanceSum = 0;
  let skyTopCount = 0;
  let greenCount = 0;
  let skinCount = 0;
  let skinCenterCount = 0;
  let centerCount = 0;
  let topCount = 0;
  let topLuminanceSum = 0;
  let topSaturationSum = 0;

  for (let y = 0; y < height; y += 1) {
    const isTopBand = y < topBandHeight;
    const isCenterRow = y > height * 0.15 && y < height * 0.75;
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      const red = pixels[index * 4];
      const green = pixels[index * 4 + 1];
      const blue = pixels[index * 4 + 2];
      const max = Math.max(red, green, blue);
      const min = Math.min(red, green, blue);
      const value = max / 255;
      const saturation = max === 0 ? 0 : (max - min) / max;
      const hue = computeHue(red, green, blue, max, min);
      const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;

      luminanceMap[index] = luminance;
      histogram[Math.round(luminance)] += 1;
      luminanceSum += luminance;
      luminanceSquareSum += luminance * luminance;
      saturationSum += saturation;
      globalRgb[0] += red;
      globalRgb[1] += green;
      globalRgb[2] += blue;

      if (saturation < 0.15) colorlessCount += 1;
      if (saturation < 0.15 && value > 0.2 && value < 0.9) {
        neutralRgb[0] += red;
        neutralRgb[1] += green;
        neutralRgb[2] += blue;
        neutralCount += 1;
      }

      if (saturation > 0.2 && value > 0.15) {
        const bin = colorBins[hueToColor(hue)];
        bin.count += 1;
        bin.red += red;
        bin.green += green;
        bin.blue += blue;
        if (hue >= 65 && hue < 165) greenCount += 1;
      }

      if (isTopBand) {
        topCount += 1;
        topLuminanceSum += luminance;
        topSaturationSum += saturation;
        if (hue >= 190 && hue < 250 && saturation > 0.18 && value > 0.45) skyTopCount += 1;
      }

      const isCenter = isCenterRow && x > width * 0.25 && x < width * 0.75;
      if (isCenter) {
        centerCount += 1;
        centerLuminanceSum += luminance;
      }
      if (isSkinTone(red, green, blue, hue, saturation, value)) {
        skinCount += 1;
        if (isCenter) skinCenterCount += 1;
      }
    }
  }

  const percentile = (fraction: number): number => {
    const target = pixelCount * fraction;
    let cumulative = 0;
    for (let level = 0; level < LUMINANCE_LEVELS; level += 1) {
      cumulative += histogram[level];
      if (cumulative >= target) return level;
    }
    return LUMINANCE_LEVELS - 1;
  };
  const countLevels = (levels: number[]): number => levels.reduce((total, count) => total + count, 0);

  // Dominante : mesurée sur les zones neutres, sinon sur l'image entière avec moitié moins de poids.
  const hasNeutrals = neutralCount / pixelCount >= MIN_NEUTRAL_SHARE;
  const castRgb = hasNeutrals ? neutralRgb : globalRgb;
  const castCount = hasNeutrals ? neutralCount : pixelCount;
  const castWeight = hasNeutrals ? 1 : 0.5;
  const castRed = castRgb[0] / castCount;
  const castGreen = castRgb[1] / castCount;
  const castBlue = castRgb[2] / castCount;

  const colorSharesPct = Object.fromEntries(
    MIXER_COLORS.map((color) => [color, toPct(colorBins[color].count, pixelCount)]),
  ) as Record<MixerColor, number>;
  const dominantColors: DominantColor[] = MIXER_COLORS.filter(
    (color) => colorSharesPct[color] >= MIN_DOMINANT_SHARE_PCT,
  )
    .sort((first, second) => colorSharesPct[second] - colorSharesPct[first])
    .slice(0, MAX_DOMINANT_COLORS)
    .map((color) => {
      const bin = colorBins[color];
      return {
        name: color,
        hex: `#${toHex(bin.red / bin.count)}${toHex(bin.green / bin.count)}${toHex(bin.blue / bin.count)}`,
        sharePct: colorSharesPct[color],
      };
    });

  const mean = luminanceSum / pixelCount;
  const edgeEnergy = computeEdgeEnergy(luminanceMap, width, height);

  return {
    luminanceMean: roundToTenth(mean),
    luminanceP5: percentile(0.05),
    luminanceP50: percentile(0.5),
    luminanceP95: percentile(0.95),
    luminanceStdDev: roundToTenth(Math.sqrt(Math.max(0, luminanceSquareSum / pixelCount - mean * mean))),
    clippedShadowsPct: toPct(countLevels(histogram.slice(0, CLIPPED_SHADOWS_MAX_LEVEL + 1)), pixelCount),
    clippedHighlightsPct: toPct(countLevels(histogram.slice(CLIPPED_HIGHLIGHTS_MIN_LEVEL)), pixelCount),
    saturationMeanPct: toPct(saturationSum, pixelCount),
    warmthBias: ((castRed - castBlue) / 255) * castWeight,
    tintBias: ((castGreen - (castRed + castBlue) / 2) / 255) * castWeight,
    neutralPct: toPct(colorlessCount, pixelCount),
    centerLuminance: centerCount === 0 ? 0 : roundToTenth(centerLuminanceSum / centerCount),
    borderLuminance:
      pixelCount === centerCount
        ? 0
        : roundToTenth((luminanceSum - centerLuminanceSum) / (pixelCount - centerCount)),
    skyTopPct: toPct(skyTopCount, topCount),
    greenPct: toPct(greenCount, pixelCount),
    skinPct: toPct(skinCount, pixelCount),
    skinCenterPct: toPct(skinCenterCount, centerCount),
    topLuminance: topCount === 0 ? 0 : roundToTenth(topLuminanceSum / topCount),
    topSaturationPct: toPct(topSaturationSum, topCount),
    edgeDensity: edgeEnergy.overall,
    centerEdgeRatio: edgeEnergy.centerRatio,
    colorSharesPct,
    dominantColors,
  };
};
