import type { FamilyData, Person, Union } from '../types';

/** Fast lookups over the family data. Rebuilt whenever the data changes. */
export class FamilyGraph {
  readonly people: Record<string, Person>;
  readonly unions: Record<string, Union>;
  private parentUnion = new Map<string, Union>();
  private ownUnions = new Map<string, Union[]>();

  constructor(data: FamilyData) {
    this.people = data.people;
    this.unions = data.unions;
    for (const u of Object.values(data.unions)) {
      for (const c of u.children) this.parentUnion.set(c, u);
      for (const p of u.partners) {
        const list = this.ownUnions.get(p) ?? [];
        list.push(u);
        this.ownUnions.set(p, list);
      }
    }
    // Order relationships chronologically: by marriage date; without dates, a divorced one is assumed earlier.
    const order = (u: Union) => u.marriage?.date ?? (u.divorced ? '0000' : '9999');
    for (const list of this.ownUnions.values()) list.sort((a, b) => order(a).localeCompare(order(b)));
  }

  get(id: string | undefined): Person | undefined {
    return id ? this.people[id] : undefined;
  }

  /** The union this person was born into (their parents). */
  parentsUnion(id: string): Union | undefined {
    return this.parentUnion.get(id);
  }

  parents(id: string): Person[] {
    return (this.parentUnion.get(id)?.partners ?? []).map((p) => this.people[p]).filter(Boolean);
  }

  father(id: string): Person | undefined {
    const ps = this.parents(id);
    return ps.find((p) => p.sex === 'M') ?? (ps.length === 2 && ps[1].sex !== 'M' ? ps[0] : undefined);
  }

  mother(id: string): Person | undefined {
    const ps = this.parents(id);
    const dad = this.father(id);
    return ps.find((p) => p.sex === 'F') ?? ps.find((p) => p !== dad);
  }

  /** Unions in which this person is a partner (marriages / relationships). */
  unionsOf(id: string): Union[] {
    return this.ownUnions.get(id) ?? [];
  }

  partners(id: string): Person[] {
    const out: Person[] = [];
    for (const u of this.unionsOf(id)) {
      for (const p of u.partners) if (p !== id && this.people[p]) out.push(this.people[p]);
    }
    return out;
  }

  children(id: string): Person[] {
    const seen = new Set<string>();
    const out: Person[] = [];
    for (const u of this.unionsOf(id)) {
      for (const c of u.children) {
        if (!seen.has(c) && this.people[c]) {
          seen.add(c);
          out.push(this.people[c]);
        }
      }
    }
    return out;
  }

  /** Siblings, including half-siblings through either parent. */
  siblings(id: string): Person[] {
    const seen = new Set<string>([id]);
    const out: Person[] = [];
    const add = (cid: string) => {
      if (!seen.has(cid) && this.people[cid]) {
        seen.add(cid);
        out.push(this.people[cid]);
      }
    };
    const pu = this.parentUnion.get(id);
    if (!pu) return out;
    pu.children.forEach(add);
    for (const parent of pu.partners) for (const u of this.unionsOf(parent)) u.children.forEach(add);
    return out;
  }

  isFullSibling(a: string, b: string): boolean {
    const ua = this.parentUnion.get(a);
    return Boolean(ua && ua === this.parentUnion.get(b) && ua.partners.length === 2);
  }

  /**
   * How many people hang below this person in the tree: all descendants plus their partners.
   * Divorced partners are never counted. The person's own partner forms a couple with them and
   * is not counted — unless the person has children with more than one (non-divorced) partner:
   * then each of those partners heads a separate branch below the person and is counted.
   */
  branchSize(id: string): number {
    const cached = this.branchCache.get(id);
    if (cached !== undefined) return cached;
    const people = new Set<string>();
    const own = this.unionsOf(id);
    const parentPartners = new Set(
      own.filter((u) => u.children.length > 0 && !u.divorced).flatMap((u) => u.partners).filter((p) => p !== id && this.people[p]),
    );
    if (parentPartners.size > 1) parentPartners.forEach((p) => people.add(p));
    const stack = own.flatMap((u) => u.children);
    const visited = new Set<string>([id]);
    while (stack.length) {
      const cur = stack.pop()!;
      if (visited.has(cur) || !this.people[cur]) continue;
      visited.add(cur);
      people.add(cur);
      for (const u of this.unionsOf(cur)) {
        if (!u.divorced) for (const p of u.partners) if (p !== cur && p !== id && this.people[p]) people.add(p);
        stack.push(...u.children);
      }
    }
    this.branchCache.set(id, people.size);
    return people.size;
  }
  private branchCache = new Map<string, number>();

  /** All ancestors of `id` (not including id). */
  ancestors(id: string): Set<string> {
    const out = new Set<string>();
    const stack = [id];
    while (stack.length) {
      const cur = stack.pop()!;
      for (const p of this.parents(cur)) {
        if (!out.has(p.id)) {
          out.add(p.id);
          stack.push(p.id);
        }
      }
    }
    return out;
  }
}
