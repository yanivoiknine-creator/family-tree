import { useState, type ReactNode } from 'react';
import type { MsgKey } from '../lib/i18n';
import { useLang } from '../lib/LangContext';

export type AdminTab = 'suggestions' | 'research' | 'users' | 'import';

interface Props {
  tab: AdminTab;
  onTab: (tab: AdminTab) => void;
  /** tab → [content, badge count]; tabs left out are not shown */
  tabs: Partial<Record<AdminTab, [ReactNode, number]>>;
}

const LABEL: Record<AdminTab, MsgKey> = {
  suggestions: 'tabSuggestions', research: 'tabResearch', users: 'tabUsers', import: 'tabImport',
};

/** The admin area: suggestions from the family, research findings, users, one-time import. */
export function AdminPage({ tab, onTab, tabs }: Props) {
  const { t } = useLang();
  const keys = (Object.keys(LABEL) as AdminTab[]).filter((k) => tabs[k]);
  const current = tabs[tab] ? tab : keys[0];
  return (
    <div className="review">
      <div className="review-inner">
        {keys.length > 1 && (
          <nav className="admin-tabs" role="tablist">
            {keys.map((k) => (
              <button key={k} role="tab" className={`admin-tab${k === current ? ' on' : ''}`} onClick={() => onTab(k)}>
                {t(LABEL[k])}
                {tabs[k]![1] > 0 && <span className="badge">{tabs[k]![1]}</span>}
              </button>
            ))}
          </nav>
        )}
        {current && tabs[current]![0]}
      </div>
    </div>
  );
}

interface ImportProps {
  counts: { people: number; unions: number; findings: number; decisions: number };
  onImport: (progress: (msg: string) => void) => Promise<void>;
}

/** One-time move of the browser prototype's data into Supabase. */
export function ImportPanel({ counts, onImport }: ImportProps) {
  const { t } = useLang();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const empty = counts.people === 0 && counts.findings === 0;
  return (
    <section className="review-group">
      <h2>{t('importTitle')}</h2>
      {empty ? (
        <p className="empty">{t('importNothing')}</p>
      ) : (
        <>
          <p>{t('importText')}</p>
          <p className="muted">{t('importCounts', {
            people: String(counts.people), unions: String(counts.unions),
            findings: String(counts.findings), decisions: String(counts.decisions),
          })}</p>
          <button
            className="btn primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onImport(setMsg);
                alert(t('importDone'));
                location.reload();
              } catch (e) {
                setMsg(String(e));
                setBusy(false);
              }
            }}
          >
            {t('importButton')}
          </button>
          {msg && <p className="muted" dir="ltr">{msg}</p>}
        </>
      )}
    </section>
  );
}
