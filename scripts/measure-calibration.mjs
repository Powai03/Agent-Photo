// Mesure les images déposées dans calibration/ et affiche les valeurs à reporter dans
// src/utils/iphoneFilters.ts et src/utils/iphoneConversion.ts.
// Usage : node scripts/measure-calibration.mjs
// `sharp` n'est pas une dépendance directe du projet : il est installé avec Next.js.
import { readdirSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { renderPreview } from "../src/utils/renderPreview.ts";

const CALIBRATION_DIR = "calibration";
const REFERENCE_FOLDER = "original-reexporte";
const TEST_VALUE = 50;
const IGNORED_FILES = [".gitkeep"];

// Disposition de la mire, identique à scripts/generate-calibration-chart.mjs.
const GREY_STEPS = 21;
const HUE_COUNT = 12;
const COLOR_ROW_COUNT = 6;
const MEMORY_COUNT = 12;
const RAMP_SAMPLES = 64;
const BANDS = { greySteps: [0, 0.15], greyRamp: [0.15, 0.25], colors: [0.25, 0.85], memory: [0.85, 1] };

const ADJUSTMENT_FOLDERS = {
  exposure: "exposition",
  highlights: "hautes-lumieres",
  shadows: "ombres",
  contrast: "contraste",
  brightness: "luminosite",
  blackPoint: "point-noir",
  saturation: "saturation",
  vibrance: "vibrance",
  warmth: "chaleur",
  tint: "teinte",
};
const COLOR_FILTERS = [
  "intense",
  "intense-chaud",
  "intense-froid",
  "spectaculaire",
  "spectaculaire-chaud",
  "spectaculaire-froid",
];
const MONO_FILTERS = ["mono", "noir"];
const TONE_SLIDERS = ["contrast", "blackPoint", "brightness"];
const RIDGE = 0.5;

// Réglage Lightroom du modèle d'aperçu comparé à chaque curseur de l'app Photos.
const LIGHTROOM_EQUIVALENTS = {
  contrast: { patches: "tone", apply: (settings, value) => (settings.basic.contrast = value) },
  highlights: { patches: "tone", apply: (settings, value) => (settings.basic.highlights = value) },
  shadows: { patches: "tone", apply: (settings, value) => (settings.basic.shadows = value) },
  blackPoint: { patches: "tone", apply: (settings, value) => (settings.basic.blacks = -value) },
  brightness: {
    patches: "tone",
    apply: (settings, value) => {
      settings.toneCurve.lights = value;
      settings.toneCurve.darks = value;
    },
  },
  saturation: { patches: "color", apply: (settings, value) => (settings.basic.saturation = value) },
  vibrance: { patches: "color", apply: (settings, value) => (settings.basic.vibrance = value) },
  warmth: { patches: "color", apply: (settings, value) => (settings.basic.temp = value) },
  tint: { patches: "color", apply: (settings, value) => (settings.basic.tint = value) },
};
const SEARCH_RANGE = 300;

// renderPreview attend l'ImageData du navigateur.
globalThis.ImageData = class {
  constructor(data, width, height) {
    Object.assign(this, { data, width, height });
  }
};

const average = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
const luminance = ([red, green, blue]) => 0.2126 * red + 0.7152 * green + 0.0722 * blue;
const srgbToLinear = (level) => {
  const value = level / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
};

const loadImage = async (path) => {
  // Les exports iPhone sont en Display P3 : conversion en sRGB pour comparer à la mire.
  const { data, info } = await sharp(path).toColourspace("srgb").removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height, channels: info.channels };
};

