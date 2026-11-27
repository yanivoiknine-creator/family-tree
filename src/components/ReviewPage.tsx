import { useEffect, useMemo, useState } from 'react';
import type { Decision, Finding, LifeEvent, Person } from '../types';
import type { FamilyGraph } from '../lib/graph';
import type { RelationFinder } from '../lib/relation';
import { displayName, factLabel, formatDate, type Lang, type MsgKey } from '../lib/i18n';
import { useLang } from '../lib/LangContext';
import { Avatar } from './Avatar';
import { docKind } from '../lib/ops';
import { Icon } from './Icons';

type State = 'pending' | 'approved' | 'rejected';
type T = (key: MsgKey, vars?: Record<string, string>) => string;

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
};

const GROUP_LABEL: Record<string, MsgKey> = { birth: 'born', death: 'died', burial: 'buried' };
const KEY_LABEL: Record<string, MsgKey> = { date: 'date', place: 'place', cause: 'cause' };

// ---------- shared by the list and the research tree ----------

export type Kind = 'people' | 'events' | 'photos' | 'docs' | 'text';
export const KINDS: Kind[] = ['people', 'events', 'photos', 'docs', 'text'];

export function kindOf(f: Finding): Kind {
  if (f.type === 'newPerson') return 'people';
  if (f.field === 'photo') return 'photos';
  if (f.field === 'document') return 'docs';
  if (f.field?.includes('.')) return 'events';
  return 'text';
}

/** The research round a finding came from: the letters of its id ("fd" for fd12). */
export const batchOf = (f: Finding) => f.id.match(/^[a-z]+/i)?.[0] ?? '?';

/**
 * The real person a finding is about, following "new:" links back to an existing person
 * (hops = how many not-yet-approved people lie in between).
 */
export function anchorOf(
  f: Finding, byId: Map<string, Finding>, resolveId: (pid: string) => string | undefined,
): { id?: string; hops: number } {
  let cur: Finding | undefined = f;
  for (let hops = 0; cur && hops < 30; hops++) {
    const real = resolveId(cur.personId);
    if (real) return { id: real, hops };
    cur = cur.personId.startsWith('new:') ? byId.get(cur.personId.slice(4)) : undefined;
  }
  return { hops: 99 };
}

function fieldLabel(f: Finding, t: T): string {
  if (f.type === 'newPerson') return `${t('newRelative')} · ${t(f.relation === 'parent' ? 'addParent' : f.relation === 'partner' ? 'addPartner' : f.relation === 'sibling' ? 'addSibling' : 'addChild')}`;
  const field = f.field ?? '';
  if (field.includes('.')) {
    const [g, k] = field.split('.');
    return `${t(GROUP_LABEL[g] ?? 'facts')} · ${t(KEY_LABEL[k] ?? 'facts')}`;
  }
  if (field === 'fact') return t('facts');
  if (field === 'document') return t('document');
  const known = ['bio', 'photo', 'firstName', 'lastName', 'firstNameHe', 'lastNameHe', 'middleName', 'middleNameHe', 'nickname', 'nicknameHe', 'marriedName', 'marriedNameHe', 'sex'];
  return known.includes(field) ? t(field as MsgKey) : field;
}

function renderValue(f: Finding, v: unknown, t: T, lang: Lang) {
  if (v === null || v === undefined || v === '') return <span className="muted">—</span>;
  if (f.field === 'sex') return <span>{t(v === 'M' ? 'male' : v === 'F' ? 'female' : 'unknown')}</span>;
  if (f.field === 'photo') return <img className="finding-photo" src={String(v)} alt="" referrerPolicy="no-referrer" loading="lazy" />;
  if (f.field === 'document' && typeof v === 'object') {
    const d = v as { url: string; title?: string; name?: string; kind?: string };
    if (!d.url) return <span className="muted">{d.title ? `${d.title} · ` : ''}{t('fileDeleted')}</span>;
    const isImage = (d.kind ?? docKind(d.name ?? d.url)) === 'image';
    return (
      <a className="finding-doc" href={d.url} target="_blank" rel="noreferrer noopener">
        {isImage ? <img className="finding-photo" src={d.url} alt="" referrerPolicy="no-referrer" loading="lazy" /> : <span className="doc-icon">PDF</span>}
        {d.title && <span>{d.title}</span>}
      </a>
    );
  }
  if (f.field === 'fact' && typeof v === 'object') {
    const fv = v as { label: string; value: string };
    return <span>{factLabel(lang, fv.label)}: {fv.value}</span>;
  }
  if (f.type === 'newPerson' && typeof v === 'object') {
    const np = v as Partial<Person>;
    const span = [formatDate(np.birth, lang), np.deceased ? formatDate(np.death, lang) || '?' : ''].filter(Boolean).join(' – ');
    return <span><b>{[np.firstName, np.lastName].filter(Boolean).join(' ')}</b>{span && ` (${span})`}</span>;
  }
  if (f.field?.endsWith('.date')) return <span>{formatDate({ date: String(v) } as LifeEvent, lang)} <span className="muted" dir="ltr">({String(v)})</span></span>;
  return <span className={f.field === 'bio' ? 'bio' : ''}>{String(v)}</span>;
}

