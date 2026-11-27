import { useEffect, useState, type ReactNode } from 'react';
import type { LifeEvent, Person, Union } from '../types';
import type { RelativeKind } from '../lib/ops';
import {
  displayName, factLabel, formatDate, fullName, nicknameOf, hebrewDate, isRtl, lifeSpan, nameParts, relationLabel, type MsgKey,
} from '../lib/i18n';
import { useLang } from '../lib/LangContext';
import { swipeHandlers } from '../lib/useMobile';
import { Avatar } from './Avatar';
import { Thumb } from './Documents';
import { Icon } from './Icons';
import type { Props } from './PersonPanel';

type Tab = 'details' | 'family' | 'docs';

interface SheetAction {
  label: string;
  icon?: string;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

/** A list of choices: slides up from the bottom on a phone, a small dialog on a computer. */
export function ActionSheet({ title, items, onClose }: { title?: string; items: SheetAction[]; onClose: () => void }) {
  const { t } = useLang();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="sheet-scrim" onClick={onClose}>
      <section className="bottom-sheet" onClick={(e) => e.stopPropagation()} role="menu">
        <div className="grab" />
        {title && <h2 className="action-title">{title}</h2>}
        {items.map((i) => (
          <button key={i.label} className={`action-item${i.danger ? ' danger' : ''}`} disabled={i.disabled} role="menuitem"
            onClick={() => { onClose(); i.onClick(); }}>
            {i.icon && <Icon name={i.icon} />}
            {i.label}
          </button>
        ))}
        <button className="btn ghost block" onClick={onClose}>{t('cancel')}</button>
      </section>
    </div>
  );
}

/** The four relationship choices, shared by the person sheet and the "add relative" buttons. */
export function addRelativeItems(t: (k: MsgKey) => string, parentsCount: number, onAdd: (k: RelativeKind) => void): SheetAction[] {
  return ([
    ['parent', 'addParent'], ['partner', 'addPartner'], ['child', 'addChild'], ['sibling', 'addSibling'],
  ] as [RelativeKind, MsgKey][]).map(([kind, key]) => ({
    label: t(key), icon: 'userPlus', disabled: kind === 'parent' && parentsCount >= 2, onClick: () => onAdd(kind),
  }));
}

/**
 * A person, in the style of a contacts entry: avatar and name, round quick actions,
 * then Details / Family / Documents tabs.
 * - phone: a sheet over the tree that peeks (name, actions, close family) and expands to full screen
 *   (swipe up / down on its top, or tap the handle);
 * - computer (`side`): a panel beside the tree, always expanded.
 */
