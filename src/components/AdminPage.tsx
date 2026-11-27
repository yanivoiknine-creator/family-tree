import { useState, type ReactNode } from 'react';
import type { MsgKey } from '../lib/i18n';
import { useLang } from '../lib/LangContext';

export type AdminTab = 'suggestions' | 'research' | 'researchTree' | 'users' | 'import';

interface Props {
  tab: AdminTab;
  onTab: (tab: AdminTab) => void;
  /** tab → [content, badge count]; tabs left out are not shown */
  tabs: Partial<Record<AdminTab, [ReactNode, number]>>;
}

const LABEL: Record<AdminTab, MsgKey> = {
  suggestions: 'tabSuggestions', research: 'tabResearch', researchTree: 'tabResearchTree', users: 'tabUsers', import: 'tabImport',
};

/** The admin area: suggestions from the family, research findings, users, one-time import. */
export function AdminPage({ tab, onTab, tabs }: Props) {
  const { t } = useLang();
  const keys = (Object.keys(LABEL) as AdminTab[]).filter((k) => tabs[k]);
  const current = tabs[tab] ? tab : keys[0];
  const nav = keys.length > 1 && (
    <nav className="admin-tabs" role="tablist">
      {keys.map((k) => (
        <button key={k} role="tab" className={`admin-tab${k === current ? ' on' : ''}`} onClick={() => onTab(k)}>
          {t(LABEL[k])}
          {tabs[k]![1] > 0 && <span className="badge">{tabs[k]![1]}</span>}
        </button>
      ))}
    </nav>
  );
  // the research tree needs the whole area, not a reading column
  if (current === 'researchTree') {
    return (
      <div className="admin-wide">
        <div className="admin-wide-nav">{nav}</div>
        <div className="admin-wide-body">{tabs[current]![0]}</div>
      </div>
    );
  }
  return (
    <div className="review">
      <div className="review-inner">
        {nav}
        {current && tabs[current]![0]}
      </div>
    </div>
  );
}

interface ToolsProps {
  /** research findings found on this computer that the cloud doesn't have yet */
  newFindings: number;
  onUploadFindings: () => Promise<void>;
  /** files still stored for findings that were rejected */
  leftoverFiles: number;
  onCleanup: () => Promise<void>;
  onBackup: () => void;
  /** the one-time full import, shown only while the cloud tree is still empty */
  importPanel?: ReactNode;
}

/** Admin tools: upload new research, download a backup, and (once) move the prototype's data. */
export function AdminTools({ newFindings, onUploadFindings, leftoverFiles, onCleanup, onBackup, importPanel }: ToolsProps) {
  const { t } = useLang();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [cleanMsg, setCleanMsg] = useState('');
  return (
    <>
      {importPanel}
      {leftoverFiles > 0 && (
        <section className="review-group">
          <h2>{t('cleanupTitle')}</h2>
          <p>{t('cleanupText', { n: String(leftoverFiles) })}</p>
          <button
            className="btn"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setCleanMsg('');
              try {
                await onCleanup();
              } catch (e) {
                setCleanMsg(`${t('fileDeleteFailed')} ${String((e as Error)?.message ?? e)}`);
              }
              setBusy(false);
            }}
          >
            🗑 {t('cleanupButton')}
          </button>
          {cleanMsg && <p className="error">{cleanMsg}</p>}
        </section>
      )}
      {newFindings > 0 && (
        <section className="review-group">
          <h2>{t('researchUploadTitle')}</h2>
          <p>{t('researchUploadText', { n: String(newFindings) })}</p>
          <button
            className="btn primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setMsg('');
              try {
                await onUploadFindings();
              } catch (e) {
                setMsg(String(e));
              }
              setBusy(false);
            }}
          >
            {t('researchUploadButton')}
          </button>
          {msg && <p className="muted" dir="ltr">{msg}</p>}
        </section>
      )}
      <section className="review-group">
        <h2>{t('backupTitle')}</h2>
        <p>{t('backupText')}</p>
        <button className="btn" onClick={onBackup}>{t('backupButton')}</button>
      </section>
    </>
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
