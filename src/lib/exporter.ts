import type { DecisionRecord, FamilyData, Finding, LifeEvent, Person, PersonDoc, Union } from '../types';
import type { FamilyGraph } from './graph';
import { D_H, D_W, layoutEveryone } from './fullLayout';
import { displayName, factLabel, formatDate, isRtl, lifeSpan, type Lang, type MsgKey } from './i18n';
import { makeZip, type ZipEntry } from './zip';

/**
 * "Export my data": one ZIP with a diagram of the tree, a folder per person (details page, photo,
 * documents), an index page that works offline, family.json and optionally a GEDCOM file.
 * Everything is built in the browser.
 */

export type ExportScope = 'all' | 'mine' | 'from';

export interface ExportOptions {
  scope: ExportScope;
  /** for scope 'from': this person and their descendants */
  fromId?: string;
  diagram: 'full' | 'fan';
  photos: boolean;
  docs: boolean;
  /** approved research findings with their sources (admins have them) */
  research: boolean;
  index: boolean;
  gedcom: boolean;
  /** include details of living people (otherwise: name and family links only) */
  living: boolean;
}

export interface ExportContext {
  graph: FamilyGraph;
  lang: Lang;
  t: (key: MsgKey, vars?: Record<string, string>) => string;
  viewerId: string;
  findings: Finding[];
  decisions: Record<string, DecisionRecord>;
}

// ---------- who is exported ----------

function descendants(graph: FamilyGraph, id: string): Set<string> {
  const out = new Set<string>();
  const stack = [id];
  while (stack.length) {
    const cur = stack.pop()!;
    for (const c of graph.children(cur)) if (!out.has(c.id)) { out.add(c.id); stack.push(c.id); }
  }
  return out;
}

export function scopeIds(graph: FamilyGraph, scope: ExportScope, viewerId: string, fromId?: string): Set<string> {
  if (scope === 'all' || (scope === 'mine' && !graph.get(viewerId)) || (scope === 'from' && !graph.get(fromId))) {
    return new Set(Object.keys(graph.people));
  }
  const core = new Set<string>();
  if (scope === 'mine') {
    core.add(viewerId);
    graph.ancestors(viewerId).forEach((id) => core.add(id));
    descendants(graph, viewerId).forEach((id) => core.add(id));
    graph.siblings(viewerId).forEach((p) => core.add(p.id));
  } else {
    core.add(fromId!);
    descendants(graph, fromId!).forEach((id) => core.add(id));
  }
  const out = new Set(core);
  for (const id of core) graph.partners(id).forEach((p) => out.add(p.id));
  return out;
}

// ---------- small helpers ----------

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** A name that is safe as a file or folder name on Windows, Mac and Linux. */
function safeName(s: string, fallback: string): string {
  const clean = s.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').replace(/\s+/g, ' ').trim().replace(/[. ]+$/, '').slice(0, 80);
  return clean || fallback;
}

const href = (path: string) => path.split('/').map(encodeURIComponent).join('/');

function extFor(nameOrUrl: string, type: string): string {
  const m = nameOrUrl.split('?')[0].match(/\.([a-z0-9]{1,5})$/i);
  if (m && !nameOrUrl.startsWith('data:')) return m[1].toLowerCase();
  const map: Record<string, string> = {
    'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/tiff': 'tif',
    'application/pdf': 'pdf', 'text/plain': 'txt',
  };
  return map[type.split(';')[0].trim()] ?? 'bin';
}

async function grab(url: string): Promise<{ data: Uint8Array; type: string } | null> {
  try {
    const r = await fetch(url, { referrerPolicy: 'no-referrer' });
    if (!r.ok) return null;
    return { data: new Uint8Array(await r.arrayBuffer()), type: r.headers.get('content-type') ?? '' };
  } catch {
    return null;
  }
}

const shorten = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

// ---------- diagrams ----------

