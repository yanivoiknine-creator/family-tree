import type { DecisionRecord, FamilyData, Finding } from '../types';

/*
 * Private family files that exist only on this computer (*.local.json, kept out of git).
 * A production build replaces every *.local.json with an empty module (see vite.config.ts),
 * so none of this can ever end up in the published site.
 */

const seeds = import.meta.glob<{ default: FamilyData | null }>('./family.local.json', { eager: true });
export const SEED_DATA: FamilyData = seeds['./family.local.json']?.default ?? { people: {}, unions: {} };

// Every research run writes its own research*.local.json; all of them are shown together.
const researchFiles = import.meta.glob<{ default: Finding[] | null }>('./research*.local.json', { eager: true });
export const LOCAL_FINDINGS: Finding[] = Object.keys(researchFiles)
  .sort()
  .flatMap((k) => (Array.isArray(researchFiles[k].default) ? researchFiles[k].default! : []));

export const DATA_KEY = 'family-tree:data:v1';
export const DECISIONS_KEY = 'family-tree:review';

/** The tree as edited in this browser by the local prototype, if any. */
export function localSavedData(): FamilyData | null {
  try {
    const raw = localStorage.getItem(DATA_KEY);
    return raw ? (JSON.parse(raw) as FamilyData) : null;
  } catch {
    return null;
  }
}

export function localSavedDecisions(): Record<string, DecisionRecord> {
  try {
    return JSON.parse(localStorage.getItem(DECISIONS_KEY) ?? '{}');
  } catch {
    return {};
  }
}