/** Moyenne sRGB de la moitié centrale d'une case, donnée en fractions de l'image. */
const measurePatch = (image, xStart, xEnd, yStart, yEnd) => {
  const xMargin = (xEnd - xStart) / 4;
  const yMargin = (yEnd - yStart) / 4;
  const left = Math.round((xStart + xMargin) * image.width);
  const right = Math.round((xEnd - xMargin) * image.width);
  const top = Math.round((yStart + yMargin) * image.height);
  const bottom = Math.round((yEnd - yMargin) * image.height);
  const sums = [0, 0, 0];
  for (let y = top; y < bottom; y += 1) {
    for (let x = left; x < right; x += 1) {
      const offset = (y * image.width + x) * image.channels;
      sums[0] += image.data[offset];
      sums[1] += image.data[offset + 1];
      sums[2] += image.data[offset + 2];
    }
  }
  return sums.map((sum) => sum / ((right - left) * (bottom - top)));
};

const measureRow = (image, count, yStart, yEnd) =>
  Array.from({ length: count }, (_, index) => measurePatch(image, index / count, (index + 1) / count, yStart, yEnd));

const measureChart = (image) => {
  const [colorsStart, colorsEnd] = BANDS.colors;
  const rowHeight = (colorsEnd - colorsStart) / COLOR_ROW_COUNT;
  return {
    grey: measureRow(image, GREY_STEPS, ...BANDS.greySteps),
    ramp: measureRow(image, RAMP_SAMPLES, ...BANDS.greyRamp),
    colors: Array.from({ length: COLOR_ROW_COUNT }, (_, row) =>
      measureRow(image, HUE_COUNT, colorsStart + rowHeight * row, colorsStart + rowHeight * (row + 1)),
    ),
    memory: measureRow(image, MEMORY_COUNT, ...BANDS.memory),
  };
};

const measureFolder = async (folder) => {
  const files = readdirSync(join(CALIBRATION_DIR, folder)).filter((file) => !IGNORED_FILES.includes(file));
  if (files.length !== 1) throw new Error(`${folder} : 1 image attendue, ${files.length} trouvée(s)`);
  return measureChart(await loadImage(join(CALIBRATION_DIR, folder, files[0])));
};

// Sélections de cases : gris hors noir et blanc purs, couleurs hors rangée saturée (qui écrête).
const greyLuminances = (chart) => [...chart.grey.slice(1, -1), ...chart.ramp.slice(4, -4)].map(luminance);
const coloredPatches = (chart) => [...chart.colors.slice(1).flat(), ...chart.memory];
const tonePatches = (chart) => [...chart.grey, ...chart.ramp];
const chromaOf = (chart) => average(coloredPatches(chart).map((patch) => Math.max(...patch) - Math.min(...patch)));
const warmthOf = (chart) =>
  average([...coloredPatches(chart), ...chart.grey.slice(2, -2)].map(([red, , blue]) => red - blue));

/** Moindres carrés régularisés, par équations normales et pivot de Gauss. */
const solveLeastSquares = (rows, targets) => {
  const size = rows[0].length;
  const system = Array.from({ length: size }, () => new Array(size + 1).fill(0));
  rows.forEach((row, rowIndex) => {
    for (let i = 0; i < size; i += 1) {
      system[i][size] += row[i] * targets[rowIndex];
      for (let j = 0; j < size; j += 1) system[i][j] += row[i] * row[j];
    }
  });
  for (let i = 0; i < size; i += 1) system[i][i] += RIDGE;
  for (let pivot = 0; pivot < size; pivot += 1) {
    let best = pivot;
    for (let row = pivot + 1; row < size; row += 1) {
      if (Math.abs(system[row][pivot]) > Math.abs(system[best][pivot])) best = row;
    }
    [system[pivot], system[best]] = [system[best], system[pivot]];
    for (let row = 0; row < size; row += 1) {
      if (row === pivot) continue;
      const factor = system[row][pivot] / system[pivot][pivot];
      for (let column = pivot; column <= size; column += 1) system[row][column] -= factor * system[pivot][column];
    }
  }
  return system.map((row, index) => row[size] / row[index]);
};

