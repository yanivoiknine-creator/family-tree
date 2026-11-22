import type { FamilyData, Finding, Person, Union } from '../types';

/** Pure, immutable edits on the family data. The UI calls these, then persists the result. */

export const newId = (prefix: string) => `${prefix}${crypto.randomUUID().slice(0, 8)}`;

export type RelativeKind = 'parent' | 'partner' | 'child' | 'sibling';

export function upsertPerson(data: FamilyData, person: Person): FamilyData {
  return { ...data, people: { ...data.people, [person.id]: person } };
}

function putUnion(data: FamilyData, union: Union): FamilyData {
  return { ...data, unions: { ...data.unions, [union.id]: union } };
}

const parentUnionOf = (data: FamilyData, id: string) => Object.values(data.unions).find((u) => u.children.includes(id));

/**
 * Add `person` as a relative of `anchorId`.
 * For a child, `unionId` picks which relationship the child belongs to ('' = single parent).
 */
export function addRelative(
  data: FamilyData,
  anchorId: string,
  kind: RelativeKind,
  person: Person,
  unionId?: string,
  details?: UnionDetails,
): FamilyData {
  let next = upsertPerson(data, person);
  switch (kind) {
    case 'parent': {
      const u = parentUnionOf(next, anchorId);
      if (u) {
        if (u.partners.length >= 2) throw new Error('already has two parents');
        return putUnion(next, { ...u, partners: [...u.partners, person.id] });
      }
      return putUnion(next, { id: newId('U'), partners: [person.id], children: [anchorId], kind: 'married' });
    }
    case 'partner':
      return putUnion(next, { id: newId('U'), partners: [anchorId, person.id], children: [], kind: 'married', ...details });
    case 'child': {
      const existing = unionId ? next.unions[unionId] : undefined;
      if (existing) return putUnion(next, { ...existing, children: [...existing.children, person.id] });
      const single = Object.values(next.unions).find((u) => u.partners.length === 1 && u.partners[0] === anchorId);
      if (single) return putUnion(next, { ...single, children: [...single.children, person.id] });
      return putUnion(next, { id: newId('U'), partners: [anchorId], children: [person.id], kind: 'married' });
    }
    case 'sibling': {
      const u = parentUnionOf(next, anchorId);
      if (u) return putUnion(next, { ...u, children: [...u.children, person.id] });
      next = putUnion(next, { id: newId('U'), partners: [], children: [anchorId, person.id], kind: 'married' });
      return next;
    }
  }
}

export function updateUnion(data: FamilyData, union: Union): FamilyData {
  return putUnion(data, union);
}

/** Remove a relationship. Children stay in the tree but lose this pair as parents. */
export function deleteUnion(data: FamilyData, id: string): FamilyData {
  const unions = { ...data.unions };
  delete unions[id];
  return { ...data, unions };
}

export type UnionDetails = Pick<Union, 'kind' | 'divorced' | 'marriage' | 'divorce'>;

export function deletePerson(data: FamilyData, id: string): FamilyData {
  const people = { ...data.people };
  delete people[id];
  const unions: Record<string, Union> = {};
  for (const u of Object.values(data.unions)) {
    const nu = { ...u, partners: u.partners.filter((p) => p !== id), children: u.children.filter((c) => c !== id) };
    // drop unions that no longer connect at least two people
    if (nu.partners.length + nu.children.length >= 2) unions[u.id] = nu;
  }
  return { people, unions };
}

/** Write an approved research finding into the tree. */
export function applyFinding(data: FamilyData, f: Finding): FamilyData {
  const person = data.people[f.personId];
  if (!person) throw new Error('person not found');
  if (f.type === 'newPerson') {
    const v = (f.value ?? {}) as Partial<Person>;
    const np: Person = { ...blankPerson(), ...v, id: newId('P'), deceased: Boolean(v.deceased) };
    const anchorUnions = Object.values(data.unions).filter((u) => u.partners.includes(f.personId));
    if (f.relation === 'partner') {
      // Children approved before the partner sit in a single-parent union: the partner joins it.
      const lone = anchorUnions.find((u) => u.partners.length === 1 && u.children.length > 0);
      if (lone) return putUnion(upsertPerson(data, np), { ...lone, partners: [f.personId, np.id] });
    }
    if (f.relation === 'child') {
      // With exactly one couple, the child belongs to that couple.
      const couples = anchorUnions.filter((u) => u.partners.length === 2);
      if (couples.length === 1) return addRelative(data, f.personId, 'child', np, couples[0].id);
    }
    return addRelative(data, f.personId, f.relation ?? 'child', np);
  }
  const p: Person = structuredClone(person);
  const field = f.field ?? '';
  const value = f.value;
  if (field === 'fact') {
    p.facts = [...(p.facts ?? []), value as { label: string; value: string }];
  } else if (field === 'bio') {
    p.bio = p.bio ? `${p.bio}\n\n${String(value)}` : String(value);
  } else if (field === 'photo') {
    p.photo = String(value);
  } else if (field.includes('.')) {
    const [group, key] = field.split('.') as ['birth' | 'death' | 'burial', string];
    const ev = { ...(p[group] ?? {}) } as Record<string, unknown>;
    ev[key] = value;
    (p as unknown as Record<string, unknown>)[group] = ev;
    if (group === 'death' || group === 'burial') p.deceased = true;
  } else {
    (p as unknown as Record<string, unknown>)[field] = value;
  }
  return upsertPerson(data, p);
}

export function blankPerson(): Person {
  return { id: newId('P'), firstName: '', lastName: '', sex: 'U', deceased: false };
}
