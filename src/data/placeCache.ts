import { normalizePlace, type GeoPlace } from '../lib/places';

/**
 * Coordinates for place names: the pre-computed file (npm run geocode) plus anything looked up
 * or corrected in the browser. null = looked up but not found.
 */
const seeds = import.meta.glob<{ default: Record<string, GeoPlace | null> }>('./places.local.json', { eager: true });
const seed = seeds['./places.local.json']?.default ?? {};
const KEY = 'family-tree:places:v1';

function loadOverlay(): Record<string, GeoPlace | null> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}');
  } catch {
    return {};
  }
}

let overlay = loadOverlay();

export const placeCache = {
  /** undefined = never looked up */
  get(raw: string): GeoPlace | null | undefined {
    const k = normalizePlace(raw);
    if (k in overlay) return overlay[k];
    return k in seed ? seed[k] : undefined;
  },
  set(raw: string, value: GeoPlace | null) {
    overlay = { ...overlay, [normalizePlace(raw)]: value };
    try {
      localStorage.setItem(KEY, JSON.stringify(overlay));
    } catch {
      /* storage unavailable: keep in memory */
    }
  },
};