const charts = {};
for (const entry of readdirSync(CALIBRATION_DIR, { withFileTypes: true })) {
  if (entry.isDirectory()) charts[entry.name] = await measureFolder(entry.name);
}
const reference = charts[REFERENCE_FOLDER];
const adjustmentChart = (slider, sign) =>
  charts[`ajustement-${ADJUSTMENT_FOLDERS[slider]}-${sign > 0 ? "+" : "-"}${TEST_VALUE}`];
/** Variation d'une mesure par unité de curseur, du côté positif ou négatif. */
const unitResponse = (metric, slider, sign) =>
  (metric(adjustmentChart(slider, sign)) - metric(reference)) / (TEST_VALUE * sign);
const signedUnit = (metric, slider, delta) => unitResponse(metric, slider, delta >= 0 ? 1 : -1);

/** Exprime la courbe de gris d'un filtre en contraste, point noir et luminosité. */
const fitFilterTone = (chart) => {
  const referenceGreys = greyLuminances(reference);
  const filterGreys = greyLuminances(chart);
  const plus = TONE_SLIDERS.map((slider) => greyLuminances(adjustmentChart(slider, 1)));
  const minus = TONE_SLIDERS.map((slider) => greyLuminances(adjustmentChart(slider, -1)));
  const rows = referenceGreys.map((_, index) =>
    TONE_SLIDERS.map((_, slider) => (plus[slider][index] - minus[slider][index]) / (2 * TEST_VALUE)),
  );
  return solveLeastSquares(rows, referenceGreys.map((grey, index) => filterGreys[index] - grey));
};

const describeFilter = (filter, isMonochrome) => {
  const chart = charts[`filtre-${filter}-100`];
  const tone = fitFilterTone(chart);
  const parts = TONE_SLIDERS.map((slider, index) => `${slider} ${tone[index].toFixed(0)}`);
  if (!isMonochrome) {
    const toneChroma = TONE_SLIDERS.reduce(
      (sum, slider, index) => sum + tone[index] * signedUnit(chromaOf, slider, tone[index]),
      0,
    );
    const chromaDelta = chromaOf(chart) - chromaOf(reference) - toneChroma;
    const warmthDelta = warmthOf(chart) - warmthOf(reference);
    parts.push(
      `saturation ${(chromaDelta / signedUnit(chromaOf, "saturation", chromaDelta)).toFixed(0)}`,
      `warmth ${(warmthDelta / signedUnit(warmthOf, "warmth", warmthDelta)).toFixed(0)}`,
    );
  }
  return `${filter.padEnd(22)} ${parts.join(", ")}`;
};

const neutralSettings = () => {
  const wheel = () => ({ hue: 0, saturation: 0, luminance: 0 });
  return {
    isMonochrome: false,
    basic: {
      temp: 0, tint: 0, exposure: 0, contrast: 0, highlights: 0, shadows: 0, whites: 0,
      blacks: 0, texture: 0, clarity: 0, dehaze: 0, vibrance: 0, saturation: 0,
    },
    toneCurve: { highlights: 0, lights: 0, darks: 0, shadows: 0, fade: 0 },
    colorMixer: [],
    colorGrading: { shadows: wheel(), midtones: wheel(), highlights: wheel() },
    effects: { grainAmount: 0, vignette: 0 },
  };
};

const renderPatches = (patches, settings) => {
  const data = new Uint8ClampedArray(patches.length * 4);
  patches.forEach((patch, index) => data.set([...patch.map(Math.round), 255], index * 4));
  const output = renderPreview({ data, width: patches.length, height: 1 }, settings).data;
  return patches.map((_, index) => [output[index * 4], output[index * 4 + 1], output[index * 4 + 2]]);
};

const rmsError = (first, second) =>
  Math.sqrt(average(first.flatMap((patch, index) => patch.map((channel, c) => (channel - second[index][c]) ** 2))));

