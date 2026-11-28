import { useEffect, useMemo, useRef, useState } from 'react';
import type { Decision, DecisionRecord, FamilyData, Finding, Person, Side } from './types';
import { FamilyGraph } from './lib/graph';
import { RelationFinder } from './lib/relation';
import {
  addRelative, applyFinding, blankPerson, deletePerson, deleteUnion, updateUnion, upsertPerson,
  type RelativeKind, type UnionDetails,
} from './lib/ops';
import { applyChange, diffData, isEmptyChange } from './lib/diff';
import { displayName, isRtl, translate, type Lang, type MsgKey } from './lib/i18n';
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
import { REVIEW_KEYS, ReviewPage } from './components/ReviewPage';
import { AdminPage, AdminTools, ImportPanel, type AdminTab } from './components/AdminPage';
import { SuggestionsList } from './components/SuggestionsList';
import { UsersAdmin } from './components/UsersAdmin';
import { DocumentsGallery } from './components/Documents';
import { ExportDialog } from './components/ExportDialog';
import { RTREE_KEYS, ResearchTree } from './components/ResearchTree';
import { ALL_GENS, AccountMenu, FilterChips, NavBar, type NavItem } from './components/MobileChrome';
import { gens, hashParams, onHistoryMove, oneOf, pick, pushHash, recall, remember, setHash, showGens } from './lib/urlState';
import { PersonReview, personSuggestions } from './components/PersonReview';
import { MAP_KEYS } from './components/MapView';
import { useIsMobile } from './lib/useMobile';
import { Icon } from './components/Icons';

