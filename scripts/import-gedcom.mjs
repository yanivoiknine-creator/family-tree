// Usage: npm run import:gedcom [path/to/file.ged]
// Converts a GEDCOM export into src/data/family.local.json (kept out of git).
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseGedcom } from './gedcom.mjs';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let file = process.argv[2];
if (!file) {
  const found = readdirSync(projectRoot).filter((f) => f.toLowerCase().endsWith('.ged'));
  if (found.length !== 1) {
    console.error(found.length ? `נמצאו כמה קבצי GEDCOM, ציין איזה: ${found.join(', ')}` : 'לא נמצא קובץ .ged בתיקיית הפרויקט');
    process.exit(1);
  }
  file = resolve(projectRoot, found[0]);
}

const data = parseGedcom(readFileSync(file, 'utf8'));
const out = resolve(projectRoot, 'src/data/family.local.json');
writeFileSync(out, JSON.stringify(data, null, 2), 'utf8');

const people = Object.values(data.people);
console.log(`יובאו ${people.length} אנשים ו-${Object.keys(data.unions).length} משפחות`);
console.log(`  נפטרו: ${people.filter((p) => p.deceased).length}, עם תאריך לידה: ${people.filter((p) => p.birth?.date).length}`);
console.log(`נשמר אל: ${out}`);