const SEX_EDGE = { M: '#5f8bb0', F: '#b5687c', U: '#8a8172' };
const SEX_FILL = { M: '#dde8f2', F: '#f4e0e5', U: '#ebe6dc' };
const FONT = "'Noto Sans Hebrew', 'Segoe UI', Arial, sans-serif";

function fullDiagram(ctx: ExportContext, ids: Set<string>, limited: (p: Person) => boolean, title: string): string {
  const { graph, lang } = ctx;
  const lay = layoutEveryone(graph, ids, ctx.viewerId);
  const W = Math.ceil(lay.width);
  const H = Math.ceil(lay.height + 50);
  const rtl = isRtl(lang);
  const parts: string[] = [];
  for (const l of lay.links) {
    parts.push(`<polyline points="${l.points.map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' ')}" fill="none" stroke="${l.kind === 'partner' ? '#b3862c' : '#a08560'}" stroke-width="${l.kind === 'partner' ? 2 : 1.5}"/>`);
  }
  for (const n of lay.nodes) {
    const p = graph.people[n.id];
    const name = shorten(displayName(p, lang), 24);
    const years = limited(p) ? '' : lifeSpan(p, lang);
    const edgeX = rtl ? D_W - 5 : 0;
    parts.push(
      `<g transform="translate(${(n.x - D_W / 2).toFixed(1)},${(n.y - D_H / 2).toFixed(1)})">`
      + `<rect width="${D_W}" height="${D_H}" rx="10" fill="#fffdf9" stroke="#ddd3c2"/>`
      + `<rect x="${edgeX}" width="5" height="${D_H}" rx="2" fill="${SEX_EDGE[p.sex] ?? SEX_EDGE.U}"/>`
      + `<text x="${D_W / 2}" y="${years ? 25 : 33}" text-anchor="middle" font-size="13" font-weight="600" fill="#2a251f">${esc(name)}</text>`
      + (years ? `<text x="${D_W / 2}" y="43" text-anchor="middle" font-size="11" fill="#6c6254" direction="ltr">${esc(years)}</text>` : '')
      + '</g>',
    );
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 -50 ${W} ${H}" font-family="${FONT}">`
    + `<rect x="0" y="-50" width="${W}" height="${H}" fill="#f6f2ea"/>`
    + `<text x="${W / 2}" y="-12" text-anchor="middle" font-size="22" font-weight="700" fill="#2a251f">${esc(title)}</text>`
    + parts.join('') + '</svg>';
}

/** Ancestors of one person as a half-circle fan: father's side on one half, mother's on the other. */
function fanDiagram(ctx: ExportContext, rootId: string, limited: (p: Person) => boolean, title: string): string {
  const { graph, lang } = ctx;
  const gens = Math.min(7, Math.max(1, graph.depthUp(rootId)));
  const R0 = 80;
  const RING = 110;
  const R = R0 + gens * RING;
  const W = R * 2 + 80;
  const H = R + 120;
  const cx = W / 2;
  const cy = R + 70;
  const pt = (r: number, a: number) => `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
  const parts: string[] = [];
  const root = graph.people[rootId];
  parts.push(`<path d="M${cx - R0} ${cy}A${R0} ${R0} 0 0 1 ${cx + R0} ${cy}Z" fill="#e7efdf" stroke="#ddd3c2"/>`);
  parts.push(`<text x="${cx}" y="${cy - 30}" text-anchor="middle" font-size="14" font-weight="700" fill="#2a251f">${esc(shorten(displayName(root, lang), 18))}</text>`);
  // level k holds 2^k slots; slot i's father is 2i, mother 2i+1
  let level: (Person | undefined)[] = [root];
  for (let k = 1; k <= gens; k++) {
    const next: (Person | undefined)[] = [];
    for (const p of level) next.push(p ? graph.father(p.id) : undefined, p ? graph.mother(p.id) : undefined);
    level = next;
    const n = level.length;
    const r1 = R0 + (k - 1) * RING;
    const r2 = r1 + RING;
    level.forEach((p, i) => {
      if (!p) return;
      // slot 0 (the father's line) starts on the left; in RTL it starts on the right, as in the site's tree
      const s0 = Math.PI + (Math.PI * i) / n;
      const s1 = Math.PI + (Math.PI * (i + 1)) / n;
      const [a0, a1] = isRtl(lang) ? [3 * Math.PI - s1, 3 * Math.PI - s0] : [s0, s1];
      parts.push(`<path d="M${pt(r1, a0)}L${pt(r2, a0)}A${r2} ${r2} 0 0 1 ${pt(r2, a1)}L${pt(r1, a1)}A${r1} ${r1} 0 0 0 ${pt(r1, a0)}Z" fill="${SEX_FILL[p.sex] ?? SEX_FILL.U}" stroke="#fffdf9" stroke-width="1.5"/>`);
      const am = (a0 + a1) / 2;
      const rm = (r1 + r2) / 2;
      const [x, y] = pt(rm, am).split(',').map(Number);
      const deg = (am * 180) / Math.PI;
      const arc = (rm * Math.PI) / n; // room along the ring
      const name = displayName(p, lang);
      const years = limited(p) ? '' : lifeSpan(p, lang);
      if (k <= 3) {
        const size = k === 1 ? 14 : 12;
        const chars = Math.max(6, Math.floor(arc / (size * 0.55)));
        parts.push(`<g transform="translate(${x},${y}) rotate(${(deg + 90).toFixed(1)})"><text text-anchor="middle" font-size="${size}" font-weight="600" fill="#2a251f" y="-2">${esc(shorten(name, chars))}</text>${years ? `<text text-anchor="middle" font-size="10" fill="#6c6254" y="13" direction="ltr">${esc(years)}</text>` : ''}</g>`);
      } else {
        const size = Math.max(7, Math.min(11, arc * 0.7));
        const flip = Math.cos(am) < 0 ? 180 : 0;
        parts.push(`<g transform="translate(${x},${y}) rotate(${(deg + flip).toFixed(1)})"><text text-anchor="middle" font-size="${size.toFixed(1)}" fill="#2a251f" dominant-baseline="middle">${esc(shorten(name, Math.floor(RING / (size * 0.55))))}</text></g>`);
      }
    });
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${FONT}">`
    + `<rect width="${W}" height="${H}" fill="#f6f2ea"/>`
    + `<text x="${cx}" y="36" text-anchor="middle" font-size="22" font-weight="700" fill="#2a251f">${esc(title)}</text>`
    + parts.join('') + '</svg>';
}

// ---------- GEDCOM ----------

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
function gedDate(ev: LifeEvent): string {
  const [y, m, d] = (ev.date ?? '').split('-');
  if (!y) return '';
  const q = ev.qualifier === 'about' ? 'ABT ' : ev.qualifier === 'before' ? 'BEF ' : ev.qualifier === 'after' ? 'AFT ' : '';
  return q + [d ? String(Number(d)) : '', m ? MONTHS[Number(m) - 1] : '', y].filter(Boolean).join(' ');
}

function gedcom(data: FamilyData, limited: (p: Person) => boolean): string {
  const gid = (id: string) => `@${id.replace(/[^A-Za-z0-9]/g, '')}@`;
  const out = ['0 HEAD', '1 SOUR FamilyTreeSite', '1 GEDC', '2 VERS 5.5.1', '2 FORM LINEAGE-LINKED', '1 CHAR UTF-8'];
  const line = (lvl: number, tag: string, value?: string) => {
    const text = (value ?? '').replace(/\r?\n/g, ' ');
    out.push(`${lvl} ${tag}${text ? ` ${text}` : ''}`);
  };
  const event = (tag: string, ev: LifeEvent | undefined) => {
    if (!ev || (!ev.date && !ev.place)) return;
    line(1, tag);
    const d = gedDate(ev);
    if (d) line(2, 'DATE', d);
    if (ev.place) line(2, 'PLAC', ev.place);
  };
  for (const p of Object.values(data.people)) {
    line(0, `${gid(p.id)} INDI`);
    line(1, 'NAME', `${p.firstName} /${p.lastName}/`.trim());
    if (p.firstNameHe || p.lastNameHe) {
      line(1, 'NAME', `${p.firstNameHe ?? ''} /${p.lastNameHe ?? ''}/`.trim());
      line(2, 'TYPE', 'aka');
    }
    if (p.marriedName) {
      line(1, 'NAME', `${p.firstName} /${p.marriedName}/`.trim());
      line(2, 'TYPE', 'married');
    }
    line(1, 'SEX', p.sex);
    if (!limited(p)) {
      event('BIRT', p.birth);
      if (p.deceased) {
        if (p.death?.date || p.death?.place) event('DEAT', p.death);
        else line(1, 'DEAT', 'Y');
      }
      event('BURI', p.burial);
      for (const f of p.facts ?? []) { line(1, 'EVEN', f.value); line(2, 'TYPE', f.label); }
      if (p.bio) line(1, 'NOTE', p.bio);
    }
    for (const u of Object.values(data.unions)) {
      if (u.partners.includes(p.id)) line(1, 'FAMS', gid(u.id));
      if (u.children.includes(p.id)) line(1, 'FAMC', gid(u.id));
    }
  }
  for (const u of Object.values(data.unions)) {
    line(0, `${gid(u.id)} FAM`);
    const ps = u.partners.map((id) => data.people[id]).filter(Boolean);
    const husband = ps.find((p) => p.sex === 'M') ?? ps[0];
    const wife = ps.find((p) => p !== husband);
    if (husband) line(1, 'HUSB', gid(husband.id));
    if (wife) line(1, 'WIFE', gid(wife.id));
    for (const c of u.children) line(1, 'CHIL', gid(c));
    if (!ps.some(limited)) {
      event('MARR', u.marriage);
      if (u.divorced) line(1, 'DIV', 'Y');
    }
  }
  out.push('0 TRLR');
  return out.join('\r\n');
}

// ---------- pages ----------

const PAGE_CSS = `body{margin:0;background:#f6f2ea;color:#2a251f;font:16px/1.55 'Noto Sans Hebrew','Segoe UI',Arial,sans-serif}
main{max-width:860px;margin:0 auto;padding:24px 18px 60px}a{color:#41702f}h1{margin:8px 0 2px;font-size:30px;line-height:1.15}
.sub{color:#6c6254}.card{background:#fffdf9;border:1px solid #ddd3c2;border-radius:16px;padding:14px 18px;margin:14px 0}
.card h2{font-size:17px;margin:0 0 8px}dl{display:grid;grid-template-columns:auto 1fr;gap:4px 16px;margin:0}dt{color:#6c6254}dd{margin:0}
.photo{width:160px;height:200px;object-fit:cover;border-radius:14px;float:inline-end;margin:0 0 10px 16px}
ul{margin:0;padding-inline-start:20px}.docs{display:flex;flex-wrap:wrap;gap:12px}.docs a{display:flex;flex-direction:column;gap:4px;width:150px;text-decoration:none}
.docs img{width:150px;height:110px;object-fit:cover;border-radius:10px;border:1px solid #ddd3c2}.pdf{display:grid;place-items:center;width:150px;height:110px;border-radius:10px;background:#eee6d8;color:#b3412f;font-weight:700}
.note{color:#6c6254;font-size:14px}.src{font-size:13px;color:#6c6254}.bio{white-space:pre-wrap}
.diagram{overflow:auto;max-height:78vh;background:#fffdf9;border:1px solid #ddd3c2;border-radius:16px}.diagram img{display:block;max-width:none}
.diagram.fit img{max-width:100%;height:auto}input{font:inherit;padding:8px 12px;border:1px solid #ddd3c2;border-radius:10px;width:min(100%,320px)}
.people{columns:2 260px;padding:0;list-style:none}.people li{padding:3px 0;break-inside:avoid}.yrs{color:#6c6254;font-size:14px}`;

function page(lang: Lang, title: string, body: string): string {
  return `<!doctype html><html lang="${lang}" dir="${isRtl(lang) ? 'rtl' : 'ltr'}"><head><meta charset="utf-8">`
    + `<meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>${PAGE_CSS}</style></head>`
    + `<body><main>${body}</main></body></html>`;
}

/** A short text for an approved research finding. */
function findingText(ctx: ExportContext, f: Finding): string {
  const v = f.value as Record<string, unknown> | string | null;
  if (f.type === 'newPerson') return ctx.t('addedFromResearch');
  if (f.field === 'fact' && v && typeof v === 'object') return `${factLabel(ctx.lang, String(v.label))}: ${v.value}`;
  if (f.field === 'document' && v && typeof v === 'object') return `${ctx.t('document')}: ${v.title ?? v.name ?? ''}`;
  if (f.field === 'photo') return ctx.t('photo');
  return `${f.field}: ${typeof v === 'string' ? v : JSON.stringify(v)}`;
}

// ---------- the export ----------

export async function buildExport(
  opts: ExportOptions,
  ctx: ExportContext,
  onProgress: (done: number, total: number) => void,
): Promise<{ blob: Blob; failed: number; fileName: string }> {
  const { graph, lang, t } = ctx;
  const ids = scopeIds(graph, opts.scope, ctx.viewerId, opts.fromId);
  const limited = (p: Person) => !opts.living && !p.deceased;
  const enc = new TextEncoder();
  const entries: ZipEntry[] = [];
  const add = (name: string, text: string) => entries.push({ name, data: enc.encode(text) });
  const today = new Date().toISOString().slice(0, 10);
  const appTitle = t('appTitle');
  const PEOPLE = safeName(t('zipPeople'), 'people');
  const DETAILS = `${safeName(t('zipDetails'), 'details')}.html`;
  const TREE = `${safeName(t('zipTree'), 'family-tree')}.svg`;

  // one folder per person, named "<name> (<years>)"; a second person with the same name gets " (2)"
  const people = [...ids].map((id) => graph.people[id]).sort((a, b) => displayName(a, lang).localeCompare(displayName(b, lang), lang));
  const folder = new Map<string, string>();
  const taken = new Set<string>();
  for (const p of people) {
    const years = limited(p) ? '' : lifeSpan(p, lang);
    const base = safeName(`${displayName(p, lang)}${years ? ` (${years})` : ''}`, p.id);
    let name = base;
    for (let i = 2; taken.has(name.toLowerCase()); i++) name = `${base} (${i})`;
    taken.add(name.toLowerCase());
    folder.set(p.id, name);
  }

  // files to download: [person, doc or photo, path inside the person's folder]
  type Job = { personId: string; url: string; base: string; file?: string };
  const jobs: Job[] = [];
  for (const p of people) {
    if (limited(p)) continue;
    if (opts.photos && p.photo) jobs.push({ personId: p.id, url: p.photo, base: safeName(t('zipPhoto'), 'photo') });
    if (opts.docs) {
      const used = new Set<string>();
      for (const d of p.documents ?? []) {
        if (!d.url) continue;
        const stem = safeName((d.title || d.name || 'document').replace(/\.[a-z0-9]{1,5}$/i, ''), 'document');
        let s = stem;
        for (let i = 2; used.has(s.toLowerCase()); i++) s = `${stem} (${i})`;
        used.add(s.toLowerCase());
        jobs.push({ personId: p.id, url: d.url, base: `${safeName(t('zipDocs'), 'documents')}/${s}` });
      }
    }
  }
  let done = 0;
  let failed = 0;
  const total = jobs.length;
  onProgress(0, total);
  const docFile = new Map<string, string>(); // url -> path inside the person's folder
  const queue = [...jobs];
  const worker = async () => {
    for (let job = queue.shift(); job; job = queue.shift()) {
      const got = await grab(job.url);
      const dir = `${PEOPLE}/${folder.get(job.personId)}`;
      if (got) {
        job.file = `${job.base}.${extFor(job.url, got.type)}`;
        entries.push({ name: `${dir}/${job.file}`, data: got.data });
      } else {
        failed++;
        job.file = `${job.base} (link).txt`;
        add(`${dir}/${job.file}`, job.url);
      }
      docFile.set(`${job.personId}|${job.url}`, job.file);
      onProgress(++done, total);
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));

  // approved research per person (admins)
  const research = new Map<string, Finding[]>();
  if (opts.research) {
    for (const f of ctx.findings) {
      const rec = ctx.decisions[f.id];
      if (rec?.d !== 'approved') continue;
      let pid: string | undefined = f.personId;
      if (f.type === 'newPerson') pid = rec.createdIds?.[0];
      else if (pid.startsWith('new:')) pid = ctx.decisions[pid.slice(4)]?.createdIds?.[0];
      if (pid && ids.has(pid)) research.set(pid, [...(research.get(pid) ?? []), f]);
    }
  }

  // details page per person
  const link = (p: Person) => (ids.has(p.id)
    ? `<a href="../${href(folder.get(p.id)!)}/${href(DETAILS)}">${esc(displayName(p, lang))}</a>`
    : esc(displayName(p, lang)));
  for (const p of people) {
    const dir = `${PEOPLE}/${folder.get(p.id)}`;
    const lim = limited(p);
    const rel = (key: MsgKey, list: Person[]) => (list.length
      ? `<dt>${esc(t(key))}</dt><dd>${list.map((x) => link(x)).join(' · ')}</dd>` : '');
    let body = opts.index ? `<a href="../../index.html">${isRtl(lang) ? '→' : '←'} ${esc(appTitle)}</a>` : '';
    const photo = !lim && p.photo ? docFile.get(`${p.id}|${p.photo}`) : undefined;
    const shownName = displayName(p, lang);
    const otherParts = lang === 'he' ? [p.firstName, p.marriedName || p.lastName] : [p.firstNameHe, p.marriedNameHe || p.lastNameHe];
    const other = otherParts.filter(Boolean).join(' ');
    body += `<h1>${esc(shownName)}</h1><div class="sub">${esc([other !== shownName ? other : '', lim ? '' : lifeSpan(p, lang)].filter(Boolean).join(' · '))}</div>`;
    if (lim) {
      body += `<p class="note">${esc(t('livingNotExported'))}</p>`;
    } else {
      const ev = (key: MsgKey, e: LifeEvent | undefined) => (e && (e.date || e.place)
        ? `<dt>${esc(t(key))}</dt><dd>${esc([formatDate(e, lang), e.place].filter(Boolean).join(' · '))}</dd>` : '');
      const facts = (p.facts ?? []).map((f) => `<dt>${esc(factLabel(lang, f.label))}</dt><dd>${esc(f.value)}</dd>`).join('');
      const info = ev('born', p.birth) + ev('died', p.death) + ev('buried', p.burial) + facts;
      body += `<section class="card">${photo ? `<img class="photo" src="${href(photo)}" alt="">` : ''}${info ? `<dl>${info}</dl>` : `<p class="note">${esc(t('noDetails'))}</p>`}<div style="clear:both"></div></section>`;
      if (p.bio) body += `<section class="card"><h2>${esc(t('bio'))}</h2><p class="bio">${esc(p.bio)}</p></section>`;
    }
    const partners = graph.partners(p.id);
    const fam = rel('parents', graph.parents(p.id)) + rel('partners', partners) + rel('children', graph.children(p.id)) + rel('siblings', graph.siblings(p.id));
    if (fam) body += `<section class="card"><h2>${esc(t('familyTab'))}</h2><dl>${fam}</dl></section>`;
    if (!lim && (p.documents ?? []).length) {
      const items = (p.documents ?? []).map((d: PersonDoc) => {
        const f = docFile.get(`${p.id}|${d.url}`);
        const label = esc(d.title || d.name);
        if (!f) return `<a href="${esc(d.url)}"><span class="pdf">↗</span>${label}</a>`;
        const thumb = /\.(jpe?g|png|webp|gif)$/i.test(f) ? `<img src="${href(f)}" alt="">` : `<span class="pdf">${esc(f.split('.').pop()!.toUpperCase())}</span>`;
        return `<a href="${href(f)}">${thumb}${label}</a>`;
      }).join('');
      body += `<section class="card"><h2>${esc(t('docsShort'))}</h2><div class="docs">${items}</div></section>`;
    }
    const found = research.get(p.id);
    if (!lim && found?.length) {
      body += `<section class="card"><h2>${esc(t('approvedResearch'))}</h2><ul>${found.map((f) => `<li>${esc(findingText(ctx, f))}`
        + `<div class="src">${f.sourceUrl ? `<a href="${esc(f.sourceUrl)}">${esc(f.sourceTitle || f.sourceUrl)}</a>` : esc(f.sourceTitle ?? '')}</div>`
        + `${f.note ? `<div class="note">${esc(f.note)}</div>` : ''}</li>`).join('')}</ul></section>`;
    }
    add(`${dir}/${DETAILS}`, page(lang, displayName(p, lang), body));
  }

  // diagram
  const rootId = opts.scope === 'from' && opts.fromId ? opts.fromId : graph.get(ctx.viewerId) ? ctx.viewerId : people[0]?.id;
  const svg = opts.diagram === 'fan' && rootId ? fanDiagram(ctx, rootId, limited, appTitle) : fullDiagram(ctx, ids, limited, appTitle);
  add(TREE, svg);

  // the exported data, trimmed for living people
  const outData: FamilyData = { people: {}, unions: {} };
  for (const p of people) {
    outData.people[p.id] = limited(p)
      ? { id: p.id, firstName: p.firstName, lastName: p.lastName, firstNameHe: p.firstNameHe, lastNameHe: p.lastNameHe, marriedName: p.marriedName, marriedNameHe: p.marriedNameHe, sex: p.sex, deceased: false }
      : p;
  }
  for (const u of Object.values(graph.unions) as Union[]) {
    const partners = u.partners.filter((id) => ids.has(id));
    const children = u.children.filter((id) => ids.has(id));
    if (partners.length + children.length >= 2) outData.unions[u.id] = { ...u, partners, children };
  }
  add('family.json', JSON.stringify({ exportedAt: new Date().toISOString(), ...outData }, null, 1));
  if (opts.gedcom) add('family.ged', gedcom(outData, limited));

  if (opts.index) {
    const list = people.map((p) => `<li data-n="${esc(`${displayName(p, lang)} ${p.firstName} ${p.lastName} ${p.firstNameHe ?? ''} ${p.lastNameHe ?? ''}`.toLowerCase())}">`
      + `<a href="${href(PEOPLE)}/${href(folder.get(p.id)!)}/${href(DETAILS)}">${esc(displayName(p, lang))}</a> `
      + `<span class="yrs">${esc(limited(p) ? '' : lifeSpan(p, lang))}</span></li>`).join('');
    const body = `<h1>${esc(appTitle)}</h1><div class="sub">${esc(t('exportedOn', { date: today }))} · ${people.length}</div>`
      + `<section class="card"><p><button onclick="document.querySelector('.diagram').classList.toggle('fit')">↔</button> <a href="${href(TREE)}">${esc(TREE)}</a></p>`
      + `<div class="diagram fit"><img src="${href(TREE)}" alt=""></div></section>`
      + `<section class="card"><input type="search" placeholder="${esc(t('searchPlaceholder'))}" oninput="var q=this.value.toLowerCase();document.querySelectorAll('.people li').forEach(function(li){li.hidden=q&&li.dataset.n.indexOf(q)<0})">`
      + `<ul class="people">${list}</ul></section>`;
    add('index.html', page(lang, appTitle, body));
  }

  return { blob: makeZip(entries), failed, fileName: `family-tree-${today}.zip` };
}