const initialsOf = (name?: string | null) =>
  (name ?? '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

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
  const isGuest = role === 'guest';
  const namesOnly = role === 'pending';
  const editMode = namesOnly || isGuest ? 'none' : cloud && !isAdmin ? 'suggest' : 'edit';

  const [data, setData] = useState<FamilyData | null>(null);
  const [loadError, setLoadError] = useState('');
  const [lang, setLang] = useState<Lang>(initialLang);
  const [viewerId, setViewerId] = useState<string>(isGuest ? '' : cloud?.profile.person_id ?? prefs.get('viewer') ?? '');
  const [focusId, setFocusId] = useState('');
  const [selectedId, setSelectedId] = useState<string>();
  // the tree filter: a link (#side=…&up=…) wins, then this browser's last choice, then the default
  const [start] = useState(() => {
    const link = hashParams();
    const saved = isGuest ? {} : recall<{ side: Side; up: number; down: number }>('tree');
    return {
      side: pick(oneOf<Side>('all', 'father', 'mother')(link.get('side')), saved.side, 'all'),
      // guests start with the whole tree from afar, nobody highlighted, until they pick someone
      up: pick(gens(ALL_GENS)(link.get('up')), saved.up, isGuest ? ALL_GENS : 3),
      down: pick(gens(ALL_GENS)(link.get('down')), saved.down, isGuest ? ALL_GENS : 2),
      overview: isGuest && !link.get('p') && !link.get('f'),
    };
  });
  const [side, setSide] = useState<Side>(start.side);
  const [up, setUp] = useState(start.up);
  const [down, setDown] = useState(start.down);
  const [overview, setOverview] = useState(start.overview);
  /** the address is read once the tree has loaded; only then is it kept in step */
  const [urlReady, setUrlReady] = useState(false);
  /** where the tree is centred when nobody is picked (the viewer, or for guests the family's home person) */
  const [homeId, setHomeId] = useState('');
  const [view, setView] = useState<'tree' | 'admin' | 'map'>('tree');
  const mobile = useIsMobile();
  const [adminTab, setAdminTab] = useState<AdminTab>('suggestions');
  const [form, setForm] = useState<FormState | null>(null);
  const [editingUnion, setEditingUnion] = useState<{ unionId: string; fromId: string } | null>(null);
  const [gallery, setGallery] = useState<{ personId: string; index?: number; adding?: boolean } | null>(null);
  const [findings, setFindings] = useState<Finding[]>(cloud ? [] : LOCAL_FINDINGS);
  const [decisions, setDecisions] = useState<Record<string, DecisionRecord>>(() => (cloud ? {} : localSavedDecisions()));
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [toast, setToast] = useState('');
  const [exporting, setExporting] = useState(false);
  // every signed-in family member may export (not guests, not accounts waiting for approval)
  const canExport = !isGuest && !namesOnly;
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
        let d: FamilyData;
        let home: string | undefined;
        if (!cloud) d = await localStore.load();
        else if (isGuest || namesOnly) {
          // waiting accounts see what guests see (older databases without guest_tree: names only)
          const g = await cloudStore.loadGuest().catch((e) => (isGuest ? Promise.reject(e) : null));
          d = g ? g.data : await cloudStore.load(true);
          home = g?.home;
        } else d = await cloudStore.load(false);
        if (cancelled) return;
        setData(d);
        const own = cloud?.profile.person_id;
        const firstId = Object.keys(d.people)[0] ?? '';
        // a guest has no card of their own: the tree is drawn around the family's home person
        const viewer = isGuest ? '' : [own, viewerId].find((id) => id && d.people[id]) ?? firstId;
        setViewerId(viewer);
        const center = isGuest ? (home && d.people[home] ? home : firstId) : viewer;
        setHomeId(center);
        // deep links: #p=<person shown> &f=<person in the middle> &view=map|admin &tab=<admin tab>
        const params = hashParams();
        const linked = params.get('p');
        const linkedFocus = params.get('f');
        const has = (id: string | null): id is string => Boolean(id && d.people[id]);
        if (has(linked)) setSelectedId(linked);
        setFocusId(has(linkedFocus) ? linkedFocus : has(linked) ? linked : center);
        const linkedView = params.get('view');
        if (linkedView === 'map' && !namesOnly) setView('map');
        if (isAdmin && (linkedView === 'admin' || linkedView === 'review' || linkedView === 'research-tree')) {
          const tab = oneOf<AdminTab>('suggestions', 'research', 'researchTree', 'users', 'import')(params.get('tab'));
          setView('admin');
          setAdminTab(linkedView === 'review' ? 'research' : linkedView === 'research-tree' ? 'researchTree' : tab ?? 'suggestions');
        }
        setUrlReady(true);
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

  useEffect(() => { if (!isGuest) prefs.set('viewer', viewerId || null); }, [viewerId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!cloud) prefs.set('admin', String(devAdmin)); }, [devAdmin, cloud]);
  useEffect(() => {
    if (!cloud) try { localStorage.setItem(DECISIONS_KEY, JSON.stringify(decisions)); } catch { /* full */ }
  }, [decisions, cloud]);

  // keep the address in step with the screen, so it can be shared as a link
  useEffect(() => {
    if (!urlReady) return;
    const inAdmin = view === 'admin';
    const clear = (keys: string[]) => Object.fromEntries(keys.map((k) => [k, null]));
    setHash({
      view: view === 'tree' ? null : view,
      tab: inAdmin ? adminTab : null,
      p: selectedId ?? null,
      pt: selectedId ? undefined : null, // the person panel's own tab, written by the panel
      f: !overview && focusId && focusId !== (selectedId ?? viewerId) ? focusId : null,
      side: side === 'all' ? null : side,
      up: up === 3 ? null : showGens(up, ALL_GENS),
      down: down === 2 ? null : showGens(down, ALL_GENS),
      ...(inAdmin && adminTab === 'research' ? {} : clear(REVIEW_KEYS)),
      ...(inAdmin && adminTab === 'researchTree' ? {} : clear(RTREE_KEYS)),
      ...(view === 'map' ? {} : clear(MAP_KEYS)),
    });
  }, [urlReady, view, adminTab, selectedId, focusId, overview, side, up, down, viewerId]);
  useEffect(() => { if (!isGuest) remember('tree', { side, up, down }); }, [side, up, down]);

  // Back / Forward in the browser: show what the address says
  useEffect(() => onHistoryMove(() => {
    if (!data) return;
    const params = hashParams();
    const has = (id: string | null): id is string => Boolean(id && data.people[id]);
    const p = params.get('p');
    const f = params.get('f');
    setSelectedId(has(p) ? p : undefined);
    setFocusId(has(f) ? f : has(p) ? p : viewerId || homeId);
    if (has(p) || has(f)) setOverview(false);
    const v = params.get('view');
    const tab = oneOf<AdminTab>('suggestions', 'research', 'researchTree', 'users', 'import')(params.get('tab'));
    setView(v === 'map' && !namesOnly ? 'map' : v === 'admin' && isAdmin ? 'admin' : 'tree');
    if (tab) setAdminTab(tab);
    // the tree filter: what is not in the address is the default
    setSide(oneOf<Side>('all', 'father', 'mother')(params.get('side')) ?? 'all');
    setUp(gens(ALL_GENS)(params.get('up')) ?? 3);
    setDown(gens(ALL_GENS)(params.get('down')) ?? 2);
  }), [data, viewerId, homeId, isAdmin, namesOnly]); // eslint-disable-line react-hooks/exhaustive-deps

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
    // a new step in the browser's history, so Back returns to the previous person (or screen)
    if (urlReady) pushHash({ p: id, f: null, view: null, tab: null, pt: undefined });
    setOverview(false);
    setFocusId(id);
    setSelectedId(id);
    setView('tree');
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

  /**
   * Approve, reject or undo several findings at once (one is just a list of one).
   * Works on a local copy of the tree and the decisions, so each step sees the previous ones:
   * a new person approved earlier in the list can receive the findings that point at them.
   * Returns the ids of people the approvals created.
   */
  const decideMany = (list: Finding[], d: Decision | undefined): string[] => {
    let next = data;
    const rec: Record<string, DecisionRecord> = { ...decisions };
    const changed: Finding[] = [];
    const created: string[] = [];
    const problems: string[] = [];
    const resolve = (pid: string) => {
      if (!pid.startsWith('new:')) return pid;
      const r = rec[pid.slice(4)];
      return r?.d === 'approved' ? r.createdIds?.[0] : undefined;
    };
    const step = (finding: Finding): 'done' | 'later' | 'skip' => {
      const prev = rec[finding.id];
      if (prev?.d === d) return 'skip';
      if (prev?.d === 'approved' && d !== 'approved') {
        const dependents = findings.some((x) => x.personId === `new:${finding.id}` && rec[x.id]?.d === 'approved');
        if (dependents) { problems.push(t('undoDependentsFirst')); return 'skip'; }
      }
      let f = finding;
      if (d === 'approved') {
        if ((finding.field === 'photo' || finding.field === 'document') && !findingFileUrl(finding)) { problems.push(t('fileDeleted')); return 'skip'; }
        const pid = resolve(finding.personId);
        if (!pid) return 'later';
        f = { ...finding, personId: pid };
      }
      let base = next;
      // undo a previous approval first
      if (prev?.d === 'approved') {
        if (prev.personBefore) base = upsertPerson(base, prev.personBefore);
        for (const id of prev.createdIds ?? []) base = deletePerson(base, id);
      }
      if (d === 'approved') {
        try {
          const before = base.people[f.personId];
          const applied = applyFinding(base, f);
          const createdIds = Object.keys(applied.people).filter((id) => !base.people[id]);
          rec[f.id] = { d, personBefore: f.type === 'field' ? before : undefined, createdIds };
          created.push(...createdIds);
          next = applied;
        } catch {
          problems.push(t('applyFailed'));
          return 'skip';
        }
      } else {
        delete rec[f.id];
        if (d === 'rejected') rec[f.id] = { d };
        next = base;
      }
      changed.push(finding);
      return 'done';
    };
    // approvals may depend on each other ("new:x" needs x first): repeat until nothing moves
    let todo = [...list];
    for (let pass = 0; todo.length && pass < 30; pass++) {
      const later = todo.filter((f) => step(f) === 'later');
      if (later.length === todo.length) break;
      todo = later;
    }
    for (const f of todo) problems.push(t('approveFirst', { name: f.personName ?? '?' }));
    if (changed.length) {
      if (next !== data) commit(next, `${t('review')}: ${changed.length === 1 ? changed[0].personName ?? '' : changed.length}`);
      setDecisions(rec);
      if (cloud) {
        (async () => {
          for (const f of changed) await cloudStore.saveDecision(f.id, rec[f.id] ?? null);
        })().catch((e) => alert(`${t('saveFailed')}: ${e?.message ?? e}`));
        if (d === 'rejected') for (const f of changed) dropRejectedFile(f, next, rec);
      }
    }
    if (problems.length) {
      const unique = [...new Set(problems)];
      if (list.length === 1) alert(unique[0]);
      else showToast(t('batchProblems', { n: String(problems.length), reason: unique[0] }));
    }
    return created;
  };
  const decide = (finding: Finding, d: Decision | undefined) => { decideMany([finding], d); };

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
      relations={relations}
      onDecide={decide}
      onDecideMany={decideMany}
      onShowPerson={openPerson}
      embedded
    />
  );

  const researchTree = (
    <ResearchTree
      data={data}
      graph={graph}
      findings={findings}
      decisions={simpleDecisions}
      resolveId={resolvePersonId}
      relations={relations}
      viewerId={viewerId}
      onDecideMany={decideMany}
      onShowPerson={openPerson}
    />
  );

  // ---------- chrome: navigation, account menu, person panel ----------
  const navItems: NavItem[] = [
    { key: 'tree', label: t('tree'), icon: 'tree', active: view === 'tree', onClick: () => setView('tree') },
    { key: 'map', label: t('map'), icon: 'map', active: view === 'map', onClick: () => setView('map') },
    ...(isAdmin ? [{
      key: 'admin', label: cloud ? t('manage') : t('review'), icon: 'manage', active: view === 'admin', badge: adminBadge,
      onClick: () => setView('admin'),
    }] : []),
    ...(viewerId && graph.get(viewerId) ? [{ key: 'me', label: t('me'), icon: 'person', onClick: () => openPerson(viewerId) }] : []),
    ...(canExport ? [{ key: 'export', label: t('exportShort'), icon: 'download', active: exporting, onClick: () => setExporting(true) }] : []),
  ];
  const accountMenu = (
    <AccountMenu
      avatarUrl={cloud?.profile.avatar_url}
      name={cloud?.profile.display_name ?? undefined}
      email={cloud?.profile.email}
      initials={initialsOf(cloud?.profile.display_name)}
      roleLabel={cloud ? t(`role_${role}` as MsgKey) : undefined}
      badge={0}
      onMyCard={viewerId && graph.get(viewerId) ? () => openPerson(viewerId) : undefined}
      onExport={canExport ? () => setExporting(true) : undefined}
      onLang={setLang}
      onSignOut={isGuest ? undefined : cloud?.signOut}
    />
  );
  // admins: everything waiting about the open person (research findings and family members' suggestions)
  const personReview = (() => {
    if (!selected || !isAdmin) return undefined;
    const id = selected.id;
    const mine = findings.filter((f) => resolvePersonId(f.personId) === id || decisions[f.id]?.createdIds?.includes(id));
    const sugs = personSuggestions(suggestions, id);
    return {
      count: mine.filter((f) => !decisions[f.id]).length + sugs.filter((s) => s.status === 'pending').length,
      content: (
        <PersonReview
          graph={graph}
          findings={mine}
          decisions={simpleDecisions}
          resolveId={resolvePersonId}
          onDecide={decide}
          suggestions={sugs}
          profiles={profileMap}
          onDecideSuggestion={decideSuggestion}
          onShowPerson={openPerson}
        />
      ),
    };
  })();
  const personPanel = selected && (
    <PersonPanel
      review={personReview}
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
  );

  return (
    <LangContext.Provider value={{ lang, t }}>
      <div className="app">
        <header className="topbar">
          {!mobile && <div className="brand" onClick={() => setView('tree')}>
            <img className="logo" src={`${import.meta.env.BASE_URL}logo-256.png`} alt="" />
            <h1>{t('appTitle')}</h1>
          </div>}
          <div className="searchbar">
            <Icon name="search" className="searchbar-icon" />
            <SearchBox graph={graph} onPick={openPerson} />
            {mobile && accountMenu}
          </div>
          {!mobile && <div className="top-actions">{accountMenu}</div>}
        </header>

        {isGuest && (
          <div className="banner">
            <span>{t('guestBanner')}</span>
            <button className="btn primary small" onClick={cloud!.signOut}>{t('signIn')}</button>
          </div>
        )}

        {namesOnly && (
          <div className="banner">
            <span>{t('pendingBanner')}</span>
            {cloud && cloud.profile.attempts < 3 && (
              <button className="btn ghost small" onClick={cloud.openRegister}>{t('fixDetails')}</button>
            )}
          </div>
        )}

        <div className="app-body">
          {!namesOnly && !mobile && <NavBar variant="rail" items={navItems} />}
          <div className="workspace">
            <main className="main">
              {view !== 'admin' && hasPeople && (
                <FilterChips
                  side={side} up={up} down={down} showDepth={view === 'tree'} onSide={setSide} onUp={setUp} onDown={setDown}
                  maxUp={graph.get(focusId) ? graph.depthUp(focusId, side) : 1} maxDown={graph.get(focusId) ? graph.depthDown(focusId) : 0}
                  onMe={view === 'tree' && viewerId && graph.get(viewerId) ? () => openPerson(viewerId) : undefined}
                />
              )}
              <div className="canvas">
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
                        researchTree: [researchTree, 0],
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
                    <AdminPage tab={adminTab} onTab={setAdminTab} tabs={{ research: [research, pendingFindings], researchTree: [researchTree, 0] }} />
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
                      overview={overview}
                    />
                    {mobile && personPanel}
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
              </div>
            </main>
            {!mobile && view === 'tree' && personPanel}
          </div>
        </div>
        {!namesOnly && mobile && <NavBar variant="bar" items={navItems} />}

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

        {exporting && (
          <ExportDialog
            graph={graph}
            viewerId={viewerId}
            currentId={selectedId ?? focusId}
            findings={isAdmin ? findings : []}
            decisions={decisions}
            onClose={() => setExporting(false)}
          />
        )}

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
