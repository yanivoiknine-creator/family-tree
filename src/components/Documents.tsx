import { useEffect, useState } from 'react';
import type { Person, PersonDoc } from '../types';
import { displayName, isRtl } from '../lib/i18n';
import { useLang } from '../lib/LangContext';
import { compressImage } from '../lib/image';
import { docKind, newId } from '../lib/ops';
import { swipeHandlers } from '../lib/useMobile';
import { Icon } from './Icons';

const MAX_FILE = 20 * 1024 * 1024;

/** A link that downloads the file instead of opening it (Supabase honours ?download=<name>). */
export function downloadHref(doc: PersonDoc): string {
  if (doc.url.includes('/storage/v1/object/public/')) {
    return `${doc.url}${doc.url.includes('?') ? '&' : '?'}download=${encodeURIComponent(doc.name)}`;
  }
  return doc.url;
}

export function Thumb({ doc, onClick }: { doc: PersonDoc; onClick: () => void }) {
  return (
    <button type="button" className="doc-thumb" onClick={onClick} title={doc.title || doc.name}>
      {doc.kind === 'image' ? (
        <img src={doc.url} alt="" loading="lazy" referrerPolicy="no-referrer" />
      ) : (
        <span className="doc-icon">{doc.kind === 'pdf' ? 'PDF' : '📄'}</span>
      )}
    </button>
  );
}

interface StripProps {
  person: Person;
  canAdd: boolean;
  /** open the gallery, on one item or on the add form */
  onOpen: (index?: number, adding?: boolean) => void;
}

/** The small row of thumbnails in the person panel. */
export function DocStrip({ person, canAdd, onOpen }: StripProps) {
  const { t } = useLang();
  const docs = person.documents ?? [];
  if (!docs.length && !canAdd) return null;
  return (
    <section className="doc-strip">
      <h3>
        {t('documents')} {docs.length > 0 && <span className="count">{docs.length}</span>}
      </h3>
      {docs.length > 0 && (
        <div className="doc-row">
          {docs.slice(0, 4).map((d, i) => <Thumb key={d.id} doc={d} onClick={() => onOpen(i)} />)}
          {docs.length > 4 && (
            <button type="button" className="doc-thumb more" onClick={() => onOpen()}>+{docs.length - 4}</button>
          )}
        </div>
      )}
      <div className="doc-strip-actions">
        {docs.length > 0 && <button className="btn small" onClick={() => onOpen()}>{t('openGallery')}</button>}
        {canAdd && <button className="btn small" onClick={() => onOpen(undefined, true)}>+ {t('addDocument')}</button>}
      </div>
    </section>
  );
}

interface GalleryProps {
  person: Person;
  editMode: 'edit' | 'suggest' | 'none';
  startIndex?: number;
  startAdding?: boolean;
  upload: (personId: string, blob: Blob, fileName: string) => Promise<string>;
  onSave: (docs: PersonDoc[], summary: string) => void;
  onClose: () => void;
}

interface Pending {
  file: File;
  title: string;
}

