import { useMemo, useState } from 'react';
import type { Decision, Finding, LifeEvent, Person } from '../types';
import type { FamilyGraph } from '../lib/graph';
import { displayName, factLabel, formatDate, type MsgKey } from '../lib/i18n';
import { useLang } from '../lib/LangContext';
import { Avatar } from './Avatar';
import { docKind } from '../lib/ops';
import { Icon } from './Icons';

interface Props {
  graph: FamilyGraph;
  findings: Finding[];
  decisions: Record<string, Decision>;
  /** the real tree id for a finding's person ("new:bh3" resolves once bh3 is approved) */
  resolveId: (personId: string) => string | undefined;
  onDecide: (finding: Finding, decision: Decision | undefined) => void;
  onShowPerson: (id: string) => void;
  /** shown inside the admin page (no page frame of its own) */
  embedded?: boolean;
}

type Tab = 'pending' | 'approved' | 'rejected';

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
};

const GROUP_LABEL: Record<string, MsgKey> = { birth: 'born', death: 'died', burial: 'buried' };
const KEY_LABEL: Record<string, MsgKey> = { date: 'date', place: 'place', cause: 'cause' };

export function ReviewPage({ graph, findings, decisions, resolveId, onDecide, onShowPerson, embedded }: Props) {
  const { lang, t } = useLang();
  const [tab, setTab] = useState<Tab>('pending');
  const [photosOnly, setPhotosOnly] = useState(false);

  const stateOf = (f: Finding): Tab => decisions[f.id] ?? 'pending';
  const counts = useMemo(() => {
    const c = { pending: 0, approved: 0, rejected: 0 };
    for (const f of findings) c[stateOf(f)]++;
    return c;
  }, [findings, decisions]); // eslint-disable-line react-hooks/exhaustive-deps

  const visible = findings.filter((f) => stateOf(f) === tab && (!photosOnly || f.field === 'photo' || f.field === 'document'));
  // group by person, keeping the research order
  const groups = new Map<string, Finding[]>();
  for (const f of visible) groups.set(f.personId, [...(groups.get(f.personId) ?? []), f]);

  const fieldLabel = (f: Finding) => {
    if (f.type === 'newPerson') return `${t('newRelative')} · ${t(f.relation === 'parent' ? 'addParent' : f.relation === 'partner' ? 'addPartner' : f.relation === 'sibling' ? 'addSibling' : 'addChild')}`;
    const field = f.field ?? '';
    if (field.includes('.')) {
      const [g, k] = field.split('.');
      return `${t(GROUP_LABEL[g] ?? 'facts')} · ${t(KEY_LABEL[k] ?? 'facts')}`;
    }
    if (field === 'fact') return t('facts');
    if (field === 'document') return t('document');
    const known = ['bio', 'photo', 'firstName', 'lastName', 'firstNameHe', 'lastNameHe', 'marriedName', 'marriedNameHe', 'sex'];
    return known.includes(field) ? t(field as MsgKey) : field;
  };

  const renderValue = (f: Finding, v: unknown) => {
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
  };

  const body = (
      <>
        <h1>{t('review')}</h1>
        <p className="muted">{t('reviewIntro')}</p>

        <div className="review-tabs">
          {(['pending', 'approved', 'rejected'] as Tab[]).map((k) => (
            <button key={k} className={`seg${tab === k ? ' on' : ''}`} onClick={() => setTab(k)}>
              {t(k === 'pending' ? 'pending' : k === 'approved' ? 'approvedTab' : 'rejectedTab')} <span className="count">{counts[k]}</span>
            </button>
          ))}
          <label className="check">
            <input type="checkbox" checked={photosOnly} onChange={(e) => setPhotosOnly(e.target.checked)} /> <Icon name="image" size={18} /> {t('photosOnly')}
          </label>
        </div>

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
                <article key={f.id} className={`finding level-${f.confidence}`}>
                  <div className="finding-top">
                    <span className="finding-field">{fieldLabel(f)}</span>
                    <span className={`conf conf-${f.confidence}`}>{t(`conf_${f.confidence}` as MsgKey)}</span>
                  </div>
                  <div className="finding-values">
                    {f.type === 'field' && f.field !== 'photo' && f.field !== 'document' && f.current !== undefined && f.current !== null && (
                      <div><span className="lbl">{t('current')}</span>{renderValue(f, f.current)}</div>
                    )}
                    <div><span className="lbl">{t('proposed')}</span>{renderValue(f, f.value)}</div>
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
                    {stateOf(f) === 'pending' ? (
                      <>
                        <button className="btn approve" disabled={waiting} onClick={() => onDecide(f, 'approved')}>✓ {t('approve')}</button>
                        <button className="btn reject" onClick={() => onDecide(f, 'rejected')}>✕ {t('reject')}</button>
                      </>
                    ) : (
                      <button className="btn ghost" onClick={() => onDecide(f, undefined)}>↺ {t('undo')}</button>
                    )}
                  </div>
                </article>
              ))}
            </section>
          );
        })}
      </>
  );
  return embedded ? body : <div className="review"><div className="review-inner">{body}</div></div>;
}
