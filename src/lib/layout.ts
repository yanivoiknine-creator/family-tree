import { hierarchy, tree, type HierarchyPointNode } from 'd3-hierarchy';
import type { Person, Side } from '../types';
import type { FamilyGraph } from './graph';

export const CARD_W = 176;
export const CARD_H = 84;
const GAP_X = 26;
const UNIT = CARD_W + GAP_X;
export const ROW_H = CARD_H + 74;

export type NodeRole = 'focus' | 'ancestor' | 'sibling' | 'partner' | 'descendant' | 'descPartner';

export interface LayoutNode {
  key: string;
  id: string;
  x: number;
  y: number;
  role: NodeRole;
  half?: boolean;
  divorced?: boolean;
}

export interface LayoutLink {
  key: string;
  points: [number, number][];
  kind: 'parent' | 'partner' | 'sibling';
  dashed?: boolean;
}

export interface Layout {
  nodes: LayoutNode[];
  links: LayoutLink[];
}

export interface LayoutOptions {
  up: number;
  down: number;
  side: Side;
  /** In RTL the father's side is drawn on the right, in LTR on the left */
  rtl: boolean;
}

const byBirth = (a: Person, b: Person) => (a.birth?.date ?? '9999').localeCompare(b.birth?.date ?? '9999');

/**
 * "Hourglass" layout around one person:
 * ancestors above, descendants below, siblings and partners in the same row.
 * Coordinates are logical (father side = +x) and mirrored for LTR at the end.
 */
