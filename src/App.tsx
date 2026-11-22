import { useEffect, useMemo, useRef, useState } from 'react';
import type { Decision, DecisionRecord, FamilyData, Finding, Person, Side } from './types';
import { FamilyGraph } from './lib/graph';
import { RelationFinder } from './lib/relation';
import {
  addRelative, applyFinding, blankPerson, deletePerson, deleteUnion, updateUnion, upsertPerson,
  type RelativeKind, type UnionDetails,
} from './lib/ops';
import { applyChange, diffData, isEmptyChange } from './lib/diff';
import { LANGS, displayName, isRtl, translate, type Lang, type MsgKey } from './lib/i18n';
import { LangContext } from './lib/LangContext';
import { initialLang, prefs } from './lib/prefs';
import type { Profile, Role } from './lib/supabase';
import { LocalStore } from './data/store';
import { cloudStore, type Suggestion } from './data/cloudStore';
import { DECISIONS_KEY, LOCAL_FINDINGS, SEED_DATA, localSavedData, localSavedDecisions } from './data/localSeed';
import type { CloudSession } from './components/AuthGate';
import { UnionForm } from './components/UnionForm';
import { MapView } from './components/MapView';
import { TreeView } from './components/TreeView';
import { PersonPanel } from './components/PersonPanel';
import { PersonForm } from './components/PersonForm';
import { SearchBox } from './components/SearchBox';
import { ReviewPage } from './components/ReviewPage';
import { AdminPage, AdminTools, ImportPanel, type AdminTab } from './components/AdminPage';
import { SuggestionsList } from './components/SuggestionsList';
import { UsersAdmin } from './components/UsersAdmin';
import { DocumentsGallery } from './components/Documents';

const localStore = new LocalStore();

/** The file a photo or document finding points to. */
function findingFileUrl(f: Finding): string | undefined {
  if (f.field === 'photo') return typeof f.value === 'string' ? f.value : undefined;
  if (f.field === 'document') return (f.value as { url?: string } | null)?.url || undefined;
  return undefined;
}

const ADD_LABEL: Record<RelativeKind, MsgKey> = { parent: 'addParent', partner: 'addPartner', child: 'addChild', sibling: 'addSibling' };

type FormState =
  | { mode: 'edit'; person: Person }
  | { mode: 'add'; kind: RelativeKind; anchorId: string; person: Person }
  | { mode: 'first'; person: Person };

/**
 * `cloud` is set in cloud mode (signed in with Google, data in Supabase).
 * Without it the app runs as the old browser-only prototype.
 */