interface CardProps {
  f: Finding;
  state: State;
  /** depends on a person another finding would add first */
  waiting: boolean;
  onDecide: (f: Finding, d: Decision | undefined) => void;
  selected?: boolean;
  onToggle?: () => void;
  focused?: boolean;
  /** shown over the card (e.g. whose finding it is, in the research tree) */
  label?: string;
}

/** One research finding: what is proposed, the source, approve / reject / undo. */
export function FindingCard({ f, state, waiting, onDecide, selected, onToggle, focused, label }: CardProps) {
  const { lang, t } = useLang();
  return (
    <article id={`finding-${f.id}`} className={`finding level-${f.confidence}${focused ? ' focused' : ''}${state !== 'pending' ? ' decided' : ''}`}>
      <div className="finding-top">
        {onToggle && <input type="checkbox" className="finding-check" checked={Boolean(selected)} onChange={onToggle} aria-label={t('select')} />}
        <span className="finding-field">{label ? `${label} · ` : ''}{fieldLabel(f, t)}</span>
        <span className={`conf conf-${f.confidence}`}>{t(`conf_${f.confidence}` as MsgKey)}</span>
        <span className="finding-batch" title={t('researchRound')}>{batchOf(f)}</span>
      </div>
      <div className="finding-values">
        {f.type === 'field' && f.field !== 'photo' && f.field !== 'document' && f.current !== undefined && f.current !== null && (
          <div><span className="lbl">{t('current')}</span>{renderValue(f, f.current, t, lang)}</div>
        )}
        <div><span className="lbl">{t('proposed')}</span>{renderValue(f, f.value, t, lang)}</div>
      </div>
      {f.note && <p className="finding-note">{f.note}</p>}
      {f.sourceUrl ? (
        <a className="finding-src" href={f.sourceUrl} target="_blank" rel="noreferrer noopener">
          {t('source')}: {f.sourceTitle || hostOf(f.sourceUrl)} ↗
        </a>
      ) : (
        f.sourceTitle && <span className="finding-src plain">{t('source')}: {f.sourceTitle}</span>
      )}
      <div className="finding-actions">
        {state === 'pending' ? (
          <>
            <button className="btn approve" disabled={waiting} onClick={() => onDecide(f, 'approved')}>✓ {t('approve')}</button>
            <button className="btn reject" onClick={() => onDecide(f, 'rejected')}>✕ {t('reject')}</button>
          </>
        ) : (
          <>
            <span className={`stamp ${state}`}>{t(state === 'approved' ? 'approvedTab' : 'rejectedTab')}</span>
            <button className="btn ghost" onClick={() => onDecide(f, undefined)}>↺ {t('undo')}</button>
          </>
        )}
      </div>
    </article>
  );
}

// ---------- the list ----------

interface Props {
  graph: FamilyGraph;
  findings: Finding[];
  decisions: Record<string, Decision>;
  /** the real tree id for a finding's person ("new:bh3" resolves once bh3 is approved) */
  resolveId: (personId: string) => string | undefined;
  /** relationships to the viewer: closeness and side of the family */
  relations?: RelationFinder;
  onDecide: (finding: Finding, decision: Decision | undefined) => void;
  onDecideMany: (findings: Finding[], decision: Decision | undefined) => void;
  onShowPerson: (id: string) => void;
  /** shown inside the admin page (no page frame of its own) */
  embedded?: boolean;
}

type Sort = 'near' | 'conf' | 'name' | 'count' | 'order';
const CONF_ORDER = { high: 0, medium: 1, low: 2 };

