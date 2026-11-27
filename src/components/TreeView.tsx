import { useEffect, useMemo, useRef, useState } from 'react';
import { select } from 'd3-selection';
import { zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from 'd3-zoom';
import type { Side } from '../types';
import type { FamilyGraph } from '../lib/graph';
import type { RelationFinder } from '../lib/relation';
import { CARD_H, CARD_W, layoutTree } from '../lib/layout';
import { displayName, isRtl, lifeSpan, relationLabel } from '../lib/i18n';
import { useLang } from '../lib/LangContext';
import { Avatar } from './Avatar';
import { Icon } from './Icons';

interface Props {
  graph: FamilyGraph;
  relations: RelationFinder | undefined;
  focusId: string;
  viewerId: string;
  selectedId?: string;
  side: Side;
  up: number;
  down: number;
  onSelect: (id: string) => void;
  /** the person panel covers part of the screen; keep the tree in the visible part */
  panelOpen: boolean;
  /** the whole tree from afar, nobody highlighted (guests) */
  overview?: boolean;
  /** research tree: pending suggestions per person, proposed (not yet approved) people, ends of the tree, faded cards */
  badges?: Record<string, number>;
  ghosts?: Set<string>;
  leaves?: Set<string>;
  dimmed?: Set<string>;
}

export function TreeView({
  graph, relations, focusId, viewerId, selectedId, side, up, down, onSelect, panelOpen, overview, badges, ghosts, leaves, dimmed,
}: Props) {
  const { lang, t } = useLang();
  const rtl = isRtl(lang);
  const wrapRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef<ZoomBehavior<HTMLDivElement, unknown>>();
  const [transform, setTransform] = useState<ZoomTransform>(zoomIdentity);
  const [animating, setAnimating] = useState(false);
  const animTimer = useRef<number>();

  const layout = useMemo(() => layoutTree(graph, focusId, { up, down, side, rtl }), [graph, focusId, up, down, side, rtl]);

  useEffect(() => {
    const el = wrapRef.current!;
    const z = zoom<HTMLDivElement, unknown>()
      .scaleExtent([0.04, 2])
      .on('zoom', (e) => setTransform(e.transform));
    zoomRef.current = z;
    select(el).call(z).on('dblclick.zoom', null);
    return () => {
      select(el).on('.zoom', null);
    };
  }, []);

  /**
   * Fit the whole visible tree on screen. If it is too big to stay readable,
   * keep a readable scale and center on the focus person (always at 0,0) instead.
   */
  const fit = () => {
    const el = wrapRef.current;
    if (!el || !zoomRef.current || !layout.nodes.length) return;
    const xs = layout.nodes.map((n) => n.x);
    const ys = layout.nodes.map((n) => n.y);
    const minX = Math.min(...xs) - CARD_W / 2, maxX = Math.max(...xs) + CARD_W / 2;
    const minY = Math.min(...ys) - CARD_H / 2, maxY = Math.max(...ys) + CARD_H / 2;
    // the part of the screen not covered by the person panel
    const W = el.clientWidth, H = el.clientHeight;
    const mobile = W <= 720;
    const pad = mobile ? 16 : 40;
    // phone: the person sheet covers the bottom part (on a computer it sits beside the tree)
    const x0 = 0, x1 = W, y0 = 0;
    let y1 = H;
    if (panelOpen && mobile) y1 = H * 0.42;
    const w = x1 - x0, h = y1 - y0;
    // on a phone keep cards readable (the tree can be dragged) rather than shrinking it to fit;
    // a very tall tree (many generations) or the guests' overview is shown whole
    const rows = new Set(layout.nodes.map((n) => n.y)).size;
    const minScale = overview || rows > 8 ? 0.04 : mobile ? 0.8 : 0.6;
    const k = Math.min(1, (w - pad * 2) / (maxX - minX), (h - pad * 2) / (maxY - minY));
    let tf;
    if (k >= minScale) {
      tf = zoomIdentity.translate(x0 + w / 2 - ((minX + maxX) / 2) * k, y0 + h / 2 - ((minY + maxY) / 2) * k).scale(k);
    } else {
      tf = zoomIdentity.translate(x0 + w / 2, y0 + h / 2).scale(minScale);
    }
    // animate programmatic moves only (never while the user drags)
    setAnimating(true);
    window.clearTimeout(animTimer.current);
    animTimer.current = window.setTimeout(() => setAnimating(false), 500);
    select(el).call(zoomRef.current.transform, tf);
  };
  useEffect(fit, [layout, panelOpen, overview]); // eslint-disable-line react-hooks/exhaustive-deps

  // fit again when the tree's area changes size (window resized, a panel finished laying out)
  const fitRef = useRef(fit);
  fitRef.current = fit;
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    let last = `${el.clientWidth}x${el.clientHeight}`;
    let frame = 0;
    const ro = new ResizeObserver(() => {
      const size = `${el.clientWidth}x${el.clientHeight}`;
      if (size === last) return;
      last = size;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => fitRef.current());
    });
    ro.observe(el);
    return () => { ro.disconnect(); cancelAnimationFrame(frame); };
  }, []);

  const zoomBy = (f: number) => wrapRef.current && zoomRef.current && select(wrapRef.current).call(zoomRef.current.scaleBy, f);

  return (
    <div className={`tree-wrap${overview ? ' overview' : ''}`} ref={wrapRef}>
      {/* far away the cards keep only a large name */}
      <div className={`tree-content${animating ? ' animating' : ''}${transform.k < 0.45 ? ' far' : ''}`} style={{ transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.k})` }}>
        <svg className="tree-links" width="1" height="1">
          {layout.links.map((l) => (
            <polyline
              key={l.key}
              className={`link link-${l.kind}${l.dashed ? ' dashed' : ''}`}
              points={l.points.map((p) => p.join(',')).join(' ')}
            />
          ))}
        </svg>
        {layout.nodes.map((n) => {
          const p = graph.people[n.id];
          if (!p) return null;
          const rel = relations?.get(n.id);
          const label = relationLabel(rel, lang);
          const classes = ['card', `role-${n.role}`, `sex-${p.sex}`];
          if (p.deceased) classes.push('deceased');
          if (n.id === selectedId) classes.push('selected');
          if (n.id === viewerId) classes.push('is-viewer');
          const ghost = ghosts?.has(n.id);
          if (ghost) classes.push('ghost');
          if (leaves?.has(n.id)) classes.push('leaf');
          if (dimmed?.has(n.id)) classes.push('dim');
          const branch = ghost || badges ? 0 : graph.branchSize(n.id);
          const pending = badges?.[n.id] ?? 0;
          return (
            <button
              key={n.key}
              className={classes.join(' ')}
              style={{ width: CARD_W, height: CARD_H, transform: `translate(${n.x - CARD_W / 2}px, ${n.y - CARD_H / 2}px)` }}
              onClick={() => onSelect(n.id)}
              title={displayName(p, lang)}
            >
              <Avatar person={p} size={46} />
              <span className="card-text">
                <span className="card-name">{displayName(p, lang)}</span>
                <span className="card-years">{lifeSpan(p, lang)}</span>
                {ghost ? <span className="card-rel ghost-tag">{t('ghostTag')}</span>
                  : label && <span className={`card-rel${rel?.kind.k === 'self' ? ' me' : ''}`}>{label}</span>}
              </span>
              {pending > 0 && <span className="card-badge" aria-label={t('pendingForPerson', { n: String(pending) })}>{pending}</span>}
              {leaves?.has(n.id) && <span className="leaf-tag">{t('leafTag')}</span>}
              {branch > 0 && (
                <span className="card-branch" title={t('branchCount', { n: String(branch) })} aria-label={t('branchCount', { n: String(branch) })}>
                  {branch}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="zoom-buttons">
        <button onClick={() => zoomBy(1.25)} aria-label={t('zoomIn')}><Icon name="plus" /></button>
        <button onClick={() => zoomBy(0.8)} aria-label={t('zoomOut')}><Icon name="minus" /></button>
        <button onClick={fit} aria-label={t('fit')} title={t('fit')}><Icon name="fit" /></button>
      </div>
    </div>
  );
}