/** All the photos and documents of one person: thumbnails, a large view, download, add and delete. */
export function DocumentsGallery({ person, editMode, startIndex, startAdding, upload, onSave, onClose }: GalleryProps) {
  const { lang, t } = useLang();
  const docs = person.documents ?? [];
  const [viewing, setViewing] = useState<number | null>(startIndex ?? null);
  const [adding, setAdding] = useState(Boolean(startAdding));
  const [pending, setPending] = useState<Pending[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const name = displayName(person, lang);
  const canEdit = editMode !== 'none';
  const current = viewing !== null ? docs[viewing] : undefined;
  const [zoomed, setZoomed] = useState(false);
  useEffect(() => setZoomed(false), [viewing]);
  const go = (step: number) => viewing !== null && setViewing((viewing + step + docs.length) % docs.length);
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  const share = (doc: PersonDoc) => {
    navigator.share({ title: doc.title || doc.name, text: `${doc.title || doc.name} · ${name}`, url: doc.url }).catch(() => undefined);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') (viewing !== null ? setViewing(null) : onClose());
      if (viewing === null || docs.length < 2) return;
      let step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (getComputedStyle(document.body).direction === 'rtl') step = -step;
      if (step) setViewing((viewing + step + docs.length) % docs.length);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [viewing, docs.length, onClose]);

  const pick = (files: FileList | null) => {
    setError('');
    const list = [...(files ?? [])];
    const tooBig = list.filter((f) => f.size > MAX_FILE);
    if (tooBig.length) setError(`${t('fileTooBig')}: ${tooBig.map((f) => f.name).join(', ')}`);
    setPending((cur) => [...cur, ...list.filter((f) => f.size <= MAX_FILE).map((file) => ({ file, title: '' }))]);
  };

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      const added: PersonDoc[] = [];
      for (const { file, title } of pending) {
        const kind = docKind(file.name, file.type);
        let blob: Blob = file;
        let fileName = file.name;
        // shrink big pictures, but keep documents readable
        if (kind === 'image' && file.size > 1.5 * 1024 * 1024) {
          try {
            blob = await compressImage(file, 2400, 0.88);
            fileName = file.name.replace(/\.[^.]+$/, '') + '.jpg';
          } catch {
            /* a format the browser can't draw: keep the original */
          }
        }
        const url = await upload(person.id, blob, fileName);
        added.push({
          id: newId('D'), url, name: fileName, kind,
          ...(title.trim() ? { title: title.trim() } : {}),
          addedAt: new Date().toISOString(),
        });
      }
      onSave([...docs, ...added], t('docsAdded', { name }));
      setPending([]);
      setAdding(false);
    } catch (e) {
      setError(String((e as Error)?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const remove = (doc: PersonDoc) => {
    if (!confirm(t('confirmDeleteDoc'))) return;
    onSave(docs.filter((d) => d.id !== doc.id), t('docRemoved', { name }));
    setViewing(null);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className={`modal gallery${current ? ' viewing' : ''}`} onClick={(e) => e.stopPropagation()} role="dialog" aria-label={t('documents')}>
        <header className="gallery-head">
          {current && (
            <button className="icon-btn big mobile-only" onClick={() => setViewing(null)} aria-label={t('backToAll')}>
              <Icon name={isRtl(lang) ? 'forward' : 'back'} size={22} />
            </button>
          )}
          <h2>{t('documents')} · {name}</h2>
          {current && <span className="doc-count mobile-only" dir="ltr">{viewing! + 1} / {docs.length}</span>}
          <button className="panel-close" onClick={onClose} aria-label={t('close')}>×</button>
        </header>

        {current ? (
          <div className="doc-view">
            <div
              className={`doc-stage${zoomed ? ' zoomed' : ''}`}
              onDoubleClick={() => current.kind === 'image' && setZoomed(!zoomed)}
              {...swipeHandlers((dir) => {
                if (zoomed || docs.length < 2 || (dir !== 'left' && dir !== 'right')) return;
                // the next file comes from the reading direction's end
                const forward = isRtl(lang) ? dir === 'right' : dir === 'left';
                go(forward ? 1 : -1);
              }, 50)}
            >
              {current.kind === 'image' ? (
                <img src={current.url} alt={current.title || current.name} referrerPolicy="no-referrer" />
              ) : current.kind === 'pdf' ? (
                <iframe src={current.url} title={current.title || current.name} />
              ) : (
                <Icon name="doc" size={64} className="doc-icon big" />
              )}
              {docs.length > 1 && <>
                <button className="doc-nav prev" onClick={() => go(-1)} aria-label="‹">‹</button>
                <button className="doc-nav next" onClick={() => go(1)} aria-label="›">›</button>
              </>}
            </div>
            {docs.length > 1 && (
              <div className="doc-dots mobile-only" aria-hidden="true">
                {docs.map((d, i) => <span key={d.id} className={i === viewing ? 'on' : ''} />)}
              </div>
            )}
            <p className="doc-hint mobile-only">{t(current.kind === 'image' ? 'swipeHint' : 'swipeHintFile')}</p>
            <div className="doc-meta">
              <b>{current.title || current.name}</b>
              <span className="muted desk-only">{viewing! + 1} / {docs.length}</span>
              {current.sourceUrl && (
                <a href={current.sourceUrl} target="_blank" rel="noreferrer noopener">{t('source')} ↗</a>
              )}
            </div>
            <div className="modal-actions doc-actions">
              <button className="btn desk-only" onClick={() => setViewing(null)}>{t('backToAll')}</button>
              <a className="btn primary" href={downloadHref(current)} download={current.name}><Icon name="download" /><span>{t('download')}</span></a>
              {canShare && (
                <button className="btn" onClick={() => share(current)}><Icon name="share" /><span>{t('share')}</span></button>
              )}
              <a className="btn" href={current.url} target="_blank" rel="noreferrer noopener"><Icon name="external" /><span>{t('openNewTab')}</span></a>
              {canEdit && <button className="btn danger" onClick={() => remove(current)}><Icon name="trash" /><span>{t('delete')}</span></button>}
            </div>
          </div>
        ) : (
          <>
            {docs.length === 0 && !adding && <p className="empty">{t('noDocuments')}</p>}
            {docs.length > 0 && (
              <div className="doc-grid">
                {docs.map((d, i) => (
                  <figure key={d.id}>
                    <Thumb doc={d} onClick={() => setViewing(i)} />
                    <figcaption title={d.title || d.name}>{d.title || d.name}</figcaption>
                    <a className="doc-dl" href={downloadHref(d)} download={d.name} title={t('download')} aria-label={t('download')}>⬇</a>
                  </figure>
                ))}
              </div>
            )}

            {canEdit && (adding ? (
              <section className="doc-add">
                <h3>{t('addDocument')}</h3>
                {editMode === 'suggest' && <p className="hint">{t('suggestHint')}</p>}
                <label className="btn">
                  📎 {t('chooseFiles')}
                  <input type="file" accept="image/*,application/pdf" multiple hidden onChange={(e) => { pick(e.target.files); e.target.value = ''; }} />
                </label>
                {pending.map((p, i) => (
                  <div key={i} className="doc-pending">
                    <span className="doc-file" dir="ltr">{p.file.name}</span>
                    <input
                      value={p.title}
                      placeholder={t('docTitlePlaceholder')}
                      onChange={(e) => setPending((cur) => cur.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))}
                    />
                    <button className="icon-btn" onClick={() => setPending((cur) => cur.filter((_, j) => j !== i))} aria-label={t('delete')}>×</button>
                  </div>
                ))}
                {error && <p className="error">{error}</p>}
                <div className="modal-actions">
                  <button className="btn" onClick={() => { setAdding(false); setPending([]); setError(''); }}>{t('cancel')}</button>
                  <button className="btn primary" disabled={busy || pending.length === 0} onClick={save}>
                    {busy ? t('uploading') : t('save')}
                  </button>
                </div>
              </section>
            ) : (
              <div className="modal-actions">
                <button className="btn" onClick={() => setAdding(true)}>+ {t('addDocument')}</button>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
