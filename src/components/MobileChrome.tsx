import { useEffect, useState } from 'react';
import type { Side } from '../types';
import { LANGS, type Lang } from '../lib/i18n';
import { useLang } from '../lib/LangContext';
import { Icon } from './Icons';

/* App chrome in Material style: account menu, filter chips, navigation rail / bottom bar. */

interface MenuProps {
  avatarUrl?: string | null;
  initials: string;
  name?: string;
  email?: string | null;
  roleLabel?: string;
  badge: number;
  onMyCard?: () => void;
  admin?: { label: string; onClick: () => void };
  onLang: (l: Lang) => void;
  onSignOut?: () => void;
}

/** The avatar at the end of the search bar and its account card. */
export function AccountMenu({ avatarUrl, initials, name, email, roleLabel, badge, onMyCard, admin, onLang, onSignOut }: MenuProps) {
  const { lang, t } = useLang();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
  const run = (fn: () => void) => () => { setOpen(false); fn(); };
  const face = avatarUrl ? (
    <img src={avatarUrl} alt="" referrerPolicy="no-referrer" />
  ) : name ? (
    <span className="m-menu-initials">{initials}</span>
  ) : (
    <Icon name="menu" />
  );
  return (
    <div className="m-menu">
      <button className="m-menu-btn" onClick={() => setOpen(!open)} aria-label={t('menu')} aria-expanded={open}>
        {face}
        {badge > 0 && <span className="m-menu-badge">{badge}</span>}
      </button>
      {open && (
        <>
          <div className="m-menu-scrim" onClick={() => setOpen(false)} />
          <div className="m-menu-pop" role="dialog" aria-label={t('menu')}>
            <div className="m-menu-head">
              <button className="icon-btn big" onClick={() => setOpen(false)} aria-label={t('close')}><Icon name="close" /></button>
              <span>{t('appTitle')}</span>
            </div>
            {name && (
              <div className="m-menu-who">
                <span className="m-menu-face">{face}</span>
                <div>
                  <b>{name}</b>
                  {email && <span className="muted" dir="ltr">{email}</span>}
                </div>
                {roleLabel && <span className="role-chip">{roleLabel}</span>}
              </div>
            )}
            {onMyCard && (
              <button className="m-menu-item" onClick={run(onMyCard)}><Icon name="badge" /><span>{t('myCard')}</span></button>
            )}
            {admin && (
              <button className="m-menu-item" onClick={run(admin.onClick)}>
                <Icon name="manage" /><span>{admin.label}</span>
                {badge > 0 && <span className="badge">{badge}</span>}
              </button>
            )}
            <div className="m-menu-item static">
              <Icon name="globe" />
              <span>{t('language')}</span>
              <span className="m-lang">
                {LANGS.map((l) => (
                  <button key={l.code} className={l.code === lang ? 'on' : ''} onClick={() => onLang(l.code)}>{l.label}</button>
                ))}
              </span>
            </div>
            {onSignOut && (
              <button className="m-menu-item" onClick={run(onSignOut)}><Icon name="signOut" /><span>{t('signOut')}</span></button>
            )}
            <a className="m-menu-privacy" href={`${import.meta.env.BASE_URL}privacy.html`} target="_blank" rel="noreferrer">{t('privacy')}</a>
          </div>
        </>
      )}
    </div>
  );
}

const SIDE_KEY = { all: 'sideAll', father: 'sideFather', mother: 'sideMother' } as const;

interface FilterProps {
  side: Side;
  up: number;
  down: number;
  /** the map has no generations */
  showDepth: boolean;
  onSide: (s: Side) => void;
  onUp: (n: number) => void;
  onDown: (n: number) => void;
}

