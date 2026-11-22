// Minimal GEDCOM 5.5.1 parser tuned for MyHeritage exports.
// Produces the FamilyData shape defined in src/types.ts.

const MONTHS = { JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06', JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12' };
const QUALIFIERS = { ABT: 'about', EST: 'about', CAL: 'about', BEF: 'before', AFT: 'after' };

/** Turn the flat GEDCOM lines into a tree of { tag, value, children }. */
function toTree(text) {
  const root = { tag: 'ROOT', value: '', children: [] };
  const stack = [root];
  for (const raw of text.replace(/^﻿/, '').split(/\r?\n/)) {
    const line = raw.trimEnd();
    if (!line) continue;
    const m = line.match(/^(\d+)\s+(@[^@]+@\s+)?(\S+)(?:\s(.*))?$/);
    if (!m) continue;
    const level = Number(m[1]);
    const node = { tag: m[3], xref: m[2]?.trim().replace(/@/g, ''), value: m[4] ?? '', children: [] };
    if (node.tag === 'CONC' || node.tag === 'CONT') {
      const parent = stack[level - 1];
      if (parent) parent.value += (node.tag === 'CONT' ? '\n' : '') + node.value;
      continue;
    }
    stack.length = level + 1;
    stack[level].children.push(node);
    stack[level + 1] = node;
  }
  return root;
}

const child = (node, tag) => node.children.find((c) => c.tag === tag);
const children = (node, tag) => node.children.filter((c) => c.tag === tag);
const val = (node, tag) => child(node, tag)?.value?.trim() || undefined;
const ref = (v) => v?.replace(/@/g, '').trim();

export function parseDate(raw) {
  if (!raw) return {};
  let s = raw.trim().toUpperCase();
  let qualifier;
  const bet = s.match(/^(?:BET|FROM)\s+(.+?)\s+(?:AND|TO)\s+/);
  if (bet) { s = bet[1]; qualifier = 'about'; }
  const q = s.match(/^(ABT|EST|CAL|BEF|AFT)\.?\s+(.*)$/);
  if (q) { qualifier = QUALIFIERS[q[1]]; s = q[2]; }
  const parts = s.split(/\s+/);
  let day, month, year;
  for (const p of parts) {
    if (MONTHS[p]) month = MONTHS[p];
    else if (/^\d{3,4}$/.test(p)) year = p.padStart(4, '0');
    else if (/^\d{1,2}$/.test(p)) day = p.padStart(2, '0');
  }
  if (!year) return { qualifier, raw };
  const date = [year, month, month && day].filter(Boolean).join('-');
  return { date, qualifier };
}

function event(node) {
  if (!node) return undefined;
  const { date, qualifier } = parseDate(val(node, 'DATE'));
  const ev = {};
  if (date) ev.date = date;
  if (qualifier) ev.qualifier = qualifier;
  const place = val(node, 'PLAC');
  if (place) ev.place = place;
  return Object.keys(ev).length ? ev : undefined;
}

export function parseGedcom(text) {
  const root = toTree(text);
  const people = {};
  const unions = {};

  for (const indi of children(root, 'INDI')) {
    const nameNode = child(indi, 'NAME');
    const nameValue = nameNode?.value ?? '';
    const firstName = (nameNode && val(nameNode, 'GIVN')) ?? nameValue.replace(/\/.*\//, '').trim();
    const lastName = (nameNode && val(nameNode, 'SURN')) ?? (nameValue.match(/\/(.*)\//)?.[1] ?? '').trim();
    const marriedName = nameNode && val(nameNode, '_MARNM');
    const sexRaw = val(indi, 'SEX');
    const deatNode = child(indi, 'DEAT');

    const person = {
      id: indi.xref,
      firstName: firstName ?? '',
      lastName: lastName ?? '',
      sex: sexRaw === 'M' || sexRaw === 'F' ? sexRaw : 'U',
      deceased: Boolean(deatNode),
    };
    if (marriedName && marriedName !== person.lastName) person.marriedName = marriedName;
    const birth = event(child(indi, 'BIRT'));
    if (birth) person.birth = birth;
    if (deatNode) {
      const death = event(deatNode) ?? {};
      const cause = val(deatNode, 'CAUS');
      if (cause) death.cause = cause;
      if (Object.keys(death).length) person.death = death;
    }
    const burial = event(child(indi, 'BURI'));
    if (burial) person.burial = burial;

    const facts = [];
    // Known labels are stored as codes and translated in the UI (src/lib/i18n.ts)
    for (const [tag, label] of [['RELI', 'religion'], ['NATI', 'nationality'], ['OCCU', 'occupation']]) {
      const v = val(indi, tag);
      if (v) facts.push({ label, value: v });
    }
    for (const ev of children(indi, 'EVEN')) {
      const type = val(ev, 'TYPE');
      if (!type || type === 'MARR' || type.startsWith('MYHERITAGE:')) continue;
      const label = type === 'Language spoken' ? 'languages' : type;
      if (ev.value) facts.push({ label, value: ev.value });
    }
    if (facts.length) person.facts = facts;
    const note = val(indi, 'NOTE');
    if (note && !note.startsWith('@')) person.bio = note;
    const uid = val(indi, '_UID');
    if (uid) person.externalId = uid;
    people[person.id] = person;
  }

  for (const fam of children(root, 'FAM')) {
    const partners = [ref(val(fam, 'HUSB')), ref(val(fam, 'WIFE'))].filter((id) => id && people[id]);
    const kids = children(fam, 'CHIL').map((c) => ref(c.value)).filter((id) => people[id]);
    const isPartners = children(fam, 'EVEN').some((e) => val(e, 'TYPE') === 'MYHERITAGE:REL_PARTNERS');
    const union = { id: fam.xref, partners, children: kids, kind: isPartners ? 'partners' : 'married' };
    const marriage = event(child(fam, 'MARR'));
    if (marriage) union.marriage = marriage;
    if (child(fam, 'DIV')) union.divorced = true;
    const uid = val(fam, '_UID');
    if (uid) union.externalId = uid;
    unions[union.id] = union;
  }

  return { people, unions };
}
