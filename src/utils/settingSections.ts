import type { GradingWheel, IphoneSettings, LightroomSettings, SettingRow } from "@/utils/types";

export interface SettingSection {
  title: string;
  rows: SettingRow[];
  notes: string[];
}

const NO_VALUE = "aucun";

const bipolar = (label: string, value: number): SettingRow => ({
  label,
  value,
  min: -100,
  max: 100,
});
const unipolar = (label: string, value: number, max = 100): SettingRow => ({
  label,
  value,
  min: 0,
  max,
});

const isMeaningful = (note: string): boolean =>
  note.trim() !== "" && note.trim().toLowerCase() !== NO_VALUE;

const wheelRows = (zone: string, wheel: GradingWheel): SettingRow[] => [
  { label: `${zone} · Teinte`, value: wheel.hue, min: 0, max: 360 },
  unipolar(`${zone} · Saturation`, wheel.saturation),
  bipolar(`${zone} · Luminance`, wheel.luminance),
];

const capitalize = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

export const buildIphoneSections = (settings: IphoneSettings): SettingSection[] => [
  {
    title: "Filtre",
    rows: [],
    notes: isMeaningful(settings.filter)
      ? [settings.filter, "À appliquer en plus des curseurs : leurs valeurs tiennent déjà compte du filtre."]
      : ["Aucun filtre : les curseurs portent tout le rendu."],
  },
  {
    title: "Ajuster",
    rows: [
      bipolar("Exposition", settings.exposure),
      bipolar("Brillance", settings.brilliance),
      bipolar("Hautes lumières", settings.highlights),
      bipolar("Ombres", settings.shadows),
      bipolar("Contraste", settings.contrast),
      bipolar("Luminosité", settings.brightness),
      bipolar("Point noir", settings.blackPoint),
      bipolar("Saturation", settings.saturation),
      bipolar("Vibrance", settings.vibrance),
      bipolar("Chaleur", settings.warmth),
      bipolar("Teinte", settings.tint),
      unipolar("Netteté", settings.sharpness),
      unipolar("Définition", settings.definition),
      unipolar("Réduction du bruit", settings.noiseReduction),
      bipolar("Vignette", settings.vignette),
    ],
    notes: [settings.tips].filter(isMeaningful),
  },
];

export const buildLightroomSections = (settings: LightroomSettings): SettingSection[] => {
  const { basic, toneCurve, colorMixer, colorGrading, effects, detail } = settings;
  const sections: SettingSection[] = [
    { title: "Profil", rows: [], notes: [settings.profile] },
    {
      title: "Lumière",
      rows: [
        { label: "Exposition", value: basic.exposure, min: -5, max: 5, decimals: 2 },
        bipolar("Contraste", basic.contrast),
        bipolar("Hautes lumières", basic.highlights),
        bipolar("Ombres", basic.shadows),
        bipolar("Blancs", basic.whites),
        bipolar("Noirs", basic.blacks),
      ],
      notes: [],
    },
    {
      title: "Courbe des tonalités",
      rows: [
        bipolar("Hautes lumières", toneCurve.highlights),
        bipolar("Tons clairs", toneCurve.lights),
        bipolar("Tons foncés", toneCurve.darks),
        bipolar("Ombres", toneCurve.shadows),
      ],
      notes: [toneCurve.pointCurveNote].filter(isMeaningful),
    },
    {
      title: "Couleur",
      rows: [
        bipolar("Température", basic.temp),
        bipolar("Teinte", basic.tint),
        bipolar("Vibrance", basic.vibrance),
        bipolar("Saturation", basic.saturation),
      ],
      notes: [],
    },
    {
      title: settings.isMonochrome ? "Mélange noir et blanc" : "Mélangeur de couleurs",
      rows: colorMixer.flatMap((entry) => {
        const luminanceRow = bipolar(`${capitalize(entry.color)} · Luminance`, entry.luminance);
        return settings.isMonochrome
          ? [luminanceRow]
          : [
              bipolar(`${capitalize(entry.color)} · Teinte`, entry.hue),
              bipolar(`${capitalize(entry.color)} · Saturation`, entry.saturation),
              luminanceRow,
            ];
      }),
      notes: colorMixer.length === 0 ? ["Aucune modification"] : [],
    },
    {
      title: "Color grading",
      rows: [
        ...wheelRows("Ombres", colorGrading.shadows),
        ...wheelRows("Tons moyens", colorGrading.midtones),
        ...wheelRows("Hautes lumières", colorGrading.highlights),
        unipolar("Fusion", colorGrading.blending),
        bipolar("Balance", colorGrading.balance),
      ],
      notes: [],
    },
    {
      title: "Effets",
      rows: [
        bipolar("Texture", basic.texture),
        bipolar("Clarté", basic.clarity),
        bipolar("Correction du voile", basic.dehaze),
        bipolar("Vignette", effects.vignette),
        unipolar("Grain · Quantité", effects.grainAmount),
        unipolar("Grain · Taille", effects.grainSize),
        unipolar("Grain · Cassure", effects.grainRoughness),
      ],
      notes: [],
    },
    {
      title: "Détail",
      rows: [
        unipolar("Netteté", detail.sharpening, 150),
        unipolar("Réduction du bruit", detail.noiseReduction),
      ],
      notes: [],
    },
    ...settings.masks.map((mask) => ({
      title: `Masque · ${mask.name}`,
      rows: mask.rows,
      notes: [mask.howTo],
    })),
  ];
  return sections;
};

export const formatSettingValue = (row: SettingRow): string => {
  // Un réglage arrondi à zéro par le bas s'afficherait « -0 ».
  const text = row.value.toFixed(row.decimals ?? 0).replace(/^-(0(?:\.0+)?)$/, "$1");
  return row.min < 0 && row.value > 0 ? `+${text}` : text;
};

export const sectionsToText = (lookName: string, sections: SettingSection[]): string =>
  [
    lookName,
    ...sections.flatMap((section) => [
      "",
      `[${section.title}]`,
      ...section.rows.map((row) => `${row.label} : ${formatSettingValue(row)}`),
      ...section.notes,
    ]),
  ].join("\n");
