import { useState } from 'react';
import type { FamilyGraph } from '../lib/graph';
import type { Profile, Role } from '../lib/supabase';
import { displayName, type MsgKey } from '../lib/i18n';
import { useLang } from '../lib/LangContext';
import { SearchBox } from './SearchBox';

interface Props {
  graph: FamilyGraph;
  profiles: Profile[];
  meId: string;
  onRole: (p: Profile, role: Role) => Promise<void>;
  onLink: (p: Profile, personId: string | null) => Promise<void>;
  onShowPerson: (id: string) => void;
}

const ROLES: Role[] = ['pending', 'member', 'admin'];

export function UsersAdmin({ graph, profiles, meId, onRole, onLink, onShowPerson }: Props) {
  const { lang, t } = useLang();
  const [linking, setLinking] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (id: string, fn: () => Promise<void>) => {
    setBusy(id);
    try {
      await fn();
    } catch (e) {
      alert(String(e));
    } finally {
      setBusy(null);
    }
  };

  // waiting accounts first
  const sorted = [...profiles].sort((a, b) => Number(b.role === 'pending') - Number(a.role === 'pending'));

  return (
    <div className="users">
      {sorted.map((p) => {
        const person = p.person_id ? graph.get(p.person_id) : undefined;
        const claim = p.claim ?? {};
        const typed = [
          [claim.firstNameHe, claim.lastNameHe].filter(Boolean).join(' '),
          [claim.firstName, claim.lastName].filter(Boolean).join(' '),
          claim.father && `${t('fatherName')}: ${claim.father}`,
          claim.mother && `${t('motherName')}: ${claim.mother}`,
        ].filter(Boolean).join(' · ');
        return (
          <section key={p.user_id} className={`review-group user-row${p.role === 'pending' ? ' waiting-user' : ''}`}>
            <header>
              {p.avatar_url
                ? <img className="user-avatar" src={p.avatar_url} alt="" referrerPolicy="no-referrer" />
                : <span className="user-avatar" />}
              <div className="user-id">
                <h2>{p.display_name || p.email}{p.user_id === meId && <span className="muted"> ({t('you')})</span>}</h2>
                <span className="muted small" dir="ltr">{p.email}</span>
              </div>
              <label className="field narrow">
                <span>{t('role')}</span>
                <select value={p.role} disabled={busy === p.user_id} onChange={(e) => run(p.user_id, () => onRole(p, e.target.value as Role))}>
                  {ROLES.map((r) => <option key={r} value={r}>{t(`role_${r}` as MsgKey)}</option>)}
                </select>
              </label>
            </header>
            {typed && <p className="small"><span className="lbl">{t('typedNames')}:</span> {typed}</p>}
            <div className="user-link">
              {person ? (
                <>
                  <span className="lbl">{t('linkedTo')}:</span>
                  <button className="link-btn" onClick={() => onShowPerson(person.id)}>{displayName(person, lang)}</button>
                  <button className="btn ghost small" disabled={busy === p.user_id} onClick={() => run(p.user_id, () => onLink(p, null))}>{t('unlink')}</button>
                </>
              ) : (
                <span className="muted">{t('notLinked')}</span>
              )}
              {linking === p.user_id ? (
                <div className="link-search">
                  <SearchBox graph={graph} onPick={(id) => { setLinking(null); run(p.user_id, () => onLink(p, id)); }} />
                  <button className="btn ghost small" onClick={() => setLinking(null)}>{t('cancel')}</button>
                </div>
              ) : (
                <button className="btn small" onClick={() => setLinking(p.user_id)}>{t('linkPerson')}</button>
              )}
              {p.role === 'pending' && (
                <button className="btn approve small" disabled={busy === p.user_id} onClick={() => run(p.user_id, () => onRole(p, 'member'))}>✓ {t('approveUser')}</button>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