export default function App({ cloud }: { cloud?: CloudSession }) {
  const role: Role | undefined = cloud?.profile.role;
  const [devAdmin, setDevAdmin] = useState(prefs.get('admin') !== 'false');
  const isAdmin = cloud ? role === 'admin' : devAdmin;
  const namesOnly = role === 'pending';
  const editMode = namesOnly ? 'none' : cloud && !isAdmin ? 'suggest' : 'edit';

  const [data, setData] = useState<FamilyData | null>(null);
  const [loadError, setLoadError] = useState('');
  const [lang, setLang] = useState<Lang>(initialLang);
  const [viewerId, setViewerId] = useState<string>(cloud?.profile.person_id ?? prefs.get('viewer') ?? '');
  const [focusId, setFocusId] = useState('');
  const [selectedId, setSelectedId] = useState<string>();
  const [side, setSide] = useState<Side>('all');
  const [up, setUp] = useState(3);
  const [down, setDown] = useState(2);
  const [view, setView] = useState<'tree' | 'admin' | 'map'>('tree');
  const [adminTab, setAdminTab] = useState<AdminTab>('suggestions');
  const [form, setForm] = useState<FormState | null>(null);
  const [editingUnion, setEditingUnion] = useState<{ unionId: string; fromId: string } | null>(null);
  const [gallery, setGallery] = useState<{ personId: string; index?: number; adding?: boolean } | null>(null);
  const [findings, setFindings] = useState<Finding[]>(cloud ? [] : LOCAL_FINDINGS);
  const [decisions, setDecisions] = useState<Record<string, DecisionRecord>>(() => (cloud ? {} : localSavedDecisions()));
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [toast, setToast] = useState('');
  const toastTimer = useRef<number>();

  const t = useMemo(() => (key: Parameters<typeof translate>[1], vars?: Record<string, string>) => translate(lang, key, vars), [lang]);

  const showToast = (msg: string) => {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(''), 4000);
  };

  // load the tree (again whenever the account's role changes)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const d = cloud ? await cloudStore.load(namesOnly) : await localStore.load();
        if (cancelled) return;
        setData(d);
        const own = cloud?.profile.person_id;
        const viewer = [own, viewerId].find((id) => id && d.people[id]) ?? Object.keys(d.people)[0] ?? '';
        setViewerId(viewer);
        const params = new URLSearchParams(location.hash.slice(1));
        // a link like  #p=I500035  opens that person
        const linked = params.get('p');
        if (linked && d.people[linked]) {
          setFocusId(linked);
          setSelectedId(linked);
        } else setFocusId(viewer);
        const linkedView = params.get('view');
        if (linkedView === 'map' && !namesOnly) setView('map');
        if (linkedView === 'review' && isAdmin) {
          setView('admin');
          setAdminTab('research');
        }
        if (cloud && isAdmin) {
          const [f, dec, sug, prof] = await Promise.all([
            cloudStore.loadFindings(), cloudStore.loadDecisions(), cloudStore.listSuggestions(), cloudStore.listProfiles(),
          ]);
          if (cancelled) return;
          setFindings(f);
          setDecisions(dec);
          setSuggestions(sug);
          setProfiles(prof);
        }
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => { cancelled = true; };
  }, [role]); // eslint-disable-line react-hooks/exhaustive-deps

  // when an admin links this very account to a person, center on them
  useEffect(() => {
    const own = cloud?.profile.person_id;
    if (own && data?.people[own]) {
      setViewerId(own);
      setFocusId(own);
    }
  }, [cloud?.profile.person_id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = isRtl(lang) ? 'rtl' : 'ltr';
    document.title = translate(lang, 'appTitle');
    prefs.set('lang', lang);
  }, [lang]);

  useEffect(() => prefs.set('viewer', viewerId || null), [viewerId]);
  useEffect(() => { if (!cloud) prefs.set('admin', String(devAdmin)); }, [devAdmin, cloud]);
  useEffect(() => {
    if (!cloud) try { localStorage.setItem(DECISIONS_KEY, JSON.stringify(decisions)); } catch { /* full */ }
  }, [decisions, cloud]);

  const graph = useMemo(() => (data ? new FamilyGraph(data) : null), [data]);
  const relations = useMemo(() => (graph && viewerId ? new RelationFinder(graph, viewerId) : undefined), [graph, viewerId]);

  /**
   * Every change goes through here. Admins (and the local prototype) change the tree directly;
   * family members send the same change to the admins as a suggestion.
   */
  const commit = (next: FamilyData, summary: string) => {
    if (!data) return;
    if (cloud && !isAdmin) {
      const change = diffData(data, next);
      if (isEmptyChange(change)) return;
      cloudStore.suggest(change, summary)
        .then(() => showToast(t('suggestionSent')))
        .catch((e) => alert(`${t('saveFailed')}: ${e?.message ?? e}`));
      return;
    }
    setData(next);
    if (cloud) {
      cloudStore.save(next).catch((e) => {
        alert(`${t('saveFailed')}: ${e?.message ?? e}`);
        cloudStore.load(false).then(setData).catch(() => undefined);
      });
    } else {
      localStore.save(next).catch(() => alert('Saving failed (browser storage full?)'));
    }
  };

  if (loadError) return <div className="loading"><p className="error">{t('loadFailed')}<br /><small dir="ltr">{loadError}</small></p></div>;
  if (!data || !graph) return <div className="loading">…</div>;

  const pendingFindings = findings.filter((f) => !decisions[f.id]).length;
  const pendingSuggestions = suggestions.filter((s) => s.status === 'pending').length;
  const pendingUsers = profiles.filter((p) => p.role === 'pending').length;
  const adminBadge = pendingFindings + pendingSuggestions + pendingUsers;
  const selected = selectedId ? graph.get(selectedId) : undefined;
  const hasPeople = Object.keys(data.people).length > 0;
  const nameOf = (id: string) => {
    const p = graph.get(id);
    return p ? displayName(p, lang) : '?';
  };

  const openPerson = (id: string) => {
    setFocusId(id);
    setSelectedId(id);
    setView('tree');
    history.replaceState(null, '', `#p=${id}`);
  };

  const saveForm = (person: Person, unionId?: string, details?: UnionDetails) => {
    if (!form) return;
    let next: FamilyData;
    let summary: string;
    if (form.mode === 'add') {
      next = addRelative(data, form.anchorId, form.kind, person, unionId, details);
      summary = `${t(ADD_LABEL[form.kind])}: ${displayName(person, lang)} (${nameOf(form.anchorId)})`;
    } else {
      next = upsertPerson(data, person);
      summary = `${t('edit')}: ${displayName(person, lang)}`;
    }
    commit(next, summary);
    if (form.mode === 'first') {
      setViewerId(person.id);
      setFocusId(person.id);
    }
    setForm(null);
  };

  const remove = (p: Person) => {
    if (!confirm(t('confirmDelete', { name: displayName(p, lang) }))) return;
    commit(deletePerson(data, p.id), `${t('delete')}: ${displayName(p, lang)}`);
    setSelectedId(undefined);
    if (focusId === p.id) setFocusId(viewerId !== p.id ? viewerId : Object.keys(data.people).find((id) => id !== p.id) ?? '');
    if (viewerId === p.id) setViewerId('');
  };

  // ---------- research findings ----------

  /** Findings may point at a person another finding creates ("new:bh3"); resolve once that one is approved. */
  const resolvePersonId = (pid: string): string | undefined => {
    if (!pid.startsWith('new:')) return pid;
    const rec = decisions[pid.slice(4)];
    return rec?.d === 'approved' ? rec.createdIds?.[0] : undefined;
  };

  const decide = (finding: Finding, d: Decision | undefined) => {
    const prev = decisions[finding.id];
    if (prev?.d === 'approved' && d !== 'approved') {
      const dependents = findings.some((x) => x.personId === `new:${finding.id}` && decisions[x.id]?.d === 'approved');
      if (dependents) return alert(t('undoDependentsFirst'));
    }
    let f = finding;
    if (d === 'approved' && (finding.field === 'photo' || finding.field === 'document') && !findingFileUrl(finding)) {
      return alert(t('fileDeleted'));
    }
    if (d === 'approved') {
      const pid = resolvePersonId(finding.personId);
      if (!pid) return alert(t('approveFirst', { name: finding.personName ?? '?' }));
      f = { ...finding, personId: pid };
    }
    let next = data;
    // undo a previous approval first
    if (prev?.d === 'approved') {
      if (prev.personBefore) next = upsertPerson(next, prev.personBefore);
      for (const id of prev.createdIds ?? []) next = deletePerson(next, id);
    }
    const rec: Record<string, DecisionRecord> = { ...decisions };
    delete rec[f.id];
    if (d === 'approved') {
      try {
        const before = next.people[f.personId];
        const applied = applyFinding(next, f);
        const createdIds = Object.keys(applied.people).filter((id) => !next.people[id]);
        rec[f.id] = { d, personBefore: f.type === 'field' ? before : undefined, createdIds };
        next = applied;
      } catch {
        alert(t('applyFailed'));
        return;
      }
    } else if (d === 'rejected') {
      rec[f.id] = { d };
    }
    if (next !== data) commit(next, `${t('review')}: ${finding.personName ?? ''}`);
    setDecisions(rec);
    if (cloud) cloudStore.saveDecision(f.id, rec[f.id] ?? null).catch((e) => alert(`${t('saveFailed')}: ${e?.message ?? e}`));
    if (cloud && d === 'rejected') dropRejectedFile(finding, next, rec);
  };

  /** The stored file of a rejected finding that nothing else needs any more (the tree or another open finding). */
  const droppableFile = (finding: Finding, tree: FamilyData, rec: Record<string, DecisionRecord>) => {
    const url = findingFileUrl(finding);
    if (!url || !url.includes('/storage/v1/object/public/') || rec[finding.id]?.d !== 'rejected') return undefined;
    const inTree = Object.values(tree.people).some((p) => p.photo === url || p.documents?.some((doc) => doc.url === url));
    const inOther = findings.some((x) => x.id !== finding.id && rec[x.id]?.d !== 'rejected' && findingFileUrl(x) === url);
    return inTree || inOther ? undefined : url;
  };

  /** A rejected scan or photo shouldn't take space: delete its file. */
  const dropRejectedFile = async (finding: Finding, tree: FamilyData, rec: Record<string, DecisionRecord>, quiet = false) => {
    const url = droppableFile(finding, tree, rec);
    if (!url) return;
    try {
      const stored = await cloudStore.dropFindingFile(finding, url);
      setFindings((cur) => cur.map((x) => (x.id === stored.id ? stored : x)));
    } catch (e) {
      if (quiet) throw e;
      alert(`${t('fileDeleteFailed')}\n${(e as Error)?.message ?? e}`);
    }
  };

  const simpleDecisions = Object.fromEntries(Object.entries(decisions).map(([k, v]) => [k, v.d]));

  // ---------- admin: suggestions & users ----------

  const decideSuggestion = async (s: Suggestion, status: 'approved' | 'rejected') => {
    try {
      if (status === 'approved') {
        const next = applyChange(data, s.change);
        await cloudStore.save(next);
        setData(next);
      }
      await cloudStore.setSuggestionStatus(s.id, status);
      setSuggestions((list) => list.map((x) => (x.id === s.id ? { ...x, status, decided_at: new Date().toISOString() } : x)));
    } catch (e) {
      alert(`${t('saveFailed')}: ${e instanceof Error ? e.message : e}`);
    }
  };

  const afterUserChange = async (p: Profile) => {
    setProfiles(await cloudStore.listProfiles());
    if (p.user_id === cloud?.profile.user_id) await cloud.refreshProfile();
  };

  // The full move from the prototype is offered only while the cloud tree is empty,
  // so stale browser data can never overwrite edits made on the live site.
  const cloudTreeEmpty = Object.keys(data.people).length === 0;
  const localData = cloud && isAdmin && cloudTreeEmpty ? localSavedData() ?? SEED_DATA : null;
  const localDecisions = localData ? localSavedDecisions() : {};
  const canImport = Boolean(localData && (Object.keys(localData.people).length || LOCAL_FINDINGS.length));
  // New research files on this computer (dev server only - builds contain none) that the cloud doesn't have yet.
  const cloudFindingIds = new Set(findings.map((f) => f.id));
  const newLocalFindings = cloud && isAdmin && !cloudTreeEmpty ? LOCAL_FINDINGS.filter((f) => !cloudFindingIds.has(f.id)) : [];
  const uploadNewFindings = async () => {
    await cloudStore.addFindings(newLocalFindings, findings.length);
    setFindings(await cloudStore.loadFindings());
    showToast(t('researchUploaded', { n: String(newLocalFindings.length) }));
    setAdminTab('research');
  };
  // files of findings rejected earlier (before files were deleted on rejection, or when deleting failed)
  const leftoverFiles = cloud && isAdmin ? findings.filter((f) => droppableFile(f, data, decisions)) : [];
  const cleanupLeftovers = async () => {
    const done = new Set<string>();
    for (const f of leftoverFiles) {
      const url = findingFileUrl(f)!;
      if (done.has(url)) {
        // the same file under another rejected finding: already gone, just clear this finding too
        const stored = await cloudStore.dropFindingFile(f, '');
        setFindings((cur) => cur.map((x) => (x.id === stored.id ? stored : x)));
      } else await dropRejectedFile(f, data, decisions, true);
      done.add(url);
    }
    showToast(t('cleanupDone', { n: String(leftoverFiles.length) }));
  };
  const downloadBackup = () => {
    const json = JSON.stringify({ exportedAt: new Date().toISOString(), data, decisions, findings }, null, 1);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    a.download = 'family-export.local.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const profileMap = Object.fromEntries(profiles.map((p) => [p.user_id, p]));

  const research = (
    <ReviewPage
      graph={graph}
      findings={findings}
      decisions={simpleDecisions}
      resolveId={resolvePersonId}
      onDecide={decide}
      onShowPerson={openPerson}
      embedded
    />
  );

  return (
    <LangContext.Provider value={{ lang, t }}>
      <div className="app">
        <header className="topbar">
          <div className="brand" onClick={() => setView('tree')}>
            <img className="logo" src={`${import.meta.env.BASE_URL}logo-256.png`} alt="" />
            <h1>{t('appTitle')}</h1>
          </div>
          <SearchBox graph={graph} onPick={openPerson} />
          <div className="top-actions">
            {!namesOnly && (
              <div className="segmented" role="tablist">
                <button className={`seg${view === 'tree' ? ' on' : ''}`} onClick={() => setView('tree')}>🌳 {t('tree')}</button>
                <button className={`seg${view === 'map' ? ' on' : ''}`} onClick={() => setView('map')}>🗺 {t('map')}</button>
              </div>
            )}
            {isAdmin && (
              <button className={`btn review-btn${view === 'admin' ? ' on' : ''}`} onClick={() => setView(view === 'admin' ? 'tree' : 'admin')}>
                {view === 'admin' ? t('backToTree') : cloud ? t('manage') : t('review')}
                {view !== 'admin' && adminBadge > 0 && <span className="badge">{adminBadge}</span>}
              </button>
            )}
            <select className="lang" value={lang} onChange={(e) => setLang(e.target.value as Lang)} aria-label="Language">
              {LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
            </select>
            {cloud && (
              <div className="user-chip" title={cloud.profile.email ?? ''}>
                {cloud.profile.avatar_url && <img src={cloud.profile.avatar_url} alt="" referrerPolicy="no-referrer" />}
                <button className="btn ghost small" onClick={cloud.signOut}>{t('signOut')}</button>
              </div>
            )}
          </div>
        </header>

        {namesOnly && (
          <div className="banner">
            <span>⏳ {t('pendingBanner')}</span>
            {cloud && cloud.profile.attempts < 3 && (
              <button className="btn small" onClick={cloud.openRegister}>{t('fixDetails')}</button>
            )}
          </div>
        )}

        {view !== 'admin' && hasPeople && (
          <div className="toolbar">
            <div className="segmented" role="group">
              {(['all', 'father', 'mother'] as Side[]).map((s) => (
                <button key={s} className={`seg${side === s ? ' on' : ''}`} onClick={() => setSide(s)}>
                  {t(s === 'all' ? 'sideAll' : s === 'father' ? 'sideFather' : 'sideMother')}
                </button>
              ))}
            </div>
            {view === 'tree' && <>
            <label className="depth">
              {t('generationsUp')}
              <select value={up} onChange={(e) => setUp(Number(e.target.value))}>
                {[1, 2, 3, 4, 5, 6].map((n) => <option key={n}>{n}</option>)}
              </select>
            </label>
            <label className="depth">
              {t('generationsDown')}
              <select value={down} onChange={(e) => setDown(Number(e.target.value))}>
                {[0, 1, 2, 3, 4].map((n) => <option key={n}>{n}</option>)}
              </select>
            </label>
            {focusId !== viewerId && viewerId && (
              <button className="btn small" onClick={() => openPerson(viewerId)}>⟲ {t('backToMe')}</button>
            )}
            </>}
          </div>
        )}

        <main className="main">
          {view === 'admin' && isAdmin ? (
            cloud ? (
              <AdminPage
                tab={adminTab}
                onTab={setAdminTab}
                tabs={{
                  suggestions: [
                    <SuggestionsList graph={graph} suggestions={suggestions} profiles={profileMap} onDecide={decideSuggestion} onShowPerson={openPerson} />,
                    pendingSuggestions,
                  ],
                  research: [research, pendingFindings],
                  users: [
                    <UsersAdmin
                      graph={graph}
                      profiles={profiles}
                      meId={cloud.profile.user_id}
                      onRole={async (p, r) => { await cloudStore.setRole(p.user_id, r); await afterUserChange(p); }}
                      onLink={async (p, pid) => {
                        await cloudStore.link(p.user_id, pid);
                        setData(await cloudStore.load(false)); // the Google photo may have been added
                        await afterUserChange(p);
                      }}
                      onShowPerson={openPerson}
                    />,
                    pendingUsers,
                  ],
                  import: [
                    <AdminTools
                      newFindings={newLocalFindings.length}
                      onUploadFindings={uploadNewFindings}
                      leftoverFiles={leftoverFiles.length}
                      onCleanup={cleanupLeftovers}
                      onBackup={downloadBackup}
                      importPanel={canImport && localData ? (
                        <ImportPanel
                          counts={{
                            people: Object.keys(localData.people).length,
                            unions: Object.keys(localData.unions).length,
                            findings: LOCAL_FINDINGS.length,
                            decisions: Object.keys(localDecisions).length,
                          }}
                          onImport={(progress) => cloudStore.importAll(localData, LOCAL_FINDINGS, localDecisions, progress)}
                        />
                      ) : undefined}
                    />,
                    newLocalFindings.length,
                  ],
                }}
              />
            ) : (
              <div className="review"><div className="review-inner">{research}</div></div>
            )
          ) : view === 'map' && !namesOnly ? (
            <MapView graph={graph} relations={relations} side={side} isAdmin={isAdmin} onOpenPerson={openPerson} />
          ) : hasPeople && graph.get(focusId) ? (
            <>
              <TreeView
                graph={graph}
                relations={relations}
                focusId={focusId}
                viewerId={viewerId}
                selectedId={selectedId}
                side={side}
                up={up}
                down={down}
                onSelect={openPerson}
                panelOpen={Boolean(selected)}
              />
              {selected && (
                <PersonPanel
                  graph={graph}
                  person={selected}
                  relations={relations}
                  isAdmin={isAdmin}
                  editMode={editMode}
                  onOpen={openPerson}
                  onEdit={() => setForm({ mode: 'edit', person: selected })}
                  onEditUnion={(unionId) => setEditingUnion({ unionId, fromId: selected.id })}
                  onAdd={(kind) => setForm({ mode: 'add', kind, anchorId: selected.id, person: blankPerson() })}
                  onDelete={() => remove(selected)}
                  onClose={() => setSelectedId(undefined)}
                  onDocuments={(index, adding) => setGallery({ personId: selected.id, index, adding })}
                />
              )}
            </>
          ) : (
            <div className="empty-state">
              <p>{t('emptyTree')}</p>
              {isAdmin && (
                <div className="empty-actions">
                  {cloud && canImport && (
                    <button className="btn primary" onClick={() => { setView('admin'); setAdminTab('import'); }}>{t('tabImport')}</button>
                  )}
                  <button className="btn" onClick={() => setForm({ mode: 'first', person: blankPerson() })}>{t('addFirstPerson')}</button>
                </div>
              )}
            </div>
          )}
        </main>

        {!cloud && (
          <footer className="devbar">
            <span className="dev-tag">DEV</span>
            <label>
              {t('viewingAs')}:{' '}
              <select value={viewerId} onChange={(e) => { setViewerId(e.target.value); openPerson(e.target.value); }}>
                {Object.values(data.people)
                  .sort((a, b) => displayName(a, lang).localeCompare(displayName(b, lang)))
                  .map((p) => <option key={p.id} value={p.id}>{displayName(p, lang)}</option>)}
              </select>
            </label>
            <label className="check">
              <input type="checkbox" checked={devAdmin} onChange={(e) => setDevAdmin(e.target.checked)} /> {t('admin')}
            </label>
            <span className="muted dev-note">{t('devNote')}</span>
            <button
              className="btn ghost small"
              title="Download all local changes (backup / for research)"
              onClick={() => {
                const json = JSON.stringify({ exportedAt: new Date().toISOString(), data, decisions }, null, 1);
                const a = document.createElement('a');
                a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
                a.download = 'family-export.local.json';
                a.click();
                setTimeout(() => URL.revokeObjectURL(a.href), 1000);
              }}
            >
              Export
            </button>
            <button
              className="btn ghost small"
              onClick={async () => {
                if (!confirm('Reset all local changes to the imported MyHeritage data?')) return;
                setData(await localStore.reset());
                setDecisions({});
              }}
            >
              Reset
            </button>
          </footer>
        )}

        {toast && <div className="toast" role="status">{toast}</div>}

        {editingUnion && data.unions[editingUnion.unionId] && (() => {
          const u = data.unions[editingUnion.unionId];
          const other = graph.get(u.partners.find((p) => p !== editingUnion.fromId));
          const me = graph.get(editingUnion.fromId);
          const a = me ? displayName(me, lang) : '?';
          const b = other ? displayName(other, lang) : '?';
          return (
            <UnionForm
              union={u}
              title={t('relationshipWith', { name: b })}
              canDelete={isAdmin}
              onCancel={() => setEditingUnion(null)}
              onSave={(nu) => {
                commit(updateUnion(data, nu), `${t('editRelationship')}: ${a} – ${b}`);
                setEditingUnion(null);
              }}
              onDelete={() => {
                if (!confirm(t('confirmDeleteRelationship', { a, b }))) return;
                commit(deleteUnion(data, u.id), `${t('deleteRelationship')}: ${a} – ${b}`);
                setEditingUnion(null);
              }}
            />
          );
        })()}

        {gallery && data.people[gallery.personId] && (
          <DocumentsGallery
            key={gallery.personId}
            person={data.people[gallery.personId]}
            editMode={editMode}
            startIndex={gallery.index}
            startAdding={gallery.adding}
            upload={(id, blob, name) => (cloud ? cloudStore.uploadFile(id, blob, name) : localStore.uploadFile(id, blob, name))}
            onSave={(documents, summary) => {
              // keep an empty list rather than dropping the field, so a suggested removal merges as a removal
              commit(upsertPerson(data, { ...data.people[gallery.personId], documents }), summary);
              if (editMode === 'suggest') setGallery(null); // members' changes wait for an admin
            }}
            onClose={() => setGallery(null)}
          />
        )}

        {form && (
          <PersonForm
            graph={graph}
            initial={form.person}
            adding={form.mode === 'add' ? { kind: form.kind, anchorId: form.anchorId } : undefined}
            onSave={saveForm}
            onCancel={() => setForm(null)}
            uploadPhoto={(id, blob) => (cloud ? cloudStore.uploadPhoto(id, blob) : localStore.uploadPhoto(id, blob))}
          />
        )}
      </div>
    </LangContext.Provider>
  );
}
