import type { FamilyGraph } from './graph';

/**
 * Layout of a whole family (every person, not just one person's ancestors and descendants),
 * for the exported diagram. One row per generation; couples side by side; rows ordered so
 * children sit under their parents (a few barycenter sweeps), then nudged toward their parents.
 */

export const D_W = 150;
export const D_H = 56;
const GAP = 18;
const UNIT = D_W + GAP;
export const D_ROW = 140;
const MARGIN = 40;

export interface FullLayout {
  nodes: { id: string; x: number; y: number }[];
  links: { points: [number, number][]; kind: 'parent' | 'partner' }[];
  width: number;
  height: number;
}

interface Block { ids: string[]; x: number }

const width = (b: Block) => b.ids.length * UNIT - GAP;

export function layoutEveryone(graph: FamilyGraph, ids: Set<string>, startId?: string): FullLayout {
  // ---- generations, per connected group of people ----
  const gen = new Map<string, number>();
  const groups: string[][] = [];
  const starts = startId && ids.has(startId) ? [startId, ...ids] : [...ids];
  for (const s of starts) {
    if (gen.has(s)) continue;
    const group: string[] = [];
    const queue = [s];
    gen.set(s, 0);
    while (queue.length) {
      const id = queue.shift()!;
      group.push(id);
      const g = gen.get(id)!;
      const visit = (o: string, ng: number) => {
        if (ids.has(o) && !gen.has(o)) {
          gen.set(o, ng);
          queue.push(o);
        }
      };
      graph.parents(id).forEach((p) => visit(p.id, g - 1));
      graph.partners(id).forEach((p) => visit(p.id, g));
      graph.children(id).forEach((c) => visit(c.id, g + 1));
    }
    groups.push(group);
  }
  groups.sort((a, b) => b.length - a.length);

  const pos = new Map<string, { x: number; y: number }>();
  let offset = MARGIN;
  for (const group of groups) {
    const minG = Math.min(...group.map((id) => gen.get(id)!));
    const rowIds: string[][] = [];
    for (const id of group) (rowIds[gen.get(id)! - minG] ??= []).push(id);

    // couples (and chains of marriages) stay together as one block
    const rows: Block[][] = rowIds.map((row) => {
      const inRow = new Set(row);
      const seen = new Set<string>();
      const blocks: Block[] = [];
      for (const id of row) {
        if (seen.has(id)) continue;
        seen.add(id);
        const chain: string[] = [];
        const stack = graph.partners(id).map((p) => p.id);
        while (stack.length) {
          const p = stack.shift()!;
          if (seen.has(p) || !inRow.has(p)) continue;
          seen.add(p);
          chain.push(p);
          stack.push(...graph.partners(p).map((q) => q.id));
        }
        blocks.push({ ids: chain.length >= 2 ? [chain[0], id, ...chain.slice(1)] : [id, ...chain], x: 0 });
      }
      return blocks;
    });

    const blockOf = new Map<string, Block>();
    rows.forEach((r) => r.forEach((b) => b.ids.forEach((id) => blockOf.set(id, b))));
    const cx = (id: string) => {
      const b = blockOf.get(id)!;
      return b.x + b.ids.indexOf(id) * UNIT + D_W / 2;
    };
    const pack = (r: Block[]) => {
      let x = 0;
      for (const b of r) {
        b.x = x;
        x += width(b) + GAP * 3;
      }
    };
    rows.forEach(pack);

    const rowOf = (id: string) => gen.get(id)! - minG;
    const relatives = (b: Block, dir: -1 | 1) => {
      const r = rowOf(b.ids[0]) + dir;
      return b.ids.flatMap((id) => (dir < 0 ? graph.parents(id) : graph.children(id)))
        .map((p) => p.id)
        .filter((p) => blockOf.has(p) && rowOf(p) === r);
    };
    const center = (b: Block) => b.x + width(b) / 2;
    const avg = (list: string[]) => list.reduce((a, id) => a + cx(id), 0) / list.length;

    // ---- order inside each row: barycenter sweeps down and up ----
    const sweep = (r: number, dir: -1 | 1) => {
      const keyed = rows[r].map((b) => {
        const rel = relatives(b, dir);
        return { b, k: rel.length ? avg(rel) : center(b) };
      });
      keyed.sort((a, b) => a.k - b.k);
      rows[r] = keyed.map((x) => x.b);
      pack(rows[r]);
    };
    for (let it = 0; it < 6; it++) {
      for (let r = 1; r < rows.length; r++) sweep(r, -1);
      for (let r = rows.length - 2; r >= 0; r--) sweep(r, 1);
    }

    // ---- positions: move blocks toward their relatives without overlapping ----
    const place = (r: number, dir: -1 | 1) => {
      const row = rows[r];
      const want = row.map((b) => {
        const rel = relatives(b, dir);
        return rel.length ? avg(rel) - width(b) / 2 : b.x;
      });
      let end = -Infinity;
      row.forEach((b, i) => {
        b.x = Math.max(want[i], end + GAP * 3);
        end = b.x + width(b);
      });
      for (let i = row.length - 2; i >= 0; i--) {
        const b = row[i];
        if (b.x > want[i]) b.x = Math.max(want[i], Math.min(b.x, row[i + 1].x - GAP * 3 - width(b)));
      }
      end = -Infinity;
      for (const b of row) {
        b.x = Math.max(b.x, end + GAP * 3);
        end = b.x + width(b);
      }
    };
    for (let r = 1; r < rows.length; r++) place(r, -1);
    for (let r = rows.length - 2; r >= 0; r--) place(r, 1);
    for (let r = 1; r < rows.length; r++) place(r, -1);

    let minX = Infinity;
    let maxX = -Infinity;
    for (const r of rows) for (const b of r) {
      minX = Math.min(minX, b.x);
      maxX = Math.max(maxX, b.x + width(b));
    }
    for (const id of group) pos.set(id, { x: cx(id) - minX + offset, y: MARGIN + D_H / 2 + rowOf(id) * D_ROW });
    offset += maxX - minX + UNIT * 2;
  }

  // ---- lines ----
  const links: FullLayout['links'] = [];
  // each family's bar to its children gets its own height where bars of one row would overlap
  type Bar = { sx: number; sy: number; kids: { x: number; y: number }[]; left: number; right: number; lane: number };
  const bars: Bar[] = [];
  for (const u of Object.values(graph.unions)) {
    const ps = u.partners.filter((p) => pos.has(p)).map((p) => pos.get(p)!);
    const kids = u.children.filter((c) => pos.has(c)).map((c) => pos.get(c)!);
    let sx: number;
    let sy: number;
    if (ps.length === 2 && ps[0].y === ps[1].y) {
      const [a, b] = ps[0].x < ps[1].x ? ps : [ps[1], ps[0]];
      links.push({ kind: 'partner', points: [[a.x + D_W / 2, a.y], [b.x - D_W / 2, b.y]] });
      sx = (a.x + b.x) / 2;
      sy = a.y;
    } else if (ps.length) {
      sx = ps[0].x;
      sy = ps[0].y + D_H / 2;
    } else continue;
    if (!kids.length) continue;
    const xs = [sx, ...kids.map((c) => c.x)];
    bars.push({ sx, sy, kids, left: Math.min(...xs), right: Math.max(...xs), lane: 0 });
  }
  const byRow = new Map<number, Bar[]>();
  for (const b of bars) {
    const y = Math.min(...b.kids.map((c) => c.y));
    byRow.set(y, [...(byRow.get(y) ?? []), b]);
  }
  for (const row of byRow.values()) {
    row.sort((a, b) => a.left - b.left);
    const laneEnd: number[] = [];
    for (const b of row) {
      let lane = laneEnd.findIndex((end) => end < b.left - 12);
      if (lane < 0) lane = laneEnd.length;
      laneEnd[lane] = b.right;
      b.lane = lane;
    }
    const lanes = laneEnd.length;
    const step = Math.min(12, (D_ROW - D_H - 24) / Math.max(1, lanes));
    for (const b of row) b.lane = (b.lane - (lanes - 1) / 2) * step;
  }
  for (const b of bars) {
    for (const c of b.kids) {
      const mid = c.y - D_H / 2 - (D_ROW - D_H) / 2 + b.lane;
      links.push({ kind: 'parent', points: [[b.sx, b.sy], [b.sx, mid], [c.x, mid], [c.x, c.y - D_H / 2]] });
    }
  }

  const nodes = [...pos.entries()].map(([id, p]) => ({ id, ...p }));
  const W = Math.max(...nodes.map((n) => n.x), 0) + D_W / 2 + MARGIN;
  const H = Math.max(...nodes.map((n) => n.y), 0) + D_H / 2 + MARGIN;
  return { nodes, links, width: W, height: H };
}
