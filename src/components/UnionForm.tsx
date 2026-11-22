import { useState } from 'react';
import type { LifeEvent, Union } from '../types';
import type { UnionDetails } from '../lib/ops';
import { useLang } from '../lib/LangContext';

type Status = 'married' | 'partners' | 'divorced';
const statusOf = (u: UnionDetails): Status => (u.divorced ? 'divorced' : u.kind === 'partners' ? 'partners' : 'married');

const DATE_RE = /^\d{4}(-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?)?$/;
export const validUnion = (u: UnionDetails) => [u.marriage?.date, u.divorce?.date].every((d) => !d || DATE_RE.test(d));

/** Status + marriage/divorce fields, used when editing a relationship and when adding a partner. */
export function UnionFields({ value, onChange }: { value: UnionDetails; onChange: (v: UnionDetails) => void }) {
  const { t } = useLang();
  const status = statusOf(value);

  const setStatus = (s: Status) =>
    onChange({
      ...value,
      kind: s === 'partners' ? 'partners' : 'married',
      divorced: s === 'divorced' || undefined,
      divorce: s === 'divorced' ? value.divorce : undefined,
    });

  const setEv = (key: 'marriage' | 'divorce', patch: Partial<LifeEvent>) => {
    const ev = { ...(value[key] ?? {}), ...patch } as Record<string, unknown>;
    for (const k of Object.keys(ev)) if (!ev[k]) delete ev[k];
    onChange({ ...value, [key]: Object.keys(ev).length ? (ev as LifeEvent) : undefined });
  };

  return (
    <>
      <fieldset className="radios">
        <legend>{t('status')}</legend>
        {(['married', 'partners', 'divorced'] as Status[]).map((s) => (
          <label key={s}>
            <input type="radio" name="union-status" checked={status === s} onChange={() => setStatus(s)} />
            {t(s === 'married' ? 'statusMarried' : s === 'partners' ? 'statusPartners' : 'statusDivorced')}
          </label>
        ))}
      </fieldset>
      {status !== 'partners' && (
        <fieldset>
          <legend>{t('married')}</legend>
          <div className="ev-fields">
            <label className="field">
              <span>{t('date')}</span>
              <input dir="ltr" placeholder="1950-04-23" value={value.marriage?.date ?? ''} onChange={(e) => setEv('marriage', { date: e.target.value.trim() })} />
            </label>
            <label className="field">
              <span>{t('place')}</span>
              <input value={value.marriage?.place ?? ''} onChange={(e) => setEv('marriage', { place: e.target.value })} />
            </label>
          </div>
        </fieldset>
      )}
      {status === 'divorced' && (
        <fieldset>
          <legend>{t('divorce')}</legend>
          <div className="ev-fields">
            <label className="field">
              <span>{t('date')}</span>
              <input dir="ltr" placeholder="1980" value={value.divorce?.date ?? ''} onChange={(e) => setEv('divorce', { date: e.target.value.trim() })} />
            </label>
          </div>
        </fieldset>
      )}
    </>
  );
}

interface Props {
  union: Union;
  title: string;
  canDelete: boolean;
  onSave: (u: Union) => void;
  onDelete: () => void;
  onCancel: () => void;
}

export function UnionForm({ union, title, canDelete, onSave, onDelete, onCancel }: Props) {
  const { t } = useLang();
  const [u, setU] = useState<Union>(() => structuredClone(union));
  const [error, setError] = useState('');

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <form
        className="modal"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (!validUnion(u)) return setError(t('dateHint'));
          onSave(u);
        }}
      >
        <h2>{title}</h2>
        <UnionFields value={u} onChange={(v) => setU({ ...u, ...v })} />
        <p className="hint">{t('dateHint')}</p>
        {error && <p className="error">{error}</p>}
        <div className="modal-actions">
          <button type="submit" className="btn primary">{t('save')}</button>
          <button type="button" className="btn ghost" onClick={onCancel}>{t('cancel')}</button>
          {canDelete && (
            <button type="button" className="btn danger" style={{ marginInlineStart: 'auto' }} onClick={onDelete}>
              {t('deleteRelationship')}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
