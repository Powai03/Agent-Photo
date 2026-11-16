/** Filtres de l'app Photos, tels que nommés sur un iPhone en français. */
export type IphoneFilterName =
  | "Intense"
  | "Intense chaud"
  | "Intense froid"
  | "Spectaculaire"
  | "Spectaculaire chaud"
  | "Spectaculaire froid"
  | "Mono"
  | "Argenté"
  | "Noir";

export interface IphoneFilter {
  name: IphoneFilterName;
  /** Intensité du filtre, de 0 à 100. */
  intensity: number;
}

export interface FilterEffect {
  contrast: number;
  brightness: number;
  saturation: number;
  warmth: number;
  blackPoint: number;
}

/**
 * Effet de chaque filtre à 100 %, exprimé en unités de curseurs de l'app Photos, pour retrancher
 * la part du filtre des curseurs conseillés. Valeurs mesurées sur la mire de `calibration/`, sauf
 * Argenté (vignette et mélange de canaux intégrés, non réductibles à des curseurs) qui reste estimé.
 */
const FILTER_EFFECTS: Record<IphoneFilterName, FilterEffect> = {
  Intense: { contrast: -10, brightness: 50, saturation: 30, warmth: -5, blackPoint: 25 },
  "Intense chaud": { contrast: 10, brightness: 30, saturation: 15, warmth: 30, blackPoint: 10 },
  "Intense froid": { contrast: 20, brightness: 35, saturation: 10, warmth: -55, blackPoint: 10 },
  Spectaculaire: { contrast: 20, brightness: -5, saturation: -25, warmth: 0, blackPoint: 5 },
  "Spectaculaire chaud": { contrast: 25, brightness: -25, saturation: -20, warmth: 30, blackPoint: 5 },
  "Spectaculaire froid": { contrast: 25, brightness: -5, saturation: -20, warmth: -30, blackPoint: 5 },
  Mono: { contrast: 20, brightness: 5, saturation: -100, warmth: 0, blackPoint: 0 },
  Argenté: { contrast: 15, brightness: 0, saturation: -100, warmth: 0, blackPoint: 0 },
  Noir: { contrast: 55, brightness: 5, saturation: -100, warmth: 0, blackPoint: 0 },
};

const NO_EFFECT: FilterEffect = { contrast: 0, brightness: 0, saturation: 0, warmth: 0, blackPoint: 0 };

export const computeFilterEffect = (filter: IphoneFilter | null): FilterEffect => {
  if (!filter) return NO_EFFECT;
  const effect = FILTER_EFFECTS[filter.name];
  const share = filter.intensity / 100;
  return {
    contrast: effect.contrast * share,
    brightness: effect.brightness * share,
    saturation: effect.saturation * share,
    warmth: effect.warmth * share,
    blackPoint: effect.blackPoint * share,
  };
};

export const describeFilter = (filter: IphoneFilter | null): string =>
  filter ? `${filter.name} à ${filter.intensity}` : "Aucun";
