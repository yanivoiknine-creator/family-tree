import { useEffect, useMemo, useState } from 'react';
import type { Decision, FamilyData, Finding, Side } from '../types';
import { FamilyGraph } from '../lib/graph';
import type { RelationFinder } from '../lib/relation';
import { applyFinding } from '../lib/ops';
import { displayName, lifeSpan } from '../lib/i18n';
import { useLang } from '../lib/LangContext';
import { TreeView } from './TreeView';
import { FilterChips } from './MobileChrome';
import { FindingCard } from './ReviewPage';
import { Avatar } from './Avatar';
import { Icon } from './Icons';
import { flag, gens, hashParams, oneOf, pick, recall, remember, setHash, showGens } from '../lib/urlState';
import { ALL_GENS } from './MobileChrome';

/** address keys of the research tree (cleared by App when it is not shown) */
export const RTREE_KEYS = ['rp', 'rf', 'ts', 'tu', 'td', 'tw', 'tl', 'tg'];

interface Props {
  data: FamilyData;
  graph: FamilyGraph;
  findings: Finding[];
  decisions: Record<string, Decision>;
  resolveId: (personId: string) => string | undefined;
  relations?: RelationFinder;
  viewerId: string;
  /** decides and returns the ids of people an approval created */
  onDecideMany: (findings: Finding[], decision: Decision | undefined) => string[];
  onShowPerson: (id: string) => void;
}

const CONF_ORDER = { high: 0, medium: 1, low: 2 };

/**
 * The research tree: the family tree with every pending suggestion on its person.
 * A gold number = suggestions waiting; a dashed card = a person research proposes to add,
 * drawn where they would go. Pick a card to approve or reject its suggestions on the spot.
 */