export function ReviewPage({ graph, findings, decisions, resolveId, relations, onDecide, onDecideMany, onShowPerson, embedded }: Props) {
  const { lang, t } = useLang();
  const [tab, setTab] = useState<State>('pending');
  const [q, setQ] = useState('');
  const [kinds, setKinds] = useState<Set<Kind>>(new Set());
  const [confs, setConfs] = useState<Set<Finding['confidence']>>(new Set());
  const [side, setSide] = useState<'all' | 'father' | 'mother'>('all');
  const [batch, setBatch] = useState('all');
  const [sort, setSort] = useState<Sort>('near');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [focus, setFocus] = useState<string>();

  const stateOf = (f: Finding): State => decisions[f.id] ?? 'pending';
  const counts = useMemo(() => {
    const c = { pending: 0, approved: 0, rejected: 0 };
    for (const f of findings) c[stateOf(f)]++;
    return c;
  }, [findings, decisions]); // eslint-disable-line react-hooks/exhaustive-deps

  const byId = useMemo(() => new Map(findings.map((f) => [f.id, f])), [findings]);
  const batches = useMemo(() => {
    const m = new Map<string, number>();
    for (const f of findings) m.set(batchOf(f), (m.get(batchOf(f)) ?? 0) + 1);
    return [...m.entries()];
  }, [findings]);

  /** who the finding is about, for searching / sorting / the family side */
  const about = (f: Finding) => {
    const a = anchorOf(f, byId, resolveId);
    const person = graph.get(a.id);
    const rel = a.id ? relations?.get(a.id) : undefined;
    return { id: a.id, person, distance: (rel?.distance ?? 999) + a.hops, side: rel?.side };
  };

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = findings.filter((f) => {
      if (stateOf(f) !== tab) return false;
      if (kinds.size && !kinds.has(kindOf(f))) return false;
      if (confs.size && !confs.has(f.confidence)) return false;
      if (batch !== 'all' && batchOf(f) !== batch) return false;
      if (side !== 'all' && about(f).side !== side) return false;
      if (needle) {
        const p = about(f).person;
        const hay = [f.personName, p && displayName(p, lang), p?.firstName, p?.lastName, f.sourceTitle, f.note,
          typeof f.value === 'string' ? f.value : JSON.stringify(f.value)].join(' ').toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
    const info = new Map(list.map((f) => [f.id, about(f)]));
    const perPerson = new Map<string, number>();
    for (const f of list) perPerson.set(f.personId, (perPerson.get(f.personId) ?? 0) + 1);
    const nameOf = (f: Finding) => {
      const p = info.get(f.id)!.person;
      return p ? displayName(p, lang) : f.personName ?? '';
    };
    const pos = new Map(findings.map((f, i) => [f.id, i]));
    const cmp: Record<Sort, (a: Finding, b: Finding) => number> = {
      near: (a, b) => info.get(a.id)!.distance - info.get(b.id)!.distance,
      conf: (a, b) => CONF_ORDER[a.confidence] - CONF_ORDER[b.confidence],
      name: (a, b) => nameOf(a).localeCompare(nameOf(b), lang),
      count: (a, b) => perPerson.get(b.personId)! - perPerson.get(a.personId)!,
      order: () => 0,
    };
    return list.sort((a, b) => cmp[sort](a, b) || pos.get(a.id)! - pos.get(b.id)!);
  }, [findings, decisions, tab, q, kinds, confs, side, batch, sort, relations, lang]); // eslint-disable-line react-hooks/exhaustive-deps

  // keep the selection and the keyboard focus inside what is shown
  useEffect(() => {
    const ids = new Set(visible.map((f) => f.id));
    setSelected((s) => new Set([...s].filter((id) => ids.has(id))));
    if (!focus || !ids.has(focus)) setFocus(visible[0]?.id);
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  // group by person, in the sorted order
  const groups = new Map<string, Finding[]>();
  for (const f of visible) groups.set(f.personId, [...(groups.get(f.personId) ?? []), f]);

  const toggle = <V,>(set: Set<V>, v: V) => {
    const n = new Set(set);
    if (n.has(v)) n.delete(v); else n.add(v);
    return n;
  };
  const selectedList = visible.filter((f) => selected.has(f.id));
  const highs = visible.filter((f) => f.confidence === 'high');

  // keyboard: J/K move, A approve, R reject, X select, U undo
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.ctrlKey || e.metaKey || e.altKey || el.closest('input, textarea, select, .modal')) return;
      const i = visible.findIndex((f) => f.id === focus);
      const cur = visible[i];
      const move = (d: number) => {
        const next = visible[Math.max(0, Math.min(visible.length - 1, i + d))];
        if (!next) return;
        setFocus(next.id);
        document.getElementById(`finding-${next.id}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      };
      const k = e.key.toLowerCase();
      if (k === 'j' || k === 'arrowdown') { e.preventDefault(); move(1); }
      else if (k === 'k' || k === 'arrowup') { e.preventDefault(); move(-1); }
      else if (!cur) return;
      else if (k === 'x') setSelected((s) => toggle(s, cur.id));
      else if ((k === 'a' || k === 'r') && tab === 'pending') {
        setFocus(visible[i + 1]?.id ?? visible[i - 1]?.id);
        onDecide(cur, k === 'a' ? 'approved' : 'rejected');
      } else if (k === 'u' && tab !== 'pending') onDecide(cur, undefined);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible, focus, tab]); // eslint-disable-line react-hooks/exhaustive-deps

  const body = (
      <>
        <h1>{t('review')}</h1>
        <p className="muted">{t('reviewIntro')}</p>

        <div className="review-tabs">
          {(['pending', 'approved', 'rejected'] as State[]).map((k) => (
            <button key={k} className={`seg${tab === k ? ' on' : ''}`} onClick={() => setTab(k)}>
              {t(k === 'pending' ? 'pending' : k === 'approved' ? 'approvedTab' : 'rejectedTab')} <span className="count">{counts[k]}</span>
            </button>
          ))}
        </div>

        <div className="review-filters">
          <div className="filter-search">
            <Icon name="search" size={18} />
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('filterSearch')} />
          </div>
          <div className="filter-row">
            {KINDS.map((k) => (
              <button key={k} className={`chip${kinds.has(k) ? ' on' : ''}`} onClick={() => setKinds(toggle(kinds, k))}>{t(`kind_${k}` as MsgKey)}</button>
            ))}
          </div>
          <div className="filter-row">
            {(['high', 'medium', 'low'] as const).map((c) => (
              <button key={c} className={`chip${confs.has(c) ? ' on' : ''}`} onClick={() => setConfs(toggle(confs, c))}>{t(`conf_${c}` as MsgKey)}</button>
            ))}
            <select value={side} onChange={(e) => setSide(e.target.value as typeof side)} aria-label={t('side')}>
              <option value="all">{t('bothSides')}</option>
              <option value="father">{t('sideFather')}</option>
              <option value="mother">{t('sideMother')}</option>
            </select>
            <select value={batch} onChange={(e) => setBatch(e.target.value)} aria-label={t('researchRound')}>
              <option value="all">{t('allBatches')}</option>
              {batches.map(([b, n]) => <option key={b} value={b}>{t('batchLabel', { p: b, n: String(n) })}</option>)}
            </select>
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label={t('sortBy')}>
              <option value="near">{t('sortNear')}</option>
              <option value="conf">{t('sortConf')}</option>
              <option value="count">{t('sortCount')}</option>
              <option value="name">{t('sortName')}</option>
              <option value="order">{t('sortOrder')}</option>
            </select>
          </div>
        </div>

        {visible.length > 0 && (
          <div className="bulk-bar">
            <label className="check">
              <input
                type="checkbox"
                checked={selected.size > 0 && selected.size === visible.length}
                onChange={(e) => setSelected(e.target.checked ? new Set(visible.map((f) => f.id)) : new Set())}
              />
              {selected.size ? t('selectedN', { n: String(selected.size) }) : t('inFilterN', { n: String(visible.length) })}
            </label>
            {selected.size > 0 && tab === 'pending' && (
              <>
                <button className="btn approve small" onClick={() => onDecideMany(selectedList, 'approved')}>✓ {t('approveSelected')}</button>
                <button className="btn reject small" onClick={() => onDecideMany(selectedList, 'rejected')}>✕ {t('rejectSelected')}</button>
              </>
            )}
            {selected.size > 0 && tab !== 'pending' && (
              <button className="btn ghost small" onClick={() => onDecideMany(selectedList, undefined)}>↺ {t('undoSelected')}</button>
            )}
            {selected.size === 0 && tab === 'pending' && highs.length > 0 && (
              <button className="btn small" onClick={() => onDecideMany(highs, 'approved')}>✓ {t('approveAllHigh', { n: String(highs.length) })}</button>
            )}
            <span className="keys-hint">{t('keysHint')}</span>
          </div>
        )}

        {findings.length === 0 && <p className="empty">{t('noResearch')}</p>}
        {findings.length > 0 && visible.length === 0 && <p className="empty">{t('noFindings')}</p>}

        {[...groups.entries()].map(([personId, list]) => {
          const realId = resolveId(personId);
          const person = graph.get(realId);
          const waiting = !realId; // depends on a person another finding would add
          return (
            <section key={personId} className={`review-group${waiting ? ' waiting' : ''}`}>
              <header>
                {person && <Avatar person={person} size={40} />}
                <h2>{person ? displayName(person, lang) : list[0].personName ?? personId}</h2>
                {person && <button className="btn ghost small" onClick={() => onShowPerson(realId!)}>{t('showInTree')}</button>}
              </header>
              {waiting && <p className="hint">{t('approveFirst', { name: list[0].personName ?? '?' })}</p>}
              {list.map((f) => (
                <FindingCard
                  key={f.id}
                  f={f}
                  state={stateOf(f)}
                  waiting={waiting}
                  onDecide={onDecide}
                  selected={selected.has(f.id)}
                  onToggle={() => setSelected((s) => toggle(s, f.id))}
                  focused={f.id === focus}
                />
              ))}
            </section>
          );
        })}
      </>
  );
  return embedded ? body : <div className="review"><div className="review-inner">{body}</div></div>;
}
