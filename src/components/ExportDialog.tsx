import { useMemo, useState } from 'react';
import type { DecisionRecord, Finding } from '../types';
import type { FamilyGraph } from '../lib/graph';
import { buildExport, scopeIds, type ExportOptions, type ExportScope } from '../lib/exporter';
import { displayName } from '../lib/i18n';
import { useLang } from '../lib/LangContext';

interface Props {
  graph: FamilyGraph;
  viewerId: string;
  /** the person open in the tree, for "this person and their descendants" */
  currentId?: string;
  /** admins: research findings, so approved ones can go into the export */
  findings: Finding[];
  decisions: Record<string, DecisionRecord>;
  onClose: () => void;
}

/** "Export my data": choose what goes into the ZIP, then build and download it. */
export function ExportDialog({ graph, viewerId, currentId, findings, decisions, onClose }: Props) {
  const { lang, t } = useLang();
  const hasMe = Boolean(graph.get(viewerId));
  const from = currentId && graph.get(currentId) ? currentId : undefined;
  const [opts, setOpts] = useState<ExportOptions>({
    scope: 'all', fromId: from, diagram: 'full', photos: true, docs: true, research: false, index: true, gedcom: false, living: false,
  });
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [done, setDone] = useState('');
  const set = (patch: Partial<ExportOptions>) => setOpts((o) => ({ ...o, ...patch }));
  const counts = useMemo(() => ({
    all: Object.keys(graph.people).length,
    mine: hasMe ? scopeIds(graph, 'mine', viewerId).size : 0,
    from: from ? scopeIds(graph, 'from', viewerId, from).size : 0,
  }), [graph, viewerId, from, hasMe]);
  const approved = findings.some((f) => decisions[f.id]?.d === 'approved');

  const run = async () => {
    setBusy(true);
    setDone('');
    try {
      const { blob, failed, fileName } = await buildExport(
        opts,
        { graph, lang, t, viewerId, findings, decisions },
        (n, total) => setProgress(t('exportFiles', { done: String(n), total: String(total) })),
      );
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = fileName;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
      setDone([t('exportDone', { name: fileName }), failed ? t('exportFailedFiles', { n: String(failed) }) : ''].filter(Boolean).join(' '));
    } catch (e) {
      setDone(`${t('saveFailed')}: ${e instanceof Error ? e.message : e}`);
    }
    setProgress('');
    setBusy(false);
  };

  const check = (key: keyof ExportOptions, label: string, hint?: string, disabled?: boolean) => (
    <label className="check export-check">
      <input type="checkbox" checked={Boolean(opts[key])} disabled={disabled || busy} onChange={(e) => set({ [key]: e.target.checked })} />
      <span>{label}{hint && <small className="muted">{hint}</small>}</span>
    </label>
  );
  const scopeBtn = (s: ExportScope, label: string) => (
    <button key={s} className={`seg${opts.scope === s ? ' on' : ''}`} disabled={busy} onClick={() => set({ scope: s })}>{label}</button>
  );

  return (
    <div className="modal-backdrop" onClick={busy ? undefined : onClose}>
      <div className="modal export-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={t('exportTitle')}>
        <h2>{t('exportTitle')}</h2>
        <p className="muted" style={{ margin: 0 }}>{t('exportIntro')}</p>

        <fieldset>
          <legend>{t('exportScope')}</legend>
          <div className="segmented wrap">
            {scopeBtn('all', t('scopeAll', { n: String(counts.all) }))}
            {hasMe && scopeBtn('mine', t('scopeMine', { n: String(counts.mine) }))}
            {from && scopeBtn('from', t('scopeFrom', { name: displayName(graph.people[from], lang), n: String(counts.from) }))}
          </div>
        </fieldset>

        <fieldset>
          <legend>{t('exportDiagram')}</legend>
          <div className="segmented wrap">
            <button className={`seg${opts.diagram === 'full' ? ' on' : ''}`} disabled={busy} onClick={() => set({ diagram: 'full' })}>{t('diagramFull')}</button>
            <button className={`seg${opts.diagram === 'fan' ? ' on' : ''}`} disabled={busy} onClick={() => set({ diagram: 'fan' })}>{t('diagramFan')}</button>
          </div>
        </fieldset>

        <fieldset>
          <legend>{t('exportPerPerson')}</legend>
          <label className="check export-check"><input type="checkbox" checked disabled /><span>{t('exportDetails')}</span></label>
          {check('photos', t('exportPhotos'))}
          {check('docs', t('exportDocs'))}
          {approved && check('research', t('exportResearch'))}
        </fieldset>

        <fieldset>
          <legend>{t('exportMore')}</legend>
          {check('index', t('exportIndex'))}
          {check('gedcom', t('exportGedcom'))}
          {check('living', t('exportLiving'), t('exportLivingHint'))}
        </fieldset>

        {progress && <p className="muted" role="status">{progress}</p>}
        {done && <p role="status">{done}</p>}
        <div className="modal-actions">
          <button className="btn primary" disabled={busy} onClick={run}>{busy ? t('exportBusy') : t('exportGo')}</button>
          <button className="btn ghost" disabled={busy} onClick={onClose}>{t('close')}</button>
        </div>
      </div>
    </div>
  );
}
