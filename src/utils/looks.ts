import type { IphoneFilter } from "@/utils/iphoneFilters";
import type { GradingWheel, LightCondition, MixerColor, SceneType } from "@/utils/types";

/*
 * Recettes calées sur des réglages publiés (presets chiffrés et fourchettes de photographes) :
 * désaturations sélectives franches des jaunes, verts et bleus, virage des ombres, grain 30-40.
 * Les valeurs restent à affiner sur de vraies photos.
 */
export const TONE_KEYS = [
  "exposure",
  "contrast",
  "highlights",
  "shadows",
  "whites",
  "blacks",
  "texture",
  "clarity",
  "dehaze",
  "vibrance",
  "saturation",
  "temp",
  "tint",
  "vignette",
] as const;
export type ToneKey = (typeof TONE_KEYS)[number];
export type ToneValues = Record<ToneKey, number>;

export const CURVE_KEYS = ["highlights", "lights", "darks", "shadows"] as const;
export type CurveKey = (typeof CURVE_KEYS)[number];
export type CurveValues = Record<CurveKey, number>;

/** Décalage [teinte, saturation, luminance] d'une couleur du mélangeur. */
export type MixerShift = [hue: number, saturation: number, luminance: number];

export interface LookGrading {
  shadows?: GradingWheel;
  midtones?: GradingWheel;
  highlights?: GradingWheel;
  blending: number;
  balance: number;
}

/** Signature d'un rendu, exprimée en écarts de curseurs Lightroom. */
export interface LookStyle {
  tone: Partial<ToneValues>;
  curve: Partial<CurveValues>;
  /** Relèvement du point noir de la courbe à points (rendu mat). */
  fade: number;
  mixer: Partial<Record<MixerColor, MixerShift>>;
  grading: LookGrading | null;
  grain: [amount: number, size: number, roughness: number];
  isMonochrome: boolean;
}

export interface LookDefinition {
  id: string;
  name: string;
  family: "Naturel" | "Fujifilm" | "Kodak" | "Argentique" | "Boîtiers" | "Cinéma";
  signature: string;
  lightroomProfile: string;
  iphoneFilter: IphoneFilter | null;
  iphoneNote: string;
  /** Adéquation de 1 à 5 par type de scène. */
  sceneAffinity: Record<SceneType, number>;
  lightBonus: Partial<Record<LightCondition, number>>;
  style: LookStyle;
}

export const NATURAL_LOOK_ID = "natural";
export const AUTO_LOOK_COUNT = 5;
export const MAX_SELECTED_LOOKS = 6;

const wheel = (hue: number, saturation: number, luminance = 0): GradingWheel => ({
  hue,
  saturation,
  luminance,
});

const NO_MIXER_NOTE =
  "L'app Photos n'a ni mélangeur de couleurs ni color grading : les virages de teinte propres à ce rendu ne sont qu'approchés par le filtre, la chaleur et la teinte.";
const NO_GRAIN_NOTE = "Le grain n'est pas reproductible dans l'app Photos.";

