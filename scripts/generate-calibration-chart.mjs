// Génère la mire de calibrage et les dossiers où déposer ses versions retouchées sur iPhone.
// Usage : node scripts/generate-calibration-chart.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { crc32, deflateSync } from "node:zlib";

const OUTPUT_DIR = "calibration";
const WIDTH = 1200;
const HEIGHT = 1600;
const TEST_VALUE = 50;

// Disposition en fractions de l'image, pour rester mesurable après un redimensionnement.
const GREY_STEPS = 21;
const HUE_COUNT = 12;
const COLOR_ROWS = [
  [1, 0.5],
  [0.6, 0.5],
  [0.3, 0.5],
  [0.6, 0.3],
  [0.6, 0.7],
  [0.3, 0.75],
];
const BANDS = { greySteps: [0, 0.15], greyRamp: [0.15, 0.25], colors: [0.25, 0.85], memory: [0.85, 1] };
const MEMORY_COLORS = [
  [255, 224, 196],
  [241, 194, 167],
  [224, 172, 138],
  [198, 134, 94],
  [161, 102, 70],
  [117, 72, 48],
  [84, 52, 36],
  [120, 170, 225],
  [70, 110, 190],
  [80, 130, 60],
  [150, 170, 90],
  [215, 190, 150],
];

const FILTERS = [
  "intense",
  "intense-chaud",
  "intense-froid",
  "spectaculaire",
  "spectaculaire-chaud",
  "spectaculaire-froid",
  "mono",
  "argente",
  "noir",
];
const HALF_STRENGTH_FILTERS = ["intense", "spectaculaire"];
const BIPOLAR_ADJUSTMENTS = [
  "exposition",
  "brillance",
  "hautes-lumieres",
  "ombres",
  "contraste",
  "luminosite",
  "point-noir",
  "saturation",
  "vibrance",
  "chaleur",
  "teinte",
];

const hslToRgb = (hue, saturation, lightness) => {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const sector = hue / 60;
  const second = chroma * (1 - Math.abs((sector % 2) - 1));
  const base = lightness - chroma / 2;
  const [red, green, blue] = [
    [chroma, second, 0],
    [second, chroma, 0],
    [0, chroma, second],
    [0, second, chroma],
    [second, 0, chroma],
    [chroma, 0, second],
  ][Math.floor(sector) % 6];
  return [red, green, blue].map((channel) => Math.round((channel + base) * 255));
};

const within = (value, [start, end]) => value >= start && value < end;
const positionIn = (value, [start, end]) => (value - start) / (end - start);

const colorAt = (xRatio, yRatio) => {
  if (within(yRatio, BANDS.greySteps)) {
    const level = Math.round((Math.floor(xRatio * GREY_STEPS) / (GREY_STEPS - 1)) * 255);
    return [level, level, level];
  }
  if (within(yRatio, BANDS.greyRamp)) {
    const level = Math.round(xRatio * 255);
    return [level, level, level];
  }
  if (within(yRatio, BANDS.colors)) {
    const row = Math.floor(positionIn(yRatio, BANDS.colors) * COLOR_ROWS.length);
    const [saturation, lightness] = COLOR_ROWS[row];
    return hslToRgb(Math.floor(xRatio * HUE_COUNT) * (360 / HUE_COUNT), saturation, lightness);
  }
  return MEMORY_COLORS[Math.floor(xRatio * MEMORY_COLORS.length)];
};

const pngChunk = (type, content) => {
  const body = Buffer.concat([Buffer.from(type, "ascii"), content]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(content.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, checksum]);
};

const encodePng = () => {
  const rowLength = WIDTH * 3 + 1;
  const raw = Buffer.alloc(rowLength * HEIGHT);
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      const [red, green, blue] = colorAt(x / WIDTH, y / HEIGHT);
      const offset = y * rowLength + 1 + x * 3;
      raw[offset] = red;
      raw[offset + 1] = green;
      raw[offset + 2] = blue;
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(WIDTH, 0);
  header.writeUInt32BE(HEIGHT, 4);
  header.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
};

const folders = [
  "original-reexporte",
  ...FILTERS.map((filter) => `filtre-${filter}-100`),
  ...HALF_STRENGTH_FILTERS.map((filter) => `filtre-${filter}-${TEST_VALUE}`),
  ...BIPOLAR_ADJUSTMENTS.flatMap((adjustment) => [
    `ajustement-${adjustment}-+${TEST_VALUE}`,
    `ajustement-${adjustment}--${TEST_VALUE}`,
  ]),
  `ajustement-vignette-+${TEST_VALUE}`,
];

mkdirSync(OUTPUT_DIR, { recursive: true });
writeFileSync(join(OUTPUT_DIR, "mire.png"), encodePng());
for (const folder of folders) mkdirSync(join(OUTPUT_DIR, folder), { recursive: true });
console.log(`Mire ${WIDTH}x${HEIGHT} et ${folders.length} dossiers créés dans ${OUTPUT_DIR}/`);
