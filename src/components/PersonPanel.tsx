import type { LifeEvent, Person, Union } from '../types';
import type { FamilyGraph } from '../lib/graph';
import type { RelationFinder } from '../lib/relation';
import type { RelativeKind } from '../lib/ops';
import { displayName, factLabel, formatDate, hebrewDate, nameParts, relationLabel, type MsgKey } from '../lib/i18n';
import { useLang } from '../lib/LangContext';
import { Avatar } from './Avatar';

interface Props {
  graph: FamilyGraph;
  person: Person;
  relations: RelationFinder | undefined;
  isAdmin: boolean;
  /** edit = change directly, suggest = changes go to an admin, none = names-only viewer */
  editMode: 'edit' | 'suggest' | 'none';
  onOpen: (id: string) => void;
  onEdit: () => void;
  onEditUnion: (unionId: string) => void;
  onAdd: (kind: RelativeKind) => void;
  onDelete: () => void;
  onClose: () => void;
}

export function PersonPanel({ graph, person, relations, isAdmin, editMode, onOpen, onEdit, onEditUnion, onAdd, onDelete, onClose }: Props) {
  const { lang, t } = useLang();
  const rel = relations?.get(person.id);
  const { née } = nameParts(person, lang);
  const otherScript = lang === 'he'
    ? [person.firstName, person.marriedName || person.lastName].filter(Boolean).join(' ')
    : [person.firstNameHe, person.marriedNameHe || person.lastNameHe].filter(Boolean).join(' ');
  const shown = displayName(person, lang);

  const event = (key: MsgKey, ev: LifeEvent | undefined, extra?: string) => {
    const date = formatDate(ev, lang);
    const heb = hebrewDate(ev);
    if (!date && !ev?.place && !extra) return null;
    return (
      <div className="ev">
        <dt>{t(key)}</dt>
        <dd>
          {date && <span>{date}</span>}
          {heb && <span className="heb-date" title={t('hebrewDate')}>{heb}</span>}
          {ev?.place && <span className="place">📍 {ev.place}</span>}
          {extra && <span className="muted">{extra}</span>}
        </dd>
      </div>
    );
  };

  const people = (title: MsgKey, list: Person[]) =>
    list.length > 0 && (
      <section>
        <h3>{t(title)}</h3>
        <div className="chips">
          {list.map((p) => (
            <button key={p.id} className="chip" onClick={() => onOpen(p.id)}>
              <Avatar person={p} size={26} />
              <span>{displayName(p, lang)}</span>
            </button>
          ))}
        </div>
      </section>
    );

  const relationships = graph.unionsOf(person.id).filter((u) => u.partners.some((p) => p !== person.id));
  const statusText = (u: Union) => {
    const parts = [t(u.divorced ? 'statusDivorced' : u.kind === 'partners' ? 'statusPartners' : 'statusMarried')];
    const m = formatDate(u.marriage, lang);
    const d = formatDate(u.divorce, lang);
    if (m || d) parts.push(`⁨${[m, d].filter(Boolean).join(' – ')}⁩`);
    if (u.marriage?.place) parts.push(u.marriage.place);
    return parts.join(' · ');
  };

  return (
    <aside className="panel" aria-label={shown}>
      <button className="panel-close" onClick={onClose} aria-label={t('close')}>×</button>
      <header className="panel-head">
        <Avatar person={person} size={96} />
        <h2>{shown}</h2>
        {née && <div className="muted">{t('née')} {née}</div>}
        {otherScript && otherScript !== shown && <div className="other-script">{otherScript}</div>}
        {rel && <span className={`card-rel big${rel.kind.k === 'self' ? ' me' : ''}`}>{relationLabel(rel, lang)}</span>}
      </header>

      <dl className="events">
        {event('born', person.birth)}
        {person.deceased && event('died', person.death, person.death?.cause ? `${t('cause')}: ${person.death.cause}` : !person.death ? t('deceased') : undefined)}
        {event('buried', person.burial)}
      </dl>

      {person.facts?.length ? (
        <section>
          <h3>{t('facts')}</h3>
          <dl className="facts">
            {person.facts.map((f, i) => (
              <div key={i}>
                <dt>{factLabel(lang, f.label)}</dt>
                <dd>{f.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {person.bio && (
        <section>
          <h3>{t('bio')}</h3>
          <p className="bio">{person.bio}</p>
        </section>
      )}

      {people('parents', graph.parents(person.id))}
      {relationships.length > 0 && (
        <section>
          <h3>{t('partners')}</h3>
          <ul className="relationships">
            {relationships.map((u) => {
              const other = graph.get(u.partners.find((p) => p !== person.id))!;
              return (
                <li key={u.id} className={u.divorced ? 'divorced' : ''}>
                  <button className="chip" onClick={() => onOpen(other.id)}>
                    <Avatar person={other} size={26} />
                    <span>{displayName(other, lang)}</span>
                  </button>
                  <span className="rel-status">{statusText(u)}</span>
                  {editMode !== 'none' && <button className="icon-btn" onClick={() => onEditUnion(u.id)} title={t('editRelationship')} aria-label={t('editRelationship')}>✎</button>}
                </li>
              );
            })}
          </ul>
          {editMode !== 'none' && <p className="hint">{t('relationshipHint')}</p>}
        </section>
      )}
      {people('children', graph.children(person.id))}
      {people('siblings', graph.siblings(person.id))}

      {editMode !== 'none' && <section className="panel-actions">
        {editMode === 'suggest' && <p className="hint">{t('suggestHint')}</p>}
        <button className="btn primary" onClick={onEdit}>✎ {t(editMode === 'suggest' ? 'suggestEdit' : 'edit')}</button>
        <h3>{t('addRelative')}</h3>
        <div className="add-grid">
          <button className="btn" disabled={graph.parents(person.id).length >= 2} onClick={() => onAdd('parent')}>+ {t('addParent')}</button>
          <button className="btn" onClick={() => onAdd('partner')}>+ {t('addPartner')}</button>
          <button className="btn" onClick={() => onAdd('child')}>+ {t('addChild')}</button>
          <button className="btn" onClick={() => onAdd('sibling')}>+ {t('addSibling')}</button>
        </div>
        {isAdmin && <button className="btn danger" onClick={onDelete}>{t('delete')}</button>}
      </section>}
    </aside>
  );
}