export function MobileSheet({
  graph, person, relations, isAdmin, editMode, onOpen, onEdit, onEditUnion, onAdd, onDelete, onClose, onDocuments, variant = 'mobile',
}: Props & { variant?: 'mobile' | 'side' }) {
  const { lang, t } = useLang();
  const side = variant === 'side';
  const [expanded, setExpanded] = useState(false);
  const full = side || expanded;
  const [tab, setTab] = useState<Tab>('details');
  const [addOpen, setAddOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  useEffect(() => { setAddOpen(false); setMoreOpen(false); }, [person.id]);

  const rel = relations?.get(person.id);
  const shown = fullName(person, lang);
  const { née } = nameParts(person, lang);
  const otherScript = lang === 'he'
    ? [person.firstName, person.marriedName || person.lastName].filter(Boolean).join(' ')
    : [person.firstNameHe, person.marriedNameHe || person.lastNameHe].filter(Boolean).join(' ');
  const span = lifeSpan(person, lang);
  const parents = graph.parents(person.id);
  const children = graph.children(person.id);
  const siblings = graph.siblings(person.id);
  const relationships = graph.unionsOf(person.id).filter((u) => u.partners.some((p) => p !== person.id));
  const partnerOf = (u: Union) => graph.get(u.partners.find((p) => p !== person.id))!;
  const docs = person.documents ?? [];
  const canEdit = editMode !== 'none';
  const showDocs = canEdit || docs.length > 0;
  const chevron = isRtl(lang) ? 'back' : 'forward';
  const editLabel = t(editMode === 'suggest' ? 'suggestEdit' : 'edit');
  const nick = nicknameOf(person, lang);
  const subline = [nick ? `"${nick}"` : '', otherScript && otherScript !== shown ? otherScript : '', span].filter(Boolean).join(' · ');

  const swipe = side ? {} : swipeHandlers((dir) => {
    if (dir === 'up') setExpanded(true);
    else if (dir === 'down') (expanded ? setExpanded(false) : onClose());
  });

  const statusText = (u: Union) => {
    const parts = [t(u.divorced ? 'statusDivorced' : u.kind === 'partners' ? 'statusPartners' : 'statusMarried')];
    const m = formatDate(u.marriage, lang);
    const d = formatDate(u.divorce, lang);
    if (m || d) parts.push(`⁨${[m, d].filter(Boolean).join(' – ')}⁩`);
    return parts.join(' · ');
  };

  const sheets = <>
    {addOpen && <ActionSheet title={t('addRelative')} onClose={() => setAddOpen(false)} items={addRelativeItems(t, parents.length, onAdd)} />}
    {moreOpen && (
      <ActionSheet onClose={() => setMoreOpen(false)} items={[
        { label: t('centerInTree'), icon: 'target', onClick: () => onOpen(person.id) },
        ...(isAdmin && canEdit ? [{ label: t('delete'), icon: 'trash', danger: true, onClick: onDelete }] : []),
      ]} />
    )}
  </>;

  const hero = (big: boolean) => (
    <div className={`sheet-hero${big ? ' big' : ''}`}>
      <Avatar person={person} size={big ? 96 : 64} />
      <div className="sheet-hero-text">
        <h2>{shown}</h2>
        {subline && <div className="muted">{subline}</div>}
        {rel && <span className={`rel-chip${rel.kind.k === 'self' ? ' me' : ''}`}>{relationLabel(rel, lang)}</span>}
      </div>
    </div>
  );

  const quickActions = (
    <div className="quick-actions">
      <button className="qa" onClick={() => onOpen(person.id)}><span className="qa-ic"><Icon name="tree" /></span>{t('inTree')}</button>
      {showDocs && (
        <button className="qa" onClick={() => (docs.length ? onDocuments() : onDocuments(undefined, true))}>
          <span className="qa-ic"><Icon name="image" /></span>{t('docsShort')}{docs.length ? ` · ${docs.length}` : ''}
        </button>
      )}
      {canEdit && <button className="qa" onClick={() => setAddOpen(true)}><span className="qa-ic"><Icon name="userPlus" /></span>{t('addShortRelative')}</button>}
      {canEdit && <button className="qa" onClick={onEdit}><span className="qa-ic"><Icon name="pencil" /></span>{editLabel}</button>}
    </div>
  );

  // ---------- phone, peeking ----------
  if (!full) {
    const nameList = (list: Person[]) => list.map((p, i) => (
      <span key={p.id}>
        {i > 0 && ' · '}
        <button className="link-btn" onClick={() => onOpen(p.id)}>{displayName(p, lang)}</button>
      </span>
    ));
    return (
      <aside className="sheet peek" aria-label={shown}>
        <div className="sheet-top" {...swipe}>
          <button className="grab-btn" onClick={() => setExpanded(true)} aria-label={t('allDetails')}><span className="grab" /></button>
          <div className="peek-head">
            {hero(false)}
            <button className="icon-btn big" onClick={onClose} aria-label={t('close')}><Icon name="close" /></button>
          </div>
        </div>
        {quickActions}
        <dl className="peek-family">
          {parents.length > 0 && <div><dt>{t('parents')}</dt><dd>{nameList(parents)}</dd></div>}
          {relationships.length > 0 && <div><dt>{t('partners')}</dt><dd>{nameList(relationships.map(partnerOf))}</dd></div>}
          {children.length > 0 && <div><dt>{t('children')}</dt><dd>{nameList(children)}</dd></div>}
        </dl>
        <button className="btn tonal block" onClick={() => setExpanded(true)}>{t('allDetails')} <Icon name="up" size={20} /></button>
        {sheets}
      </aside>
    );
  }

  // ---------- expanded (phone) / side panel (computer) ----------
  const event = (key: MsgKey, icon: string, ev: LifeEvent | undefined, extra?: string) => {
    const date = formatDate(ev, lang);
    const heb = hebrewDate(ev);
    if (!date && !ev?.place && !extra) return null;
    return (
      <div className="info-item">
        <Icon name={icon} />
        <div>
          <b>{t(key)}{date ? ` · ${date}` : ''}</b>
          <small>{[heb, ev?.place, extra].filter(Boolean).join(' · ')}</small>
        </div>
      </div>
    );
  };

  const row = (p: Person, sub?: string, extra?: ReactNode) => (
    <div className="person-row" key={p.id}>
      <button className="person-row-main" onClick={() => onOpen(p.id)}>
        <Avatar person={p} size={40} />
        <span className="pr-text"><span>{displayName(p, lang)}</span>{sub && <small className="muted">{sub}</small>}</span>
        {!extra && <Icon name={chevron} />}
      </button>
      {extra}
    </div>
  );
  const group = (title: MsgKey, list: Person[]) => list.length > 0 && (
    <section className="info-card"><h3>{t(title)}{list.length > 1 ? ` · ${list.length}` : ''}</h3>{list.map((p) => row(p, lifeSpan(p, lang)))}</section>
  );

  return (
    <aside className={`sheet ${side ? 'side' : 'full'}`} aria-label={shown}>
      <div className="sheet-top" {...swipe}>
        {!side && <span className="grab" />}
        <div className="full-bar">
          {side ? (
            <button className="icon-btn big" onClick={onClose} aria-label={t('close')}><Icon name="close" /></button>
          ) : (
            <button className="icon-btn big" onClick={() => setExpanded(false)} aria-label={t('collapse')}><Icon name="down" /></button>
          )}
          <span className="full-bar-title">{shown}</span>
          {canEdit && <button className="icon-btn big" onClick={onEdit} aria-label={editLabel}><Icon name="pencil" /></button>}
          <button className="icon-btn big" onClick={() => setMoreOpen(true)} aria-label={t('moreActions')}><Icon name="more" /></button>
          {!side && <button className="icon-btn big" onClick={onClose} aria-label={t('close')}><Icon name="close" /></button>}
        </div>
      </div>

      <div className="sheet-body">
        {hero(true)}
        {quickActions}
        {editMode === 'suggest' && <p className="hint center">{t('suggestHint')}</p>}
        <div className="sheet-tabs" role="tablist">
          <button role="tab" className={tab === 'details' ? 'on' : ''} onClick={() => setTab('details')}>{t('detailsTab')}</button>
          <button role="tab" className={tab === 'family' ? 'on' : ''} onClick={() => setTab('family')}>{t('familyTab')}</button>
          {showDocs && (
            <button role="tab" className={tab === 'docs' ? 'on' : ''} onClick={() => setTab('docs')}>
              {t('docsShort')}{docs.length ? ` · ${docs.length}` : ''}
            </button>
          )}
        </div>

        {tab === 'details' && (
          <>
            <section className="info-card">
              {née && <div className="info-item"><Icon name="badge" /><div><b>{t('née')} {née}</b></div></div>}
              {event('born', 'cake', person.birth)}
              {person.deceased && event('died', 'local_florist', person.death,
                person.death?.cause ? `${t('cause')}: ${person.death.cause}` : !person.death ? t('deceased') : undefined)}
              {event('buried', 'location_on', person.burial)}
              {person.facts?.map((f, i) => (
                <div className="info-item" key={i}><Icon name="info" /><div><b>{factLabel(lang, f.label)}</b><small>{f.value}</small></div></div>
              ))}
              {!née && !person.birth && !person.death && !person.burial && !person.facts?.length && !person.deceased && (
                <p className="muted empty-line">{t('noDetails')}</p>
              )}
            </section>
            {person.bio && <section className="info-card"><h3>{t('bio')}</h3><p className="bio">{person.bio}</p></section>}
          </>
        )}
        {tab === 'family' && (
          <>
            {group('parents', parents)}
            {relationships.length > 0 && (
              <section className="info-card">
                <h3>{t('partners')}</h3>
                {relationships.map((u) => row(partnerOf(u), statusText(u), canEdit && (
                  <button className="icon-btn big" onClick={() => onEditUnion(u.id)} aria-label={t('editRelationship')}><Icon name="pencil" size={20} /></button>
                )))}
                {canEdit && <p className="hint">{t('relationshipHint')}</p>}
              </section>
            )}
            {group('children', children)}
            {group('siblings', siblings)}
          </>
        )}
        {tab === 'docs' && (
          <div className="sheet-docs">
            {docs.map((d, i) => <Thumb key={d.id} doc={d} onClick={() => onDocuments(i)} />)}
            {canEdit && (
              <button className="doc-thumb add" onClick={() => onDocuments(undefined, true)} aria-label={t('addDocument')}>
                <Icon name="addPhoto" size={28} />
              </button>
            )}
          </div>
        )}
      </div>
      {sheets}
    </aside>
  );
}
