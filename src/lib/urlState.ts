import { prefs } from './prefs';

/**
 * What the screen shows lives in two places:
 * - the address (#p=I500035&view=map…), so a link opens the same view (deep links);
 * - this browser's memory, so filters come back the way they were left.
 * A value from the link wins, then the remembered one, then the default.
 */

export const hashParams = () => new URLSearchParams(location.hash.slice(1));

type Patch = Record<string, string | number | boolean | null | undefined>;

function patched(patch: Patch): string {
  const p = hashParams();
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    if (v === null || v === '' || v === false) p.delete(k);
    else p.set(k, String(v));
  }
  const s = p.toString();
  return location.pathname + location.search + (s ? `#${s}` : '');
}
const here = () => location.pathname + location.search + location.hash;

/** Change some keys of the address in place: `undefined` leaves a key alone, null / '' / false removes it. */
export function setHash(patch: Patch) {
  const url = patched(patch);
  if (url !== here()) history.replaceState(history.state, '', url);
}

/** The same, as a new step in the browser's history (the back button returns to the previous address). */
export function pushHash(patch: Patch) {
  const url = patched(patch);
  if (url !== here()) history.pushState(history.state, '', url);
}

/** Run `fn` when the user goes back or forward in the browser. */
export function onHistoryMove(fn: () => void): () => void {
  window.addEventListener('popstate', fn);
  return () => window.removeEventListener('popstate', fn);
}

export function recall<T>(key: string): Partial<T> {
  try {
    const v = prefs.get(`ui:${key}`);
    return v ? (JSON.parse(v) as Partial<T>) : {};
  } catch {
    return {};
  }
}

export function remember(key: string, value: unknown) {
  prefs.set(`ui:${key}`, JSON.stringify(value));
}

// parsers for values read from the address
export const oneOf = <T extends string>(...allowed: T[]) => (s: string | null | undefined): T | undefined =>
  (allowed as string[]).includes(s ?? '') ? (s as T) : undefined;
export const listOf = <T extends string>(...allowed: T[]) => (s: string | null | undefined): T[] | undefined =>
  s == null ? undefined : s.split(',').filter((x): x is T => (allowed as string[]).includes(x));
export const flag = (s: string | null | undefined): boolean | undefined => (s == null ? undefined : s === '1');
/** generations: "all" or a number */
export const gens = (all: number) => (s: string | null | undefined): number | undefined => {
  if (s == null) return undefined;
  if (s === 'all') return all;
  const n = Number(s);
  return Number.isInteger(n) && n >= 0 ? n : undefined;
};
export const showGens = (n: number, all: number) => (n >= all ? 'all' : String(n));

/** link value, else remembered value, else default */
export function pick<T>(fromLink: T | undefined, fromMemory: T | undefined, fallback: T): T {
  return fromLink !== undefined ? fromLink : fromMemory !== undefined ? fromMemory : fallback;
}
