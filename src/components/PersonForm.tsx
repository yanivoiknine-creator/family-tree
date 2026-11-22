import { useState, type ReactNode } from 'react';
import type { LifeEvent, Person, Sex } from '../types';
import type { FamilyGraph } from '../lib/graph';
import type { RelativeKind, UnionDetails } from '../lib/ops';
import { UnionFields, validUnion } from './UnionForm';
import { displayName, formatDate, type MsgKey } from '../lib/i18n';
import { compressImage } from '../lib/image';
import { useLang } from '../lib/LangContext';
import { Avatar } from './Avatar';
import { Icon } from './Icons';

/** A form section: always open on a computer; on a phone it folds to one line with a summary. */
function Section({ title, summary, open, onToggle, children }: { title: string; summary: string; open: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <section className={`fsec${open ? '' : ' closed'}`}>
      <button type="button" className="fsec-head" onClick={onToggle} aria-expanded={open}>
        <span className="fsec-title">{title}</span>
        {summary && <span className="fsec-sum">{summary}</span>}
        <Icon name={open ? 'up' : 'down'} size={18} className="fsec-chev" />
      </button>
      <div className="fsec-body">{children}</div>
    </section>
  );
}

interface Props {
  graph: FamilyGraph;
  initial: Person;
  /** set when adding a new relative */
  adding?: { kind: RelativeKind; anchorId: string };
  onSave: (person: Person, unionId?: string, details?: UnionDetails) => void;
  onCancel: () => void;
  uploadPhoto: (personId: string, blob: Blob) => Promise<string>;
}

const DATE_RE = /^\d{4}(-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?)?$/;
const ADD_LABEL: Record<RelativeKind, MsgKey> = { parent: 'addParent', partner: 'addPartner', child: 'addChild', sibling: 'addSibling' };

type SurnameKey = 'lastName' | 'lastNameHe' | 'marriedName' | 'marriedNameHe';
const SURNAME_KEYS: SurnameKey[] = ['lastName', 'lastNameHe', 'marriedName', 'marriedNameHe'];
type Surnames = Partial<Record<SurnameKey, string>>;

/** the family surname (birth surname) of a person, in both scripts */
const birthSurname = (x: Person) => ({ en: x.lastName, he: x.lastNameHe });
/** the surname a person goes by today (married name if any) */
const currentSurname = (x: Person) => ({ en: x.marriedName || x.lastName, he: x.marriedNameHe || x.lastNameHe });

/**
 * Surnames to pre-fill when adding a relative:
 * child → the father's surname; partner → the husband's surname;
 * parent → the child's surname; sibling → the sibling's surname.
 * Women keep their own (unknown) birth surname, so for them the copied name goes to "married name".
 */
function suggestSurnames(graph: FamilyGraph, kind: RelativeKind, anchor: Person, sex: Sex, unionId: string): Surnames {
  const asBirth = (s: { en?: string; he?: string }): Surnames => ({ lastName: s.en, lastNameHe: s.he });
  const asMarried = (s: { en?: string; he?: string }): Surnames => ({ marriedName: s.en, marriedNameHe: s.he });
  switch (kind) {
    case 'sibling':
      return asBirth(birthSurname(anchor));
    case 'parent':
      return sex === 'F' ? asMarried(birthSurname(anchor)) : asBirth(birthSurname(anchor));
    case 'partner':
      if (anchor.sex === 'M') return asMarried(birthSurname(anchor)); // new wife takes his name
      if (anchor.sex === 'F' && (anchor.marriedName || anchor.marriedNameHe)) return asBirth({ en: anchor.marriedName, he: anchor.marriedNameHe });
      return {};
    case 'child': {
      const union = graph.unionsOf(anchor.id).find((u) => u.id === unionId);
      const other = graph.get(union?.partners.find((x) => x !== anchor.id));
      const father = anchor.sex === 'M' ? anchor : other?.sex === 'M' ? other : undefined;
      return asBirth(father ? birthSurname(father) : currentSurname(anchor));
    }
  }
}

/** sensible default sex for a new relative (still editable) */
function defaultSex(graph: FamilyGraph, kind: RelativeKind, anchor: Person): Sex {
  if (kind === 'partner') return anchor.sex === 'M' ? 'F' : anchor.sex === 'F' ? 'M' : 'U';
  if (kind === 'parent') return graph.father(anchor.id) ? 'F' : 'M';
  return 'U';
}

