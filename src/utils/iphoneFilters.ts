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
  saturation: number;
  warmth: number;
  blackPoint: number;
}

const WARM_SHIFT = 20;

/**
 * Effet estimé de chaque filtre à 100 %, exprimé en unités de curseurs de l'app Photos. Apple ne
 * publie pas ces valeurs : elles servent à retrancher la part du filtre des curseurs conseillés.
 */
const FILTER_EFFECTS: Record<IphoneFilterName, FilterEffect> = {
  Intense: { contrast: 20, saturation: 20, warmth: 0, blackPoint: 0 },
  "Intense chaud": { contrast: 20, saturation: 20, warmth: WARM_SHIFT, blackPoint: 0 },
  "Intense froid": { contrast: 20, saturation: 20, warmth: -WARM_SHIFT, blackPoint: 0 },
  Spectaculaire: { contrast: 30, saturation: -15, warmth: 0, blackPoint: 10 },
  "Spectaculaire chaud": { contrast: 30, saturation: -15, warmth: WARM_SHIFT, blackPoint: 10 },
  "Spectaculaire froid": { contrast: 30, saturation: -15, warmth: -WARM_SHIFT, blackPoint: 10 },
  Mono: { contrast: 0, saturation: -100, warmth: 0, blackPoint: 0 },
  Argenté: { contrast: 15, saturation: -100, warmth: 0, blackPoint: 0 },
  Noir: { contrast: 35, saturation: -100, warmth: 0, blackPoint: 15 },
};

const NO_EFFECT: FilterEffect = { contrast: 0, saturation: 0, warmth: 0, blackPoint: 0 };

export const computeFilterEffect = (filter: IphoneFilter | null): FilterEffect => {
  if (!filter) return NO_EFFECT;
  const effect = FILTER_EFFECTS[filter.name];
  const share = filter.intensity / 100;
  return {
    contrast: effect.contrast * share,
    saturation: effect.saturation * share,
    warmth: effect.warmth * share,
    blackPoint: effect.blackPoint * share,
  };
};

export const describeFilter = (filter: IphoneFilter | null): string =>
  filter ? `${filter.name} à ${filter.intensity}` : "Aucun";