/** Valeur Lightroom du modèle d'aperçu la plus proche d'un curseur de l'app Photos à ±50. */
const fitLightroomEquivalent = (slider, sign) => {
  const { patches, apply } = LIGHTROOM_EQUIVALENTS[slider];
  const select = patches === "tone" ? tonePatches : coloredPatches;
  const source = select(reference);
  const target = select(adjustmentChart(slider, sign));
  let best = { value: 0, error: Infinity };
  for (let value = -SEARCH_RANGE; value <= SEARCH_RANGE; value += 1) {
    const settings = neutralSettings();
    apply(settings, value);
    const error = rmsError(renderPatches(source, settings), target);
    if (error < best.error) best = { value, error };
  }
  return { ...best, baseline: rmsError(source, target) };
};

console.log("Filtres à 100, en unités de curseurs (→ FILTER_EFFECTS)");
COLOR_FILTERS.forEach((filter) => console.log(" ", describeFilter(filter, false)));
MONO_FILTERS.forEach((filter) => console.log(" ", describeFilter(filter, true)));

console.log("\nExposition : stops pour ±50 (→ IPHONE_UNITS_PER_STOP)");
for (const sign of [1, -1]) {
  const adjusted = adjustmentChart("exposure", sign).grey.map(luminance);
  const stops = reference.grey
    .map(luminance)
    .map((level, index) => [level, adjusted[index]])
    .filter(([level, result]) => level > 20 && result > 3 && result < 250)
    .map(([level, result]) => Math.log2(srgbToLinear(result) / srgbToLinear(level)));
  console.log(`  ${sign * TEST_VALUE} : ${average(stops).toFixed(2)} stop`);
}

const blackLevel = luminance(adjustmentChart("blackPoint", -1).grey[0]);
console.log(`\nPoint noir -${TEST_VALUE} : noir relevé à ${blackLevel.toFixed(0)}/255 (→ FADE_GAIN ${(TEST_VALUE / blackLevel).toFixed(2)})`);

console.log("\nCurseurs comparés au modèle d'aperçu (coefficient = unités app Photos par unité Lightroom)");
for (const slider of Object.keys(LIGHTROOM_EQUIVALENTS)) {
  const fits = [1, -1].map((sign) => {
    const fit = fitLightroomEquivalent(slider, sign);
    const coefficient = fit.value === 0 ? "n/a" : ((sign * TEST_VALUE) / fit.value).toFixed(2);
    return `${sign * TEST_VALUE} ≈ ${fit.value} → ${coefficient} (écart ${fit.error.toFixed(1)}, sans réglage ${fit.baseline.toFixed(1)})`;
  });
  console.log(`  ${slider.padEnd(11)} ${fits.join(" | ")}`);
}

console.log(`\nVignette +${TEST_VALUE} : luminosité restante selon l'éloignement du centre (0 = centre, 1 = coin)`);
const vignetteChart = charts[`ajustement-vignette-+${TEST_VALUE}`];
const rowCenter = ([start, end]) => (start + end) / 2;
const vignetteSamples = [
  ...reference.memory.map((patch, index) => ({
    x: (index + 0.5) / MEMORY_COUNT,
    y: rowCenter(BANDS.memory),
    ratio: luminance(vignetteChart.memory[index]) / luminance(patch),
  })),
  ...reference.colors[2].map((patch, index) => ({
    x: (index + 0.5) / HUE_COUNT,
    y: BANDS.colors[0] + ((BANDS.colors[1] - BANDS.colors[0]) * 2.5) / COLOR_ROW_COUNT,
    ratio: luminance(vignetteChart.colors[2][index]) / luminance(patch),
  })),
].map(({ x, y, ratio }) => ({ distance: ((2 * x - 1) ** 2 + (2 * y - 1) ** 2) / 2, ratio }));
vignetteSamples
  .sort((first, second) => first.distance - second.distance)
  .filter((_, index) => index % 4 === 0)
  .forEach(({ distance, ratio }) => console.log(`  ${distance.toFixed(2)} : ${ratio.toFixed(2)}`));