export function PersonForm({ graph, initial, adding, onSave, onCancel, uploadPhoto }: Props) {
  const { lang, t } = useLang();
  const anchor = adding ? graph.get(adding.anchorId) : undefined;
  const unions = adding?.kind === 'child' ? graph.unionsOf(adding.anchorId) : [];
  // default to the latest relationship that is still together
  const [unionId, setUnionId] = useState<string>(
    [...unions].reverse().find((u) => u.partners.length === 2 && !u.divorced)?.id ?? unions.find((u) => u.partners.length === 2)?.id ?? '',
  );
  // surname fields the user typed in themselves are never overwritten by suggestions
  const [touched, setTouched] = useState<Set<SurnameKey>>(() => new Set());
  const withSuggestions = (cur: Person, sex: Sex, union: string, keep: Set<SurnameKey>): Person => {
    if (!adding || !anchor) return cur;
    const s = suggestSurnames(graph, adding.kind, anchor, sex, union);
    const next = { ...cur };
    for (const k of SURNAME_KEYS) if (!keep.has(k)) next[k] = (s[k] || (k === 'lastName' ? '' : undefined)) as string;
    return next;
  };
  const [p, setP] = useState<Person>(() => {
    const base = structuredClone(initial);
    if (!adding || !anchor) return base;
    if (base.sex === 'U') base.sex = defaultSex(graph, adding.kind, anchor);
    return withSuggestions(base, base.sex, unionId, new Set());
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [details, setDetails] = useState<UnionDetails>({ kind: 'married' });
  // phone: sections fold away (on a computer they are always open)
  const [openSecs, setOpenSecs] = useState<Set<string>>(() => new Set(adding || initial.firstName === '' ? ['names', 'sex', 'birth'] : ['names']));
  const toggleSec = (k: string) => setOpenSecs((cur) => {
    const next = new Set(cur);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    return next;
  });

  const set = <K extends keyof Person>(k: K, v: Person[K]) => setP((cur) => ({ ...cur, [k]: v }));
  const setSex = (sex: Sex) => setP((cur) => withSuggestions({ ...cur, sex }, sex, unionId, touched));
  const changeUnion = (id: string) => {
    setUnionId(id);
    setP((cur) => withSuggestions(cur, cur.sex, id, touched));
  };
  const setEv = (group: 'birth' | 'death' | 'burial', patch: Partial<LifeEvent & { cause?: string }>) =>
    setP((cur) => {
      const ev = { ...(cur[group] ?? {}), ...patch } as Record<string, unknown>;
      for (const k of Object.keys(ev)) if (ev[k] === '' || ev[k] === undefined) delete ev[k];
      return { ...cur, [group]: Object.keys(ev).length ? ev : undefined };
    });

  const submit = () => {
    // unfold every section so the field at fault is visible on a phone
    const fail = (msg: string) => { setError(msg); setOpenSecs(new Set(['names', 'sex', 'birth', 'death', 'bio'])); };
    if (!p.firstName.trim() && !p.firstNameHe?.trim()) return fail(t('needName'));
    for (const ev of [p.birth, p.death, p.burial]) if (ev?.date && !DATE_RE.test(ev.date)) return fail(t('dateHint'));
    if (adding?.kind === 'partner' && !validUnion(details)) return fail(t('dateHint'));
    onSave(p, unionId || undefined, adding?.kind === 'partner' ? details : undefined);
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const blob = await compressImage(file);
      set('photo', await uploadPhoto(p.id, blob));
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const text = (key: keyof Person & MsgKey, dir?: 'ltr' | 'rtl') => (
    <label className="field">
      <span>{t(key)}</span>
      <input
        dir={dir}
        value={(p[key] as string) ?? ''}
        onChange={(e) => {
          if ((SURNAME_KEYS as string[]).includes(key)) setTouched((cur) => new Set(cur).add(key as SurnameKey));
          set(key, e.target.value as never);
        }}
      />
    </label>
  );

  const eventFields = (group: 'birth' | 'death' | 'burial', withDate = true, extra?: ReactNode) => {
    const ev = p[group];
    return (
      <div className="ev-fields">
        {withDate && (
          <>
            <label className="field">
              <span>{t('date')}</span>
              <input dir="ltr" inputMode="numeric" placeholder="1950-04-23" value={ev?.date ?? ''} onChange={(e) => setEv(group, { date: e.target.value.trim() })} />
            </label>
            <label className="field narrow">
              <span>{t('qualifier')}</span>
              <select value={ev?.qualifier ?? ''} onChange={(e) => setEv(group, { qualifier: (e.target.value || undefined) as LifeEvent['qualifier'] })}>
                <option value="">{t('exact')}</option>
                <option value="about">{t('about')}</option>
                <option value="before">{t('before')}</option>
                <option value="after">{t('after')}</option>
              </select>
            </label>
          </>
        )}
        <label className="field">
          <span>{t('place')}</span>
          <input value={ev?.place ?? ''} onChange={(e) => setEv(group, { place: e.target.value })} />
        </label>
        {extra}
      </div>
    );
  };

  const title = adding && anchor
    ? t('addingAs', { rel: t(ADD_LABEL[adding.kind]), name: displayName(anchor, lang) })
    : displayName(p, lang);
  const sec = (key: string, label: string, summary: string, body: ReactNode) => (
    <Section title={label} summary={summary} open={openSecs.has(key)} onToggle={() => toggleSec(key)}>{body}</Section>
  );
  const evSummary = (ev?: LifeEvent) => [formatDate(ev, lang), ev?.place].filter(Boolean).join(', ');

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <form className="modal person-form" onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <div className="form-topbar">
          <button type="button" className="btn ghost" onClick={onCancel}>{t('cancel')}</button>
          <b className="form-topbar-title">{title}</b>
          <button type="submit" className="btn primary" disabled={busy}>{t('save')}</button>
        </div>
        {error && <p className="error">{error}</p>}

        <div className="photo-row">
          <Avatar person={p} size={72} />
          <label className="btn">
            {p.photo ? t('changePhoto') : t('uploadPhoto')}
            <input type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />
          </label>
          {p.photo && <button type="button" className="btn ghost" onClick={() => set('photo', undefined)}>{t('removePhoto')}</button>}
          {busy && <span className="muted">…</span>}
        </div>

        {adding?.kind === 'child' && unions.length > 0 && (
          <label className="field">
            <span>{t('withPartner')}</span>
            <select value={unionId} onChange={(e) => changeUnion(e.target.value)}>
              {unions.map((u) => {
                const other = graph.get(u.partners.find((x) => x !== adding.anchorId));
                return <option key={u.id} value={u.id}>{other ? displayName(other, lang) : t('noPartner')}</option>;
              })}
              <option value="">{t('noPartner')}</option>
            </select>
          </label>
        )}

        {adding?.kind === 'partner' && <UnionFields value={details} onChange={setDetails} />}

        {sec('names', t('namesSection'), '', <>
          <p className="hint">{t('namesHint')}</p>
          <div className="grid2">
            {text('firstNameHe', 'rtl')}
            {text('lastNameHe', 'rtl')}
            {text('firstName', 'ltr')}
            {text('lastName', 'ltr')}
            {text('marriedNameHe', 'rtl')}
            {text('marriedName', 'ltr')}
          </div>
        </>)}

        {sec('sex', t('sex'), t(p.sex === 'M' ? 'male' : p.sex === 'F' ? 'female' : 'unknown'), (
          <div className="radios">
            {(['M', 'F', 'U'] as Sex[]).map((s) => (
              <label key={s}>
                <input type="radio" name="sex" checked={p.sex === s} onChange={() => setSex(s)} />
                {t(s === 'M' ? 'male' : s === 'F' ? 'female' : 'unknown')}
              </label>
            ))}
          </div>
        ))}

        {sec('birth', t('born'), evSummary(p.birth), <>
          {eventFields('birth')}
          <p className="hint">{t('dateHint')}</p>
        </>)}

        {sec('death', t('deathSection'), p.deceased ? evSummary(p.death) || t('deceased') : t('alive'), <>
          <label className="check">
            <input type="checkbox" checked={p.deceased} onChange={(e) => set('deceased', e.target.checked)} />
            {t('deceased')}
          </label>
          {p.deceased && (
            <>
              <fieldset>
                <legend>{t('died')}</legend>
                {eventFields(
                  'death',
                  true,
                  <label className="field">
                    <span>{t('cause')}</span>
                    <input value={p.death?.cause ?? ''} onChange={(e) => setEv('death', { cause: e.target.value })} />
                  </label>,
                )}
              </fieldset>
              <fieldset>
                <legend>{t('buried')}</legend>
                {eventFields('burial', false)}
              </fieldset>
            </>
          )}
        </>)}

        {sec('bio', t('bio'), p.bio ? '✓' : '', (
          <label className="field">
            <span className="desk-only">{t('bio')}</span>
            <textarea rows={4} value={p.bio ?? ''} onChange={(e) => set('bio', e.target.value || undefined)} aria-label={t('bio')} />
          </label>
        ))}

      </form>
    </div>
  );
}
