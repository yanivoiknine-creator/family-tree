import { useState } from 'react';
import type { LifeEvent, Person, PersonDoc, Union } from '../types';
import type { FamilyGraph } from '../lib/graph';
import type { Profile } from '../lib/supabase';
import type { Suggestion } from '../data/cloudStore';
import { changedKeys } from '../lib/diff';
import { displayName, factLabel, formatDate, isRtl, type MsgKey } from '../lib/i18n';
import { useLang } from '../lib/LangContext';

interface Props {
  graph: FamilyGraph;
  suggestions: Suggestion[];
  profiles: Record<string, Profile>;
  onDecide: (s: Suggestion, status: 'approved' | 'rejected') => void;
  onShowPerson: (id: string) => void;
}

const FIELD_LABEL: Record<string, MsgKey> = {
  firstName: 'firstName', lastName: 'lastName', firstNameHe: 'firstNameHe', lastNameHe: 'lastNameHe',
  marriedName: 'marriedName', marriedNameHe: 'marriedNameHe', sex: 'sex', birth: 'born', death: 'died',
  burial: 'buried', deceased: 'deceased', photo: 'photo', bio: 'bio', facts: 'facts', documents: 'documents',
  partners: 'partners', children: 'children', kind: 'status', marriage: 'married', divorced: 'statusDivorced', divorce: 'divorce',
};

export function SuggestionsList({ graph, suggestions, profiles, onDecide, onShowPerson }: Props) {
  const { lang, t } = useLang();
  const [tab, setTab] = useState<'pending' | 'history'>('pending');
  const list = suggestions.filter((s) => (tab === 'pending' ? s.status === 'pending' : s.status !== 'pending'));

  const personName = (id: string, fallback?: Person | null) => {
    const p = graph.get(id) ?? fallback ?? undefined;
    return p ? displayName(p, lang) : '?';
  };

  const value = (key: string, v: unknown) => {
    if (v === undefined || v === null || v === '') return <span className="muted">—</span>;
    if (key === 'photo') return <img className="finding-photo" src={String(v)} alt="" referrerPolicy="no-referrer" />;
    if (key === 'documents') {
      return (
        <span className="doc-row small">
          {(v as PersonDoc[]).map((d) => (
            <a key={d.id} className="doc-thumb" href={d.url} target="_blank" rel="noreferrer noopener" title={d.title || d.name}>
              {d.kind === 'image' ? <img src={d.url} alt="" referrerPolicy="no-referrer" loading="lazy" /> : <span className="doc-icon">PDF</span>}
            </a>
          ))}
        </span>
      );
    }
    if (key === 'sex') return t(v === 'M' ? 'male' : v === 'F' ? 'female' : 'unknown');
    if (key === 'deceased' || key === 'divorced') return v ? '✓' : '✗';
    if (key === 'birth' || key === 'death' || key === 'burial' || key === 'marriage' || key === 'divorce') {
      const ev = v as LifeEvent;
      return [formatDate(ev, lang), ev.place].filter(Boolean).join(', ') || '—';
    }
    if (key === 'facts') return (v as { label: string; value: string }[]).map((f) => `${factLabel(lang, f.label)}: ${f.value}`).join(' · ');
    if (key === 'partners' || key === 'children') return (v as string[]).map((id) => personName(id)).join(', ');
    return String(v);
  };

  const fields = (before: object | null, after: object | null) => (
    <ul className="change-fields">
      {changedKeys(before, after).map((k) => (
        <li key={k}>
          <span className="lbl">{FIELD_LABEL[k] ? t(FIELD_LABEL[k]) : k}</span>
          {before && <span className="was">{value(k, (before as Record<string, unknown>)[k])}</span>}
          {before && <span className="arrow">{isRtl(lang) ? '←' : '→'}</span>}
          <span className="now">{value(k, (after as Record<string, unknown>)[k])}</span>
        </li>
      ))}
    </ul>
  );

  const tag = (before: unknown, after: unknown) => (
    <span className={`change-tag ${!before ? 'new' : !after ? 'deleted' : 'edited'}`}>
      {t(!before ? 'changeNew' : !after ? 'changeDeleted' : 'changeEdited')}
    </span>
  );

  const unionTitle = (u: Union) => {
    const [a, b] = u.partners;
    return t('relationshipOf', { a: a ? personName(a) : '?', b: b ? personName(b) : '?' });
  };

  return (
    <div>
      <div className="review-tabs">
        <button className={`seg${tab === 'pending' ? ' on' : ''}`} onClick={() => setTab('pending')}>
          {t('pending')} <span className="count">{suggestions.filter((s) => s.status === 'pending').length}</span>
        </button>
        <button className={`seg${tab === 'history' ? ' on' : ''}`} onClick={() => setTab('history')}>{t('history')}</button>
      </div>
      {list.length === 0 && <p className="empty">{t('noSuggestions')}</p>}
      {list.map((s) => {
        const who = profiles[s.created_by];
        return (
          <section key={s.id} className="review-group">
            <header>
              {who?.avatar_url && <img className="user-avatar" src={who.avatar_url} alt="" referrerPolicy="no-referrer" />}
              <div>
                <h2>{s.summary || t('suggestEdit')}</h2>
                <span className="muted small">
                  {t('suggestedBy', { name: who?.display_name || who?.email || '?' })} · {new Date(s.created_at).toLocaleString(lang)}
                </span>
              </div>
            </header>
            {Object.entries(s.change.people).map(([id, { before, after }]) => (
              <article key={id} className="finding">
                <div className="finding-top">
                  <span className="finding-field">
                    {graph.get(id)
                      ? <button className="link-btn" onClick={() => onShowPerson(id)}>{personName(id)}</button>
                      : personName(id, after ?? before)}
                  </span>
                  {tag(before, after)}
                </div>
                {after && fields(before, after)}
              </article>
            ))}
            {Object.entries(s.change.unions).map(([id, { before, after }]) => (
              <article key={id} className="finding">
                <div className="finding-top">
                  <span className="finding-field">{unionTitle((after ?? before)!)}</span>
                  {tag(before, after)}
                </div>
                {after && fields(before, after)}
              </article>
            ))}
            <div className="finding-actions">
              {s.status === 'pending' ? (
                <>
                  <button className="btn approve" onClick={() => onDecide(s, 'approved')}>✓ {t('approve')}</button>
                  <button className="btn reject" onClick={() => onDecide(s, 'rejected')}>✕ {t('reject')}</button>
                </>
              ) : (
                <span className={`change-tag ${s.status === 'approved' ? 'new' : 'deleted'}`}>{t(s.status === 'approved' ? 'approvedTab' : 'rejectedTab')}</span>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
