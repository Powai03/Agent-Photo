export const MIXER_COLORS = [
  "rouge",
  "orange",
  "jaune",
  "vert",
  "aqua",
  "bleu",
  "violet",
  "magenta",
] as const;
export type MixerColor = (typeof MIXER_COLORS)[number];

export type SceneType =
  | "portrait"
  | "landscape"
  | "urban"
  | "object"
  | "interior"
  | "night"
  | "general";

export const SCENE_LABELS: Record<SceneType, string> = {
  portrait: "Portrait",
  landscape: "Paysage",
  urban: "Urbain / architecture",
  object: "Objet / gros plan",
  interior: "Intérieur",
  night: "Nuit",
  general: "Scène générale",
};

export type LightCondition =
  | "harshSun"
  | "sunny"
  | "overcast"
  | "goldenHour"
  | "backlit"
  | "interior"
  | "night"
  | "unknown";

export const LIGHT_LABELS: Record<LightCondition, string> = {
  harshSun: "Soleil dur",
  sunny: "Ensoleillé",
  overcast: "Lumière diffuse",
  goldenHour: "Lumière dorée",
  backlit: "Contre-jour",
  interior: "Lumière d'intérieur",
  night: "Nuit",
  unknown: "Lumière indéterminée",
};

export type PhotoTrait =
  | "greyTones"
  | "isolatedSubject"
  | "skin"
  | "lushGreens"
  | "blueSky"
  | "warmLight"
  | "coolLight"
  | "highContrast"
  | "softLight"
  | "nightLights"
  | "vividColors"
  | "graphic";

export const TRAIT_LABELS: Record<PhotoTrait, string> = {
  greyTones: "Tonalités grises",
  isolatedSubject: "Sujet isolé",
  skin: "Tons chair",
  lushGreens: "Végétation dominante",
  blueSky: "Grand ciel bleu",
  warmLight: "Lumière chaude",
  coolLight: "Ambiance froide",
  highContrast: "Lumière contrastée",
  softLight: "Lumière douce",
  nightLights: "Lumières dans la nuit",
  vividColors: "Couleurs vives",
  graphic: "Lignes et textures",
};

export interface SettingRow {
  label: string;
  value: number;
  min: number;
  max: number;
  decimals?: number;
}

/** Retouche locale Lightroom, appliquée à travers un masque. */
export interface MaskAdjustment {
  name: string;
  howTo: string;
  rows: SettingRow[];
}

export interface ExifSummary {
  camera: string | null;
  lensModel: string | null;
  focalLength35: number | null;
  fNumber: number | null;
  exposureTime: number | null;
  iso: number | null;
  capturedHour: number | null;
}

export interface DominantColor {
  name: MixerColor;
  hex: string;
  sharePct: number;
}

/** Mesures objectives calculées sur les pixels (luminance et canaux sur 0-255). */
export interface ImageFeatures {
  luminanceMean: number;
  luminanceP5: number;
  luminanceP50: number;
  luminanceP95: number;
  luminanceStdDev: number;
  clippedShadowsPct: number;
  clippedHighlightsPct: number;
  saturationMeanPct: number;
  /** Dominante chaude (> 0) ou froide (< 0), mesurée sur les zones neutres. */
  warmthBias: number;
  /** Dominante verte (> 0) ou magenta (< 0), mesurée sur les zones neutres. */
  tintBias: number;
  /** Part de pixels quasi sans couleur. */
  neutralPct: number;
  centerLuminance: number;
  borderLuminance: number;
  skyTopPct: number;
  greenPct: number;
  skinPct: number;
  skinCenterPct: number;
  topLuminance: number;
  topSaturationPct: number;
  edgeDensity: number;
  /** Rapport de détail centre / bords : élevé quand le sujet se détache d'un fond flou. */
  centerEdgeRatio: number;
  colorSharesPct: Record<MixerColor, number>;
  dominantColors: DominantColor[];
}

export interface Analysis {
  sceneType: SceneType;
  detectedSceneType: SceneType;
  isNight: boolean;
  light: LightCondition;
  weather: string;
  timeOfDay: string;
  focalType: string;
  /** Indice de lumination à 100 ISO déduit de l'EXIF, null sans EXIF. */
  exposureValue: number | null;
  isHazy: boolean;
  traits: PhotoTrait[];
  dominantColors: DominantColor[];
  measurements: string[];
  flatnessDiagnosis: string[];
}

export interface IphoneSettings {
  /** Filtre de l'app Photos à appliquer en plus des curseurs, ou « Aucun ». */
  filter: string;
  exposure: number;
  brilliance: number;
  highlights: number;
  shadows: number;
  contrast: number;
  brightness: number;
  blackPoint: number;
  saturation: number;
  vibrance: number;
  warmth: number;
  tint: number;
  sharpness: number;
  definition: number;
  noiseReduction: number;
  vignette: number;
  tips: string;
}

export interface GradingWheel {
  hue: number;
  saturation: number;
  luminance: number;
}

export interface MixerEntry {
  color: MixerColor;
  hue: number;
  saturation: number;
  luminance: number;
}

export interface LightroomSettings {
  profile: string;
  isMonochrome: boolean;
  basic: {
    temp: number;
    tint: number;
    exposure: number;
    contrast: number;
    highlights: number;
    shadows: number;
    whites: number;
    blacks: number;
    texture: number;
    clarity: number;
    dehaze: number;
    vibrance: number;
    saturation: number;
  };
  toneCurve: {
    highlights: number;
    lights: number;
    darks: number;
    shadows: number;
    /** Relèvement du point noir (0-255) de la courbe à points. */
    fade: number;
    pointCurveNote: string;
  };
  colorMixer: MixerEntry[];
  colorGrading: {
    shadows: GradingWheel;
    midtones: GradingWheel;
    highlights: GradingWheel;
    blending: number;
    balance: number;
  };
  effects: {
    grainAmount: number;
    grainSize: number;
    grainRoughness: number;
    vignette: number;
  };
  detail: {
    sharpening: number;
    noiseReduction: number;
  };
  masks: MaskAdjustment[];
}

export interface LookProposal {
  lookId: string;
  name: string;
  family: string;
  description: string;
  fitScore: number;
  isRecommended: boolean;
  strengths: string[];
  cautions: string[];
  adaptations: string[];
  iphone: IphoneSettings;
  lightroom: LightroomSettings;
}

export interface Recommendation {
  lookId: string;
  name: string;
  reasons: string[];
  alternative: { name: string; reason: string } | null;
}

export interface AnalysisResult {
  analysis: Analysis;
  recommendation: Recommendation;
  looks: LookProposal[];
}
