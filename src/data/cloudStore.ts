import type { DecisionRecord, FamilyData, Finding, Person, Union } from '../types';
import { supabase, type Profile, type Role } from '../lib/supabase';
import { diffData, type Change } from '../lib/diff';

export interface Suggestion {
  id: string;
  created_by: string;
  created_at: string;
  summary: string | null;
  change: Change;
  status: 'pending' | 'approved' | 'rejected';
  decided_at: string | null;
}

export interface RegisterForm {
  firstNameHe: string;
  lastNameHe: string;
  firstName: string;
  lastName: string;
  father: string;
  mother: string;
}

export interface RegisterResult {
  status: 'linked' | 'pending';
  person_id?: string;
  attempts_left?: number;
}

const sb = () => {
  if (!supabase) throw new Error('Supabase is not configured');
  return supabase;
};

function must<T>(r: { data: T; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  return r.data;
}

const chunks = <T,>(list: T[], size: number) =>
  Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, i * size + size));

/** Read a whole table, page by page (Supabase returns at most 1000 rows per request). */
async function selectAll<T>(table: string, columns = '*'): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const rows = must(await sb().from(table).select(columns).range(from, from + 999)) as T[];
    out.push(...rows);
    if (rows.length < 1000) return out;
  }
}

async function dataUrlToBlob(url: string): Promise<Blob> {
  return (await fetch(url)).blob();
}

export class CloudStore {
  /** The data as last loaded or saved, to work out what changed on the next save. */
  private snapshot: FamilyData = { people: {}, unions: {} };

  async userId(): Promise<string | undefined> {
    return (await sb().auth.getUser()).data.user?.id;
  }

  // ---------- profile & registration ----------

  async myProfile(): Promise<Profile | null> {
    const uid = await this.userId();
    if (!uid) return null;
    return must(await sb().from('profiles').select('*').eq('user_id', uid).maybeSingle()) as Profile | null;
  }

  async register(f: RegisterForm): Promise<RegisterResult> {
    return must(
      await sb().rpc('register_profile', {
        first_he: f.firstNameHe, last_he: f.lastNameHe, first_en: f.firstName, last_en: f.lastName,
        father: f.father, mother: f.mother,
      }),
    ) as RegisterResult;
  }

  // ---------- the tree ----------

  /** Members and admins get everything; a pending account gets names and links only. */
  async load(namesOnly: boolean): Promise<FamilyData> {
    let data: FamilyData;
    if (namesOnly) {
      data = (must(await sb().rpc('tree_names')) as FamilyData | null) ?? { people: {}, unions: {} };
    } else {
      const [people, unions] = await Promise.all([
        selectAll<{ id: string; data: Person }>('people', 'id, data'),
        selectAll<{ id: string; data: Union }>('unions', 'id, data'),
      ]);
      data = {
        people: Object.fromEntries(people.map((r) => [r.id, { ...r.data, id: r.id }])),
        unions: Object.fromEntries(unions.map((r) => [r.id, { ...r.data, id: r.id }])),
      };
    }
    this.snapshot = data;
    return data;
  }

  /** Admins only: write what changed since the last load/save. */
  async save(next: FamilyData): Promise<void> {
    const change = diffData(this.snapshot, next);
    const uid = await this.userId();
    const now = new Date().toISOString();
    for (const table of ['people', 'unions'] as const) {
      const entries = Object.entries(change[table]);
      const upserts = entries.filter(([, v]) => v.after).map(([id, v]) => ({ id, data: v.after, updated_at: now, updated_by: uid }));
      const deletes = entries.filter(([, v]) => !v.after).map(([id]) => id);
      // insert people before the unions that point at them; delete unions before people
      for (const part of chunks(upserts, 200)) must(await sb().from(table).upsert(part));
      for (const part of chunks(deletes, 200)) must(await sb().from(table).delete().in('id', part));
    }
    this.snapshot = next;
  }

  async uploadPhoto(personId: string, blob: Blob): Promise<string> {
    const path = `${personId}/${crypto.randomUUID()}.jpg`;
    must(await sb().storage.from('photos').upload(path, blob, { contentType: blob.type || 'image/jpeg', upsert: false }));
    return sb().storage.from('photos').getPublicUrl(path).data.publicUrl;
  }