/** Filter chips over the tree / map: back to me, which side of the family, and how many generations. */
export function FilterChips(props: FilterProps & { onMe?: () => void }) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const { side, up, down, showDepth, onSide, onMe } = props;
  return (
    <div className="chips-bar" role="toolbar">
      {(['all', 'father', 'mother'] as Side[]).map((s) => (
        <button key={s} className={`chip${side === s ? ' on' : ''}`} onClick={() => onSide(s)} aria-pressed={side === s}>
          {side === s && <Icon name="check" size={18} />}
          {t(SIDE_KEY[s])}
        </button>
      ))}
      {showDepth && (
        <button className="chip" onClick={() => setOpen(true)} aria-label={t('treeView')}>
          <Icon name="filter" size={18} />
          <span dir="ltr">{up} ↑ · {down} ↓</span>
        </button>
      )}
      {onMe && (
        <button className="chip me-chip" onClick={onMe} aria-label={t('backToMe')} title={t('backToMe')}>
          <Icon name="target" size={18} />
          <span className="chip-label">{t('backToMe')}</span>
        </button>
      )}
      {open && <FilterSheet {...props} onClose={() => setOpen(false)} />}
    </div>
  );
}

function Stepper({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (n: number) => void }) {
  const { t } = useLang();
  return (
    <div className="sheet-row">
      <span>{label}</span>
      <span className="stepper">
        <button className="step" disabled={value <= min} onClick={() => onChange(value - 1)} aria-label={t('less')}><Icon name="minus" /></button>
        <b>{value}</b>
        <button className="step" disabled={value >= max} onClick={() => onChange(value + 1)} aria-label={t('more')}><Icon name="plus" /></button>
      </span>
    </div>
  );
}

function FilterSheet({ side, up, down, onSide, onUp, onDown, onClose }: FilterProps & { onClose: () => void }) {
  const { t } = useLang();
  return (
    <div className="sheet-scrim" onClick={onClose}>
      <section className="bottom-sheet" onClick={(e) => e.stopPropagation()} aria-label={t('treeView')}>
        <div className="grab" />
        <div className="bottom-sheet-head">
          <h2>{t('treeView')}</h2>
          <button className="icon-btn big" onClick={onClose} aria-label={t('close')}><Icon name="close" /></button>
        </div>
        <div className="sheet-label">{t('side')}</div>
        <div className="segmented wide">
          {(['all', 'father', 'mother'] as Side[]).map((s) => (
            <button key={s} className={`seg${side === s ? ' on' : ''}`} onClick={() => onSide(s)}>
              {side === s && <Icon name="check" size={18} />}{t(SIDE_KEY[s])}
            </button>
          ))}
        </div>
        <Stepper label={t('generationsUp')} value={up} min={1} max={6} onChange={onUp} />
        <Stepper label={t('generationsDown')} value={down} min={0} max={4} onChange={onDown} />
        <button className="btn primary block" onClick={onClose}>{t('show')}</button>
      </section>
    </div>
  );
}

export interface NavItem {
  key: string;
  label: string;
  icon: string;
  active?: boolean;
  badge?: number;
  onClick: () => void;
}

/** Main navigation: a rail on the side of a computer screen, a bar at the bottom of a phone. */
export function NavBar({ items, variant, fab }: { items: NavItem[]; variant: 'rail' | 'bar'; fab?: { label: string; onClick: () => void } }) {
  return (
    <nav className={`nav-${variant}`} aria-label="Navigation">
      {fab && variant === 'rail' && (
        <button className="fab" onClick={fab.onClick} aria-label={fab.label} title={fab.label}><Icon name="userPlus" /></button>
      )}
      {items.map((i) => (
        <button key={i.key} className={`nav-item${i.active ? ' on' : ''}`} onClick={i.onClick} aria-current={i.active ? 'page' : undefined}>
          <span className="nav-pill">
            <Icon name={i.icon} filled={i.active} />
            {i.badge ? <span className="nav-badge">{i.badge}</span> : null}
          </span>
          <span className="nav-label">{i.label}</span>
        </button>
      ))}
    </nav>
  );
}