export const LOOKS: LookDefinition[] = [
  {
    id: NATURAL_LOOK_ID,
    name: "Naturel sublimé",
    family: "Naturel",
    signature:
      "Aucune DA imposée : on corrige l'aplat du traitement iPhone pour redonner profondeur, densité et une couleur fidèle mais vivante.",
    lightroomProfile: "Adobe Couleur",
    iphoneFilter: null,
    iphoneNote: "Ce rendu est entièrement reproductible dans l'app Photos.",
    sceneAffinity: { portrait: 4, landscape: 4, urban: 4, object: 4, interior: 4, night: 4, general: 4 },
    lightBonus: {},
    style: {
      tone: { contrast: 8, clarity: 6, vibrance: 8, blacks: -6, whites: 4, vignette: -4 },
      curve: { lights: 4, darks: -4 },
      fade: 0,
      mixer: {},
      grading: null,
      grain: [0, 0, 0],
      isMonochrome: false,
    },
  },
  {
    id: "fuji-classic-chrome",
    name: "Fujifilm Classic Chrome",
    family: "Fujifilm",
    signature:
      "Couleurs sourdes et denses, saturation retenue, bleus tirant vers le cyan-gris, rouges éteints, ombres fermes. Ambiance reportage, hors du temps.",
    lightroomProfile: "Adobe Couleur",
    iphoneFilter: { name: "Spectaculaire", intensity: 35 },
    iphoneNote: NO_MIXER_NOTE,
    sceneAffinity: { portrait: 3, landscape: 3, urban: 5, object: 4, interior: 4, night: 3, general: 4 },
    lightBonus: { overcast: 1 },
    style: {
      tone: {
        contrast: 12,
        highlights: -22,
        shadows: -6,
        vibrance: -8,
        saturation: -12,
        clarity: 6,
        blacks: -8,
        vignette: -6,
      },
      curve: { lights: 3, darks: -8, shadows: -4 },
      fade: 0,
      mixer: {
        rouge: [0, -10, -4],
        orange: [-3, -8, 0],
        jaune: [-3, -35, -4],
        vert: [12, -45, -8],
        aqua: [-6, -20, -6],
        bleu: [-10, -30, -12],
        violet: [0, -30, 0],
        magenta: [0, -35, 0],
      },
      grading: { shadows: wheel(210, 12), highlights: wheel(45, 4), blending: 60, balance: 0 },
      grain: [25, 30, 50],
      isMonochrome: false,
    },
  },
  {
    id: "fuji-classic-neg",
    name: "Fujifilm Classic Negative",
    family: "Fujifilm",
    signature:
      "Inspiré de la Superia : verts tirant vers le cyan, tons chair chauds, contraste marqué, hautes lumières froides et ombres chaudes. Snapshot des années 90-2000.",
    lightroomProfile: "Adobe Couleur",
    iphoneFilter: { name: "Spectaculaire chaud", intensity: 30 },
    iphoneNote: NO_MIXER_NOTE,
    sceneAffinity: { portrait: 4, landscape: 3, urban: 5, object: 3, interior: 4, night: 4, general: 4 },
    lightBonus: { overcast: 1 },
    style: {
      tone: {
        contrast: 18,
        highlights: -14,
        shadows: -8,
        vibrance: -4,
        saturation: -8,
        clarity: 4,
        blacks: -10,
        tint: 4,
        vignette: -8,
      },
      curve: { highlights: -4, lights: 6, darks: -10 },
      fade: 0,
      mixer: {
        rouge: [4, 6, -4],
        orange: [-4, 2, 2],
        jaune: [-8, -25, 0],
        vert: [22, -35, -10],
        aqua: [6, -6, -4],
        bleu: [-6, -10, -8],
      },
      grading: {
        shadows: wheel(170, 8),
        midtones: wheel(30, 4),
        highlights: wheel(315, 6),
        blending: 60,
        balance: -5,
      },
      grain: [30, 35, 50],
      isMonochrome: false,
    },
  },
  {
    id: "fuji-velvia",
    name: "Fujifilm Velvia",
    family: "Fujifilm",
    signature:
      "Diapositive de paysage : saturation très forte, bleus et verts profonds, contraste élevé, noirs denses.",
    lightroomProfile: "Adobe Paysage",
    iphoneFilter: { name: "Intense", intensity: 60 },
    iphoneNote: "Rendu bien approché dans l'app Photos ; seule la densité des bleus et des verts reste en retrait.",
    sceneAffinity: { portrait: 1, landscape: 5, urban: 3, object: 3, interior: 2, night: 2, general: 3 },
    lightBonus: { goldenHour: 1, sunny: 1 },
    style: {
      tone: {
        contrast: 20,
        highlights: -8,
        shadows: -4,
        vibrance: 22,
        saturation: 10,
        clarity: 8,
        dehaze: 6,
        blacks: -12,
        whites: 6,
        vignette: -6,
      },
      curve: { lights: 6, darks: -8 },
      fade: 0,
      mixer: {
        rouge: [0, 8, 0],
        jaune: [-2, 8, 0],
        vert: [-4, 14, -4],
        aqua: [0, 10, -4],
        bleu: [-4, 16, -10],
      },
      grading: null,
      grain: [6, 20, 30],
      isMonochrome: false,
    },
  },
  {
    id: "fuji-pro-400h",
    name: "Fujifilm Pro 400H",
    family: "Fujifilm",
    signature:
      "Pastel et lumineux, comme surexposé d'un stop : verts menthe, ombres légèrement cyan, peau douce, contraste faible.",
    lightroomProfile: "Adobe Portrait",
    iphoneFilter: null,
    iphoneNote: NO_MIXER_NOTE,
    sceneAffinity: { portrait: 5, landscape: 3, urban: 2, object: 4, interior: 3, night: 1, general: 3 },
    lightBonus: { overcast: 1, harshSun: -1 },
    style: {
      tone: {
        exposure: 0.3,
        contrast: -10,
        highlights: -18,
        shadows: 18,
        blacks: 10,
        whites: 4,
        vibrance: 4,
        saturation: -8,
        clarity: -4,
        tint: 3,
      },
      curve: { shadows: 8, lights: 4 },
      fade: 12,
      mixer: {
        orange: [0, -4, 6],
        jaune: [-6, -14, 6],
        vert: [16, -32, 10],
        aqua: [0, -8, 6],
        bleu: [-8, -22, 6],
      },
      grading: { shadows: wheel(185, 8), highlights: wheel(50, 5), blending: 60, balance: 10 },
      grain: [16, 25, 40],
      isMonochrome: false,
    },
  },
  {
    id: "fuji-acros",
    name: "Fujifilm Acros (N&B)",
    family: "Fujifilm",
    signature: "Noir et blanc fin : noirs profonds, gradations riches, fort micro-contraste, grain très fin.",
    lightroomProfile: "Adobe Monochrome",
    iphoneFilter: { name: "Mono", intensity: 100 },
    iphoneNote: NO_GRAIN_NOTE,
    sceneAffinity: { portrait: 4, landscape: 3, urban: 4, object: 4, interior: 3, night: 3, general: 3 },
    lightBonus: { harshSun: 1 },
    style: {
      tone: {
        contrast: 16,
        highlights: -8,
        shadows: -6,
        clarity: 12,
        texture: 8,
        blacks: -12,
        whites: 8,
        vignette: -8,
      },
      curve: { lights: 6, darks: -8 },
      fade: 0,
      mixer: {
        rouge: [0, 0, 8],
        orange: [0, 0, 6],
        jaune: [0, 0, 4],
        vert: [0, 0, -4],
        bleu: [0, 0, -14],
      },
      grading: null,
      grain: [14, 18, 35],
      isMonochrome: true,
    },
  },
  {
    id: "kodak-portra-400",
    name: "Kodak Portra 400",
    family: "Kodak",
    signature:
      "Tons chair chauds et doux, contraste faible, hautes lumières crémeuses, verts légèrement olive, saturation modérée, grain fin.",
    lightroomProfile: "Adobe Portrait",
    iphoneFilter: { name: "Intense chaud", intensity: 25 },
    iphoneNote: NO_MIXER_NOTE,
    sceneAffinity: { portrait: 5, landscape: 3, urban: 3, object: 4, interior: 4, night: 2, general: 4 },
    lightBonus: { goldenHour: 1 },
    style: {
      tone: {
        exposure: 0.15,
        contrast: -6,
        highlights: -22,
        shadows: 12,
        whites: -4,
        blacks: 6,
        vibrance: 6,
        saturation: -6,
        clarity: -8,
        temp: 6,
        tint: 3,
      },
      curve: { highlights: -6, lights: 4, shadows: 6 },
      fade: 8,
      mixer: {
        rouge: [4, -6, 2],
        orange: [-2, 4, 6],
        jaune: [-10, -20, 4],
        vert: [-14, -32, -2],
        aqua: [-8, -25, 0],
        bleu: [-6, -25, -4],
      },
      grading: {
        shadows: wheel(195, 6),
        midtones: wheel(35, 5),
        highlights: wheel(48, 8),
        blending: 60,
        balance: 10,
      },
      grain: [26, 35, 50],
      isMonochrome: false,
    },
  },
  {
    id: "kodak-gold-200",
    name: "Kodak Gold 200",
    family: "Kodak",
    signature:
      "Chaleur dorée, jaunes et orangés saturés, ombres légèrement vertes, grain visible. Nostalgie des photos de vacances.",
    lightroomProfile: "Adobe Couleur",
    iphoneFilter: { name: "Intense chaud", intensity: 50 },
    iphoneNote: NO_MIXER_NOTE,
    sceneAffinity: { portrait: 4, landscape: 4, urban: 3, object: 3, interior: 3, night: 2, general: 4 },
    lightBonus: { goldenHour: 1, sunny: 1 },
    style: {
      tone: {
        contrast: 10,
        highlights: -12,
        shadows: 4,
        vibrance: 8,
        saturation: 2,
        temp: 14,
        tint: 4,
        blacks: -4,
        clarity: -5,
        vignette: -8,
      },
      curve: { lights: 5, darks: -5 },
      fade: 10,
      mixer: {
        rouge: [4, 6, 0],
        orange: [-4, 10, 2],
        jaune: [-15, 4, 2],
        vert: [-15, -30, -4],
        aqua: [-10, -25, 0],
        bleu: [-9, -35, 8],
      },
      grading: {
        shadows: wheel(70, 12),
        midtones: wheel(40, 5),
        highlights: wheel(45, 12),
        blending: 55,
        balance: 15,
      },
      grain: [36, 45, 50],
      isMonochrome: false,
    },
  },
  {
    id: "kodak-ektar-100",
    name: "Kodak Ektar 100",
    family: "Kodak",
    signature: "Saturation forte, rouges et bleus éclatants, contraste élevé, grain ultra-fin, rendu très net.",
    lightroomProfile: "Adobe Couleur",
    iphoneFilter: { name: "Intense", intensity: 50 },
    iphoneNote: "Rendu bien approché dans l'app Photos ; l'éclat sélectif des rouges et des bleus reste en retrait.",
    sceneAffinity: { portrait: 2, landscape: 5, urban: 4, object: 4, interior: 3, night: 2, general: 3 },
    lightBonus: { sunny: 1 },
    style: {
      tone: {
        contrast: 18,
        highlights: -8,
        shadows: -2,
        vibrance: 18,
        saturation: 8,
        clarity: 8,
        texture: 6,
        blacks: -10,
        whites: 6,
        temp: 2,
        vignette: -4,
      },
      curve: { lights: 6, darks: -8 },
      fade: 0,
      mixer: {
        rouge: [2, 14, -2],
        orange: [0, 6, 0],
        vert: [-4, 8, -4],
        aqua: [-6, 10, -4],
        bleu: [-2, 16, -8],
      },
      grading: { shadows: wheel(220, 5), highlights: wheel(40, 4), blending: 50, balance: 0 },
      grain: [6, 18, 25],
      isMonochrome: false,
    },
  },
  {
    id: "kodachrome-64",
    name: "Kodachrome 64",
    family: "Kodak",
    signature:
      "Rouges profonds, bleus riches, noirs denses, contraste fort. Le rendu magazine de voyage des années 70.",
    lightroomProfile: "Adobe Couleur",
    iphoneFilter: { name: "Spectaculaire chaud", intensity: 45 },
    iphoneNote: NO_MIXER_NOTE,
    sceneAffinity: { portrait: 3, landscape: 4, urban: 4, object: 3, interior: 3, night: 2, general: 4 },
    lightBonus: { sunny: 1, harshSun: 1 },
    style: {
      tone: {
        contrast: 22,
        highlights: -14,
        shadows: -10,
        vibrance: 6,
        saturation: 4,
        clarity: 8,
        blacks: -16,
        whites: 4,
        temp: 4,
        vignette: -10,
      },
      curve: { lights: 4, darks: -12, shadows: -6 },
      fade: 0,
      mixer: {
        rouge: [-4, 16, -8],
        orange: [-2, 6, -2],
        jaune: [-6, 4, -4],
        vert: [6, -10, -10],
        aqua: [-10, -4, -10],
        bleu: [-6, 10, -16],
      },
      grading: { shadows: wheel(225, 6), highlights: wheel(42, 7), blending: 50, balance: 0 },
      grain: [14, 22, 40],
      isMonochrome: false,
    },
  },
  {
    id: "kodak-tri-x-400",
    name: "Kodak Tri-X 400 (N&B)",
    family: "Kodak",
    signature: "Noir et blanc de reportage : contraste fort, grain marqué, noirs volontiers bouchés.",
    lightroomProfile: "Adobe Monochrome",
    iphoneFilter: { name: "Noir", intensity: 100 },
    iphoneNote: NO_GRAIN_NOTE,
    sceneAffinity: { portrait: 3, landscape: 2, urban: 5, object: 3, interior: 3, night: 4, general: 3 },
    lightBonus: { harshSun: 1 },
    style: {
      tone: {
        contrast: 30,
        highlights: -6,
        shadows: -12,
        clarity: 16,
        texture: 6,
        blacks: -20,
        whites: 12,
        vignette: -12,
      },
      curve: { lights: 10, darks: -14 },
      fade: 0,
      mixer: {
        rouge: [0, 0, 10],
        orange: [0, 0, 8],
        jaune: [0, 0, 6],
        vert: [0, 0, -6],
        bleu: [0, 0, -18],
      },
      grading: null,
      grain: [45, 38, 65],
      isMonochrome: true,
    },
  },
  {
    id: "cinestill-800t",
    name: "CineStill 800T",
    family: "Argentique",
    signature:
      "Pellicule tungstène : ombres bleu-vert, hautes lumières chaudes orangées. Faite pour les nuits urbaines et les néons.",
    lightroomProfile: "Adobe Couleur",
    iphoneFilter: { name: "Spectaculaire froid", intensity: 50 },
    iphoneNote:
      "Le halo rouge autour des lumières (halation) et le virage bleu-vert des ombres ne sont pas reproductibles dans l'app Photos.",
    sceneAffinity: { portrait: 3, landscape: 2, urban: 3, object: 2, interior: 4, night: 5, general: 2 },
    lightBonus: {},
    style: {
      tone: {
        contrast: 8,
        highlights: -16,
        shadows: 8,
        vibrance: 6,
        saturation: -4,
        temp: -18,
        tint: 6,
        blacks: 4,
        clarity: -2,
        vignette: -8,
      },
      curve: { shadows: 6, lights: 4 },
      fade: 8,
      mixer: {
        rouge: [4, 16, 4],
        orange: [-6, 10, 4],
        jaune: [-10, -8, 0],
        vert: [20, -14, -6],
        aqua: [-8, 8, -4],
        bleu: [-8, 6, -8],
      },
      grading: {
        shadows: wheel(200, 16),
        midtones: wheel(190, 5),
        highlights: wheel(28, 12),
        blending: 65,
        balance: -10,
      },
      grain: [30, 34, 55],
      isMonochrome: false,
    },
  },
  {
    id: "leica-m",
    name: "Leica M",
    family: "Boîtiers",
    signature:
      "Couleurs denses et naturelles, micro-contraste fort, noirs profonds, rouges riches, saturation contenue, léger vignettage.",
    lightroomProfile: "Adobe Couleur",
    iphoneFilter: { name: "Spectaculaire", intensity: 25 },
    iphoneNote: NO_MIXER_NOTE,
    sceneAffinity: { portrait: 4, landscape: 3, urban: 5, object: 4, interior: 4, night: 4, general: 4 },
    lightBonus: {},
    style: {
      tone: {
        contrast: 14,
        highlights: -12,
        shadows: -4,
        vibrance: 2,
        saturation: -4,
        clarity: 10,
        texture: 6,
        blacks: -18,
        whites: 4,
        temp: 2,
        vignette: -14,
      },
      curve: { lights: 4, darks: -8 },
      fade: 0,
      mixer: {
        rouge: [-2, 8, -6],
        orange: [-2, 2, 0],
        jaune: [-4, -8, -2],
        vert: [4, -12, -8],
        bleu: [-4, -6, -10],
      },
      grading: { shadows: wheel(215, 4), highlights: wheel(40, 4), blending: 50, balance: 0 },
      grain: [10, 20, 35],
      isMonochrome: false,
    },
  },
  {
    id: "ricoh-gr",
    name: "Ricoh GR (Positive Film)",
    family: "Boîtiers",
    signature:
      "Contraste fort, saturation soutenue, bleus profonds, vignettage marqué. Rendu street direct et graphique.",
    lightroomProfile: "Adobe Couleur",
    iphoneFilter: { name: "Spectaculaire", intensity: 55 },
    iphoneNote: "Rendu bien approché dans l'app Photos ; la profondeur des bleus reste en retrait.",
    sceneAffinity: { portrait: 2, landscape: 3, urban: 5, object: 3, interior: 3, night: 4, general: 4 },
    lightBonus: { harshSun: 1 },
    style: {
      tone: {
        contrast: 24,
        highlights: -10,
        shadows: -10,
        vibrance: 12,
        saturation: 2,
        clarity: 12,
        texture: 8,
        blacks: -14,
        whites: 6,
        vignette: -16,
      },
      curve: { lights: 6, darks: -12 },
      fade: 0,
      mixer: {
        rouge: [0, 8, -2],
        jaune: [-2, 4, 0],
        vert: [2, -4, -8],
        bleu: [-4, 10, -14],
      },
      grading: null,
      grain: [18, 24, 50],
      isMonochrome: false,
    },
  },
  {
    id: "hasselblad",
    name: "Hasselblad",
    family: "Boîtiers",
    signature:
      "Couleurs très justes, transitions douces, grande dynamique, tons chair neutres. Propreté du moyen format.",
    lightroomProfile: "Adobe Standard",
    iphoneFilter: null,
    iphoneNote: "Ce rendu est presque entièrement reproductible dans l'app Photos.",
    sceneAffinity: { portrait: 4, landscape: 4, urban: 3, object: 5, interior: 4, night: 2, general: 4 },
    lightBonus: { overcast: 1 },
    style: {
      tone: {
        contrast: 4,
        highlights: -18,
        shadows: 10,
        vibrance: 6,
        saturation: -2,
        clarity: 4,
        texture: 6,
        blacks: -4,
        whites: 2,
      },
      curve: { lights: 3, darks: -3 },
      fade: 0,
      mixer: {
        rouge: [2, -4, 0],
        orange: [0, -4, 4],
        vert: [-4, -6, 0],
        bleu: [0, -4, -4],
      },
      grading: null,
      grain: [0, 0, 0],
      isMonochrome: false,
    },
  },
  {
    id: "cine-teal-orange",
    name: "Cinéma teal & orange",
    family: "Cinéma",
    signature:
      "Ombres sarcelle, peaux et hautes lumières orangées, noirs légèrement relevés, contraste doux. Étalonnage de film.",
    lightroomProfile: "Adobe Couleur",
    iphoneFilter: { name: "Spectaculaire", intensity: 30 },
    iphoneNote: NO_MIXER_NOTE,
    sceneAffinity: { portrait: 4, landscape: 3, urban: 4, object: 2, interior: 3, night: 4, general: 3 },
    lightBonus: { goldenHour: 1 },
    style: {
      tone: {
        contrast: 6,
        highlights: -14,
        shadows: 8,
        vibrance: 4,
        saturation: -6,
        clarity: 4,
        blacks: 6,
        vignette: -12,
      },
      curve: { shadows: 8, darks: -6, lights: 4 },
      fade: 10,
      mixer: {
        rouge: [6, 4, 0],
        orange: [-4, 14, 4],
        jaune: [-14, -10, 0],
        vert: [30, -24, -8],
        aqua: [6, 12, -4],
        bleu: [-16, 6, -8],
      },
      grading: {
        shadows: wheel(190, 18),
        midtones: wheel(35, 6),
        highlights: wheel(38, 14),
        blending: 70,
        balance: 0,
      },
      grain: [10, 22, 35],
      isMonochrome: false,
    },
  },
];

export const findLook = (id: string): LookDefinition | undefined =>
  LOOKS.find((look) => look.id === id);
