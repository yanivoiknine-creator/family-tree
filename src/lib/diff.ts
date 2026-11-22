import type { FamilyData, Person, Union } from '../types';

/** A change to the family data: for every touched record, what it was and what it becomes (null = absent). */
export interface Change {
  people: Record<string, { before: Person | null; after: Person | null }>;
  unions: Record<string, { before: Union | null; after: Union | null }>;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

function diffMap<T>(a: Record<string, T>, b: Record<string, T>) {
  const out: Record<string, { before: T | null; after: T | null }> = {};
  for (const id of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (!same(a[id], b[id])) out[id] = { before: a[id] ?? null, after: b[id] ?? null };
  }
  return out;
}

export function diffData(a: FamilyData, b: FamilyData): Change {
  return { people: diffMap(a.people, b.people), unions: diffMap(a.unions, b.unions) };
}

export const isEmptyChange = (c: Change) => !Object.keys(c.people).length && !Object.keys(c.unions).length;

/** The top-level fields that differ between two versions of a record. */
export function changedKeys<T extends object>(before: T | null, after: T | null): string[] {
  const b = (before ?? {}) as Record<string, unknown>;
  const a = (after ?? {}) as Record<string, unknown>;
  return [...new Set([...Object.keys(b), ...Object.keys(a)])].filter((k) => k !== 'id' && !same(b[k], a[k]));
}

/**
 * Apply a change onto the *current* data. Only the fields that the suggester actually
 * changed are written, so edits made meanwhile to other fields are kept.
 */
export function applyChange(data: FamilyData, change: Change): FamilyData {
  const merge = <T extends object>(map: Record<string, T>, entries: Record<string, { before: T | null; after: T | null }>) => {
    const next = { ...map };
    for (const [id, { before, after }] of Object.entries(entries)) {
      if (!after) {
        delete next[id];
        continue;
      }
      const cur = next[id];
      if (!cur || !before) {
        next[id] = after;
        continue;
      }
      const merged = { ...cur } as Record<string, unknown>;
      for (const k of changedKeys(before, after)) {
        const v = (after as Record<string, unknown>)[k];
        const was = (before as Record<string, unknown>)[k];
        const now = merged[k];
        if (Array.isArray(v) && Array.isArray(was) && Array.isArray(now)) {
          // lists (children ids, facts, documents): replay the additions and removals only.
          // Items are compared by id or content, since they come from separately parsed JSON.
          const key = (x: unknown) =>
            x && typeof x === 'object' ? ((x as { id?: string }).id ?? JSON.stringify(x)) : String(x);
          const has = (list: unknown[], x: unknown) => list.some((y) => key(y) === key(x));
          const removed = was.filter((x) => !has(v, x));
          const added = v.filter((x) => !has(was, x));
          // an item edited in place (same id, new content) replaces the current one
          const edited = new Map(v.filter((x) => has(was, x) && !same(x, was.find((y) => key(y) === key(x)))).map((x) => [key(x), x]));
          merged[k] = [
            ...now.filter((x) => !has(removed, x)).map((x) => edited.get(key(x)) ?? x),
            ...added.filter((x) => !has(now, x)),
          ];
        } else if (v === undefined) delete merged[k];
        else merged[k] = v;
      }
      next[id] = merged as T;
    }
    return next;
  };
  return { people: merge(data.people, change.people), unions: merge(data.unions, change.unions) };
}