  // ---------- suggestions ----------

  async suggest(change: Change, summary: string): Promise<void> {
    must(await sb().from('suggestions').insert({ change, summary }));
  }

  async listSuggestions(): Promise<Suggestion[]> {
    return must(await sb().from('suggestions').select('*').order('created_at', { ascending: false }).limit(500)) as Suggestion[];
  }

  async setSuggestionStatus(id: string, status: Suggestion['status']): Promise<void> {
    const uid = await this.userId();
    must(await sb().from('suggestions').update({ status, decided_by: uid, decided_at: new Date().toISOString() }).eq('id', id));
  }

  // ---------- research ----------

  async loadFindings(): Promise<Finding[]> {
    const rows = await selectAll<{ id: string; data: Finding & { _pos?: number } }>('findings', 'id, data');
    return rows.map((r) => r.data).sort((a, b) => (a._pos ?? 0) - (b._pos ?? 0));
  }

  async loadDecisions(): Promise<Record<string, DecisionRecord>> {
    const rows = await selectAll<{ finding_id: string; record: DecisionRecord }>('finding_decisions', 'finding_id, record');
    return Object.fromEntries(rows.map((r) => [r.finding_id, r.record]));
  }

  async saveDecision(findingId: string, record: DecisionRecord | null): Promise<void> {
    if (record) must(await sb().from('finding_decisions').upsert({ finding_id: findingId, record, decided_at: new Date().toISOString() }));
    else must(await sb().from('finding_decisions').delete().eq('finding_id', findingId));
  }

  // ---------- users ----------

  async listProfiles(): Promise<Profile[]> {
    return must(await sb().from('profiles').select('*').order('created_at', { ascending: false })) as Profile[];
  }

  async setRole(userId: string, role: Role): Promise<void> {
    must(await sb().from('profiles').update({ role }).eq('user_id', userId));
  }

  async link(userId: string, personId: string | null): Promise<void> {
    must(await sb().rpc('admin_link', { target: userId, pid: personId }));
  }

  // ---------- one-time move from the local prototype ----------

  async importAll(
    data: FamilyData,
    findings: Finding[],
    decisions: Record<string, DecisionRecord>,
    onProgress: (msg: string) => void,
  ): Promise<void> {
    const uid = await this.userId();
    const now = new Date().toISOString();
    // photos uploaded in the prototype are stored inline; move them to Storage
    const people: Record<string, Person> = {};
    const inline = Object.values(data.people).filter((p) => p.photo?.startsWith('data:'));
    let done = 0;
    for (const p of Object.values(data.people)) {
      let photo = p.photo;
      if (photo?.startsWith('data:')) {
        onProgress(`📷 ${++done}/${inline.length}`);
        photo = await this.uploadPhoto(p.id, await dataUrlToBlob(photo));
      }
      people[p.id] = { ...p, photo };
    }
    const rows = <T extends { id: string }>(m: Record<string, T>) =>
      Object.values(m).map((v) => ({ id: v.id, data: v, updated_at: now, updated_by: uid }));
    const peopleRows = rows(people);
    for (const [i, part] of chunks(peopleRows, 200).entries()) {
      onProgress(`👤 ${Math.min((i + 1) * 200, peopleRows.length)}/${peopleRows.length}`);
      must(await sb().from('people').upsert(part));
    }
    for (const part of chunks(rows(data.unions), 200)) must(await sb().from('unions').upsert(part));
    onProgress(`🔎 ${findings.length}`);
    const findingRows = findings.map((f, i) => ({ id: f.id, data: { ...f, _pos: i } }));
    for (const part of chunks(findingRows, 200)) must(await sb().from('findings').upsert(part));
    const decisionRows = Object.entries(decisions).map(([finding_id, record]) => ({ finding_id, record, decided_at: now }));
    for (const part of chunks(decisionRows, 200)) must(await sb().from('finding_decisions').upsert(part));
    this.snapshot = { people, unions: data.unions };
  }
}

export const cloudStore = new CloudStore();
