import type { Person, Sex } from '../types';
import type { FamilyGraph } from './graph';

/** P = step to a parent, C = step to a child, S = step to a partner */
type Step = 'P' | 'C' | 'S';
const COST: Record<Step, number> = { P: 1, C: 1, S: 1.5 };

export type PartnerStatus = 'married' | 'partners' | 'divorced';

/**
 * Blood relationship: `a` generations up to the common ancestor, `b` down to the target.
 * s1/s2 are the sexes of intermediate people some languages need
 * (e.g. Hebrew "בן דודה" depends on the parent's sibling being female).
 */
export interface BloodRel {
  k: 'blood';
  a: number;
  b: number;
  half?: boolean;
  s1?: Sex;
  s2?: Sex;
}

export type RelKind =
  | { k: 'self' }
  | { k: 'partner'; status: PartnerStatus }
  | { k: 'parentInLaw' }
  | { k: 'childInLaw' }
  | { k: 'siblingInLaw' }
  | { k: 'stepParent' }
  | { k: 'stepChild' }
  | { k: 'stepSibling' }
  | { k: 'auntUncleByMarriage' }
  | BloodRel
  | { k: 'ofPartner'; inner: BloodRel; partnerSex: Sex; status: PartnerStatus }
  | { k: 'partnerOf'; inner: BloodRel; innerSex: Sex }
  | { k: 'relative' };

export interface Relation {
  kind: RelKind;
  /** sex of the person being described */
  sex: Sex;
  /** sex of the viewer (Hebrew in-law words depend on it) */
  viewerSex: Sex;
  /** For relatives reached through a parent: which side of the family */
  side?: 'father' | 'mother';
  distance: number;
}

export class RelationFinder {
  private prev = new Map<string, { from: string; step: Step }>();
  private dist = new Map<string, number>();

  constructor(private graph: FamilyGraph, private viewerId: string) {
    this.run();
  }

  /** Single-source shortest paths from the viewer over parent/child/partner links. */
  private run() {
    const { graph, viewerId } = this;
    if (!graph.get(viewerId)) return;
    this.dist.set(viewerId, 0);
    const done = new Set<string>();
    for (;;) {
      let cur: string | undefined;
      let best = Infinity;
      for (const [id, d] of this.dist) if (!done.has(id) && d < best) { best = d; cur = id; }
      if (!cur) break;
      done.add(cur);
      const edges: [Person, Step][] = [
        ...graph.parents(cur).map((p) => [p, 'P'] as [Person, Step]),
        ...graph.children(cur).map((p) => [p, 'C'] as [Person, Step]),
        ...graph.partners(cur).map((p) => [p, 'S'] as [Person, Step]),
      ];
      for (const [next, step] of edges) {
        const nd = best + COST[step];
        if (nd < (this.dist.get(next.id) ?? Infinity)) {
          this.dist.set(next.id, nd);
          this.prev.set(next.id, { from: cur, step });
        }
      }
    }
  }

  private path(targetId: string): { steps: Step[]; nodes: Person[] } | undefined {
    if (!this.dist.has(targetId)) return undefined;
    const steps: Step[] = [];
    const nodes: Person[] = [this.graph.people[targetId]];
    let cur = targetId;
    while (cur !== this.viewerId) {
      const p = this.prev.get(cur)!;
      steps.unshift(p.step);
      nodes.unshift(this.graph.people[p.from]);
      cur = p.from;
    }
    return { steps, nodes };
  }

  get(targetId: string): Relation | undefined {
    const found = this.path(targetId);
    if (!found) return undefined;
    const { steps, nodes } = found;
    const target = nodes[nodes.length - 1];
    const side = steps[0] === 'P' ? (nodes[1].sex === 'F' ? 'mother' : 'father') : undefined;
    return {
      kind: this.classify(steps, nodes),
      sex: target.sex,
      viewerSex: nodes[0].sex,
      side,
      distance: this.dist.get(targetId)!,
    };
  }

  private status(a: Person, b: Person): PartnerStatus {
    const union = this.graph.unionsOf(a.id).find((u) => u.partners.includes(b.id));
    if (union?.divorced) return 'divorced';
    return union?.kind === 'partners' ? 'partners' : 'married';
  }

  private classify(steps: Step[], nodes: Person[]): RelKind {
    const key = steps.join('');
    switch (key) {
      case '': return { k: 'self' };
      case 'S': return { k: 'partner', status: this.status(nodes[0], nodes[1]) };
      case 'SP': return { k: 'parentInLaw' };
      case 'CS': return { k: 'childInLaw' };
      case 'SPC':
      case 'PCS':
      case 'SPCS': return { k: 'siblingInLaw' };
      case 'PS': return { k: 'stepParent' };
      case 'PSC': return { k: 'stepSibling' };
      case 'SC': return { k: 'stepChild' };
      case 'PPCS': return { k: 'auntUncleByMarriage' };
    }
    const sCount = steps.filter((s) => s === 'S').length;
    if (sCount === 0) return this.blood(steps, nodes) ?? { k: 'relative' };
    if (sCount === 1 && steps[0] === 'S') {
      const inner = this.blood(steps.slice(1), nodes.slice(1));
      if (inner) return { k: 'ofPartner', inner, partnerSex: nodes[1].sex, status: this.status(nodes[0], nodes[1]) };
    }
    if (sCount === 1 && steps[steps.length - 1] === 'S') {
      const inner = this.blood(steps.slice(0, -1), nodes.slice(0, -1));
      if (inner) return { k: 'partnerOf', inner, innerSex: nodes[nodes.length - 2].sex };
    }
    return { k: 'relative' };
  }

  /** steps must look like P^a C^b. nodes[0] = start, nodes[a+b] = target. */
  private blood(steps: Step[], nodes: Person[]): BloodRel | undefined {
    const a = steps.findIndex((s) => s !== 'P') === -1 ? steps.length : steps.findIndex((s) => s !== 'P');
    if (steps.slice(a).some((s) => s !== 'C')) return undefined;
    const b = steps.length - a;
    const rel: BloodRel = { k: 'blood', a, b };
    if (a >= 1 && b >= 1) {
      // nodes[a] is the common ancestor; nodes[a-1] is on the viewer's line just below it,
      // nodes[a+1] is that person's sibling on the target's line.
      const sib = nodes[a + 1];
      const onLine = nodes[a - 1];
      rel.half = !this.graph.isFullSibling(sib.id, onLine.id);
      rel.s1 = sib.sex; // the sibling / aunt / uncle
      if (a === 2) rel.s2 = nodes[a + 2]?.sex; // the cousin we descend through
      if (a >= 3) rel.s2 = onLine.sex; // the grandparent whose sibling this is
    }
    return rel;
  }
}