export function layoutTree(graph: FamilyGraph, focusId: string, opts: LayoutOptions): Layout {
  const nodes: LayoutNode[] = [];
  const links: LayoutLink[] = [];
  const used = new Map<string, number>();
  const keyFor = (id: string) => {
    const n = used.get(id) ?? 0;
    used.set(id, n + 1);
    return n === 0 ? id : `${id}#${n}`;
  };
  const focus = graph.get(focusId);
  if (!focus) return { nodes, links };

  nodes.push({ key: keyFor(focusId), id: focusId, x: 0, y: 0, role: 'focus' });

  /* ---- Ancestors ---- */
  type ANode = { id: string; depth: number };
  const ancRoot = hierarchy<ANode>({ id: focusId, depth: 0 }, (d) => {
    if (d.depth >= opts.up) return null;
    let parents = [graph.father(d.id), graph.mother(d.id)].filter(Boolean) as Person[];
    if (d.depth === 0 && opts.side !== 'all') {
      const keep = opts.side === 'father' ? graph.father(d.id) : graph.mother(d.id);
      parents = keep ? [keep] : [];
    }
    return parents.map((p) => ({ id: p.id, depth: d.depth + 1 }));
  });
  const ancLaid = tree<ANode>().nodeSize([UNIT, ROW_H]).separation((a, b) => (a.parent === b.parent ? 1 : 1.12))(ancRoot);
  const ancPos = new Map<HierarchyPointNode<ANode>, [number, number]>();
  ancLaid.each((n) => ancPos.set(n, [-n.x, -n.depth * ROW_H]));
  ancLaid.each((n) => {
    if (n.depth === 0) return;
    const [x, y] = ancPos.get(n)!;
    nodes.push({ key: keyFor(n.data.id), id: n.data.id, x, y, role: 'ancestor' });
    const [cx, cy] = ancPos.get(n.parent!)!;
    const mid = cy - ROW_H / 2;
    links.push({
      key: `a:${n.data.id}:${n.parent!.data.id}`,
      kind: 'parent',
      points: [[cx, cy - CARD_H / 2], [cx, mid], [x, mid], [x, y + CARD_H / 2]],
    });
  });
  const hasParentsShown = (ancLaid.children?.length ?? 0) > 0;

  /* ---- Partners: one on each side; with 3+, all earlier ones share a side ---- */
  // Side +1 is the father's side (right in RTL), side -1 the mother's side.
  //  • 1 partner  → mother's side
  //  • 2 partners → the earlier on the father's side, the later on the mother's side
  //  • 3+         → the current (latest, not divorced) on the mother's side, all others on the
  //                 father's side in time order — the earliest farthest out, so reading in the
  //                 page's direction goes from the first marriage to the current one.
  // The line between card k-1 and card k on a side stands for relationship k,
  // so that relationship's children hang from the middle of that line.
  const focusUnions = graph.unionsOf(focusId); // already chronological
  const unionAnchor = new Map<string, [number, number]>(); // union id -> where its children's line starts
  const withPartner: { u: (typeof focusUnions)[number]; pid: string }[] = [];
  const seenPartner = new Map<string, string>(); // partner id -> first union id
  const repeats: [string, string][] = []; // [union id, first union id with the same partner]
  for (const u of focusUnions) {
    const pid = u.partners.find((p) => p !== focusId);
    if (!pid) unionAnchor.set(u.id, [0, CARD_H / 2]); // single parent: straight down from the card
    else if (seenPartner.has(pid)) repeats.push([u.id, seenPartner.get(pid)!]);
    else {
      seenPartner.set(pid, u.id);
      withPartner.push({ u, pid });
    }
  }
  let fatherSide: typeof withPartner = [];
  let motherSide: typeof withPartner = [];
  if (withPartner.length === 1) motherSide = withPartner;
  else if (withPartner.length === 2) [fatherSide, motherSide] = [[withPartner[0]], [withPartner[1]]];
  else if (withPartner.length > 2) {
    const current = [...withPartner].reverse().find((x) => !x.u.divorced);
    motherSide = current ? [current] : [];
    fatherSide = withPartner.filter((x) => x !== current);
  }
  // order each side from the focus outward: the father's side starts with the most recent
  const placeSide = (list: typeof withPartner, s: 1 | -1) => {
    list.forEach(({ u, pid }, i) => {
      const x = s * (i + 1) * UNIT;
      const prevX = s * i * UNIT;
      unionAnchor.set(u.id, [(prevX + x) / 2, 0]);
      nodes.push({ key: keyFor(pid), id: pid, x, y: 0, role: 'partner', divorced: u.divorced });
      links.push({ key: `p:${pid}`, kind: 'partner', points: [[prevX + (s * CARD_W) / 2, 0], [x - (s * CARD_W) / 2, 0]], dashed: u.divorced });
    });
  };
  placeSide([...fatherSide].reverse(), 1);
  placeSide(motherSide, -1);
  for (const [uid, first] of repeats) unionAnchor.set(uid, unionAnchor.get(first) ?? [0, CARD_H / 2]);
  const childUnion = new Map<string, string>(); // focus's child id -> union id
  for (const u of focusUnions) for (const c of u.children) childUnion.set(c, u.id);

  /* ---- Siblings: beyond the partners, on the side with fewer partners ---- */
  const siblings = graph.siblings(focusId).sort(byBirth);
  if (siblings.length) {
    const s: 1 | -1 = fatherSide.length <= motherSide.length ? 1 : -1;
    const offset = s === 1 ? fatherSide.length : motherSide.length;
    const mid = -ROW_H / 2;
    siblings.forEach((sib, i) => {
      const x = s * (offset + i + 1) * UNIT;
      const half = !graph.isFullSibling(sib.id, focusId);
      nodes.push({ key: keyFor(sib.id), id: sib.id, x, y: 0, role: 'sibling', half });
      links.push({ key: `s:${sib.id}`, kind: 'sibling', points: [[x, mid], [x, -CARD_H / 2]], dashed: half });
    });
    links.push({ key: 's:bar', kind: 'sibling', points: [[0, mid], [s * (offset + siblings.length) * UNIT, mid]] });
    // when the parents are hidden (side filter), the focus still needs its stub up to the bar
    if (!hasParentsShown) links.push({ key: 's:focus', kind: 'sibling', points: [[0, mid], [0, -CARD_H / 2]] });
  }

  /* ---- Descendants ---- */
  type DNode = { id: string; depth: number; partner?: string };
  const firstPartner = (id: string) => graph.partners(id)[0]?.id;
  // children grouped by relationship (first marriage first), then by birth
  const kidsOf = (id: string) => {
    const seen = new Set<string>();
    return graph.unionsOf(id).flatMap((u) =>
      u.children
        .map((c) => graph.people[c])
        .filter((p) => p && !seen.has(p.id) && seen.add(p.id))
        .sort(byBirth),
    );
  };
  const descRoot = hierarchy<DNode>({ id: focusId, depth: 0 }, (d) => {
    if (d.depth >= opts.down) return null;
    return kidsOf(d.id).map((k) => ({ id: k.id, depth: d.depth + 1, partner: firstPartner(k.id) }));
  });
  const span = (n: { data: DNode }) => (n.data.depth > 0 && n.data.partner ? 2 : 1);
  const descLaid = tree<DNode>()
    .nodeSize([UNIT, ROW_H])
    .separation((a, b) => (span(a) + span(b)) / 2 + (a.parent === b.parent ? 0 : 0.15))(descRoot);
  // center the children row under the relationships that have children
  const anchorsWithKids = focusUnions.filter((u) => u.children.length && unionAnchor.has(u.id)).map((u) => unionAnchor.get(u.id)![0]);
  const rootShift = anchorsWithKids.length ? anchorsWithKids.reduce((a, b) => a + b, 0) / anchorsWithKids.length : 0;
  // where the line down to children starts, per node
  const cardX = new Map<HierarchyPointNode<DNode>, number>();
  descLaid.each((n) => {
    const center = -n.x + rootShift;
    if (n.depth === 0) return;
    const hasP = span(n) === 2;
    const x = hasP ? center + UNIT / 2 : center;
    cardX.set(n, x);
    const y = n.depth * ROW_H;
    nodes.push({ key: keyFor(n.data.id), id: n.data.id, x, y, role: 'descendant' });
    if (hasP) {
      const px = center - UNIT / 2;
      nodes.push({ key: keyFor(n.data.partner!), id: n.data.partner!, x: px, y, role: 'descPartner' });
      links.push({ key: `dp:${n.data.id}`, kind: 'partner', points: [[x - CARD_W / 2, y], [px + CARD_W / 2, y]] });
    }
  });
  descLaid.each((n) => {
    if (!n.parent) return;
    const p = n.parent;
    let sx: number, sy: number;
    if (p.depth === 0) {
      [sx, sy] = unionAnchor.get(childUnion.get(n.data.id) ?? '') ?? [0, CARD_H / 2];
    } else if (span(p) === 2) {
      sx = -p.x + rootShift;
      sy = p.depth * ROW_H;
    } else {
      sx = cardX.get(p)!;
      sy = p.depth * ROW_H + CARD_H / 2;
    }
    const cx = cardX.get(n)!;
    const cy = n.depth * ROW_H;
    const mid = cy - ROW_H / 2;
    links.push({ key: `d:${n.data.id}:${p.data.id}`, kind: 'parent', points: [[sx, sy], [sx, mid], [cx, mid], [cx, cy - CARD_H / 2]] });
  });

  /* ---- Mirror for LTR ---- */
  if (!opts.rtl) {
    for (const n of nodes) n.x = -n.x;
    for (const l of links) for (const pt of l.points) pt[0] = -pt[0];
  }
  return { nodes, links };
}