export function ResearchTree({ data, graph, findings, decisions, resolveId, relations, viewerId, onDecideMany, onShowPerson }: Props) {
  const { lang, t } = useLang();
  // from the link, else as last left in this browser
  const [start] = useState(() => {
    const l = hashParams();
    const m = recall<{ side: Side; up: number; down: number; onlyWith: boolean; leaves: boolean; ghosts: boolean }>('rtree');
    const focus = l.get('rf') && graph.get(l.get('rf')!) ? l.get('rf')! : graph.get(viewerId) ? viewerId : Object.keys(graph.people)[0] ?? '';
    return {
      focus,
      sel: l.get('rp') ?? focus,
      side: pick(oneOf<Side>('all', 'father', 'mother')(l.get('ts')), m.side, 'all'),
      up: pick(gens(ALL_GENS)(l.get('tu')), m.up, 4),
      down: pick(gens(ALL_GENS)(l.get('td')), m.down, 2),
      onlyWith: pick(flag(l.get('tw')), m.onlyWith, false),
      leaves: pick(flag(l.get('tl')), m.leaves, true),
      ghosts: pick(flag(l.get('tg')), m.ghosts, true),
    };
  });
  const [focusId, setFocusId] = useState(start.focus);
  /** a person id, or "g:<finding id>" for a proposed person (their preview id changes on every rebuild) */
  const [sel, setSel] = useState<string | undefined>(start.sel);
  const [side, setSide] = useState<Side>(start.side);
  const [up, setUp] = useState(start.up);
  const [down, setDown] = useState(start.down);
  const [onlyWith, setOnlyWith] = useState(start.onlyWith);
  const [showLeaves, setShowLeaves] = useState(start.leaves);
  const [showGhosts, setShowGhosts] = useState(start.ghosts);
  useEffect(() => {
    remember('rtree', { side, up, down, onlyWith, leaves: showLeaves, ghosts: showGhosts });
    setHash({
      rp: sel ?? null, rf: focusId !== viewerId ? focusId : null, ts: side === 'all' ? null : side,
      tu: up === 4 ? null : showGens(up, ALL_GENS), td: down === 2 ? null : showGens(down, ALL_GENS),
      tw: onlyWith ? '1' : null, tl: showLeaves ? null : '0', tg: showGhosts ? null : '0',
    });
  }, [sel, focusId, side, up, down, onlyWith, showLeaves, showGhosts, viewerId]);

  // the tree with every pending "new person" added (in a copy), so proposed people appear in place
  const preview = useMemo(() => {
    let d = data;
    const created = new Map<string, string>(); // finding id -> preview person id
    if (showGhosts) {
      let todo = findings.filter((f) => f.type === 'newPerson' && !decisions[f.id]);
      for (let pass = 0; pass < 12 && todo.length; pass++) {
        const rest: Finding[] = [];
        for (const f of todo) {
          const pid = resolveId(f.personId) ?? (f.personId.startsWith('new:') ? created.get(f.personId.slice(4)) : undefined);
          if (!pid || !d.people[pid]) {
            rest.push(f);
            continue;
          }
          try {
            const next = applyFinding(d, { ...f, personId: pid });
            const nid = Object.keys(next.people).find((id) => !d.people[id]);
            if (nid) {
              created.set(f.id, nid);
              d = next;
            }
          } catch { /* e.g. already two parents: leave it out of the picture */ }
        }
        if (rest.length === todo.length) break;
        todo = rest;
      }
    }
    const ghostOf = new Map([...created].map(([fid, pid]) => [pid, fid]));
    return { graph: d === data ? graph : new FamilyGraph(d), created, ghostOf };
  }, [data, graph, findings, decisions, showGhosts]); // eslint-disable-line react-hooks/exhaustive-deps

  const pg = preview.graph;
  /** which card a finding belongs on: its person, or the proposed person it is about */
  const targetOf = (f: Finding) => resolveId(f.personId) ?? (f.personId.startsWith('new:') ? preview.created.get(f.personId.slice(4)) : undefined);

  const { badges, byTarget } = useMemo(() => {
    const byTarget = new Map<string, Finding[]>();
    for (const f of findings) {
      const id = targetOf(f);
      if (id) byTarget.set(id, [...(byTarget.get(id) ?? []), f]);
    }
    const badges: Record<string, number> = {};
    for (const [id, list] of byTarget) {
      const n = list.filter((f) => !decisions[f.id]).length;
      if (n) badges[id] = n;
    }
    return { badges, byTarget };
  }, [findings, decisions, preview]); // eslint-disable-line react-hooks/exhaustive-deps

  const ghosts = useMemo(() => new Set(preview.ghostOf.keys()), [preview]);
  const leaves = useMemo(() => (showLeaves
    ? new Set(Object.keys(pg.people).filter((id) => !ghosts.has(id) && pg.parents(id).length === 0))
    : undefined), [pg, ghosts, showLeaves]);
  const dimmed = useMemo(() => (onlyWith
    ? new Set(Object.keys(pg.people).filter((id) => !badges[id] && !ghosts.has(id)))
    : undefined), [pg, badges, ghosts, onlyWith]);

  const selId = sel?.startsWith('g:') ? preview.created.get(sel.slice(2)) : sel;
  const selPerson = pg.get(selId);
  const ghostFinding = selId ? findings.find((f) => f.id === preview.ghostOf.get(selId)) : undefined;
  const own = selId ? byTarget.get(selId) ?? [] : [];
  const list = ghostFinding ? [ghostFinding, ...own] : own;
  const pending = list.filter((f) => !decisions[f.id]).sort((a, b) => CONF_ORDER[a.confidence] - CONF_ORDER[b.confidence]);
  const decided = list.filter((f) => decisions[f.id]);
  const highs = pending.filter((f) => f.confidence === 'high' && resolveId(f.personId));
  const totalPending = findings.filter((f) => !decisions[f.id]).length;

  const select = (id: string) => {
    const fid = preview.ghostOf.get(id);
    if (fid) setSel(`g:${fid}`); // a proposed person: just select it
    else {
      setSel(id);
      setFocusId(id);
    }
  };

  const decide = (list: Finding[], d: Decision | undefined) => {
    const created = onDecideMany(list, d);
    if (!ghostFinding || !list.includes(ghostFinding)) return;
    // the proposed person became real (or went away): keep a sensible card selected
    if (d === 'approved' && created[0]) setSel(created[0]);
    else if (d === 'rejected') setSel(resolveId(ghostFinding.personId) ?? focusId);
  };

  const next = () => {
    const ids = Object.keys(badges).filter((id) => !ghosts.has(id) && graph.get(id))
      .sort((a, b) => (relations?.get(a)?.distance ?? 999) - (relations?.get(b)?.distance ?? 999) || a.localeCompare(b));
    if (!ids.length) return;
    const id = ids[(ids.indexOf(selId ?? '') + 1) % ids.length];
    setSel(id);
    setFocusId(id);
  };

  const center = pg.get(focusId) ? focusId : Object.keys(pg.people)[0] ?? '';
  const toggle = (on: boolean, set: (v: boolean) => void, label: string) => (
    <button className={`chip${on ? ' on' : ''}`} onClick={() => set(!on)} aria-pressed={on}>
      {on && <Icon name="check" size={18} />}{label}
    </button>
  );

  return (
    <div className="research-tree">
      <FilterChips
        side={side} up={up} down={down} showDepth onSide={setSide} onUp={setUp} onDown={setDown}
        maxUp={pg.get(center) ? pg.depthUp(center, side) : 1} maxDown={pg.get(center) ? pg.depthDown(center) : 0}
        onMe={graph.get(viewerId) ? () => select(viewerId) : undefined}
        extra={<>
          {toggle(onlyWith, setOnlyWith, t('onlyWithSuggestions'))}
          {toggle(showLeaves, setShowLeaves, t('markLeaves'))}
          {toggle(showGhosts, setShowGhosts, t('showGhosts'))}
          <button className="chip next-chip" onClick={next} disabled={!Object.keys(badges).length}>
            {t('nextWithSuggestions')} <Icon name={lang === 'he' ? 'back' : 'forward'} size={18} />
          </button>
          <span className="chip-count">{t('pendingTotal', { n: String(totalPending) })}</span>
        </>}
      />
      <div className="rt-body">
        <div className="rt-canvas">
          {center && (
            <TreeView
              graph={pg}
              relations={relations}
              focusId={center}
              viewerId={viewerId}
              selectedId={selId}
              side={side}
              up={up}
              down={down}
              onSelect={select}
              panelOpen={false}
              badges={badges}
              ghosts={ghosts}
              leaves={leaves}
              dimmed={dimmed}
            />
          )}
        </div>
        <aside className="rt-panel">
          {selPerson ? (
            <>
              <header className="rt-head">
                <Avatar person={selPerson} size={48} />
                <div>
                  <h2>{displayName(selPerson, lang)}</h2>
                  <span className="muted">{ghostFinding ? t('ghostTag') : lifeSpan(selPerson, lang)}</span>
                </div>
                {!ghostFinding && <button className="btn ghost small" onClick={() => onShowPerson(selId!)}>{t('showInTree')}</button>}
              </header>
              <p className="muted rt-count">{pending.length ? t('pendingForPerson', { n: String(pending.length) }) : t('noPendingForPerson')}</p>
              {highs.length > 1 && (
                <button className="btn tonal block" onClick={() => decide(highs, 'approved')}>✓ {t('approveAllHighPerson', { n: String(highs.length) })}</button>
              )}
              {pending.map((f) => (
                <FindingCard key={f.id} f={f} state="pending" waiting={!resolveId(f.personId)} onDecide={(x, d) => decide([x], d)} />
              ))}
              {decided.length > 0 && (
                <details className="rt-decided">
                  <summary>{t('decidedEarlier')} · {decided.length}</summary>
                  {decided.map((f) => (
                    <FindingCard key={f.id} f={f} state={decisions[f.id]} waiting={false} onDecide={(x, d) => decide([x], d)} />
                  ))}
                </details>
              )}
            </>
          ) : (
            <p className="muted">{t('pickPerson')}</p>
          )}
        </aside>
      </div>
    </div>
  );
}
