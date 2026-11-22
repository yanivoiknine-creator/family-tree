// Safety net after `vite build`: make sure no private family data ended up in dist/.
// Takes distinctive strings from the private *.local.json files (if they exist on this
// computer) and fails the build if any of them appears in the built site.
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const dataDir = path.join(root, 'src', 'data');
const dist = path.join(root, 'dist');

const needles = new Set();
const add = (s) => {
  if (typeof s === 'string' && s.trim().length >= 6) needles.add(s.trim());
};

if (fs.existsSync(dataDir)) {
  for (const file of fs.readdirSync(dataDir).filter((f) => f.endsWith('.local.json'))) {
    let json;
    try {
      json = JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf8'));
    } catch {
      continue;
    }
    for (const p of Object.values(json?.people ?? {})) {
      add([p.firstName, p.lastName].filter(Boolean).join(' '));
      add(p.externalId);
    }
    if (Array.isArray(json)) for (const f of json) add(f.id && f.personName && `"${f.id}"`), add(f.sourceUrl);
  }
}

const files = [];
const walk = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(js|css|html|json|txt|map)$/.test(e.name)) files.push(p);
  }
};
if (fs.existsSync(dist)) walk(dist);

const leaks = [];
for (const f of files) {
  const text = fs.readFileSync(f, 'utf8');
  for (const n of needles) if (text.includes(n)) leaks.push(`${path.relative(root, f)}: ${n}`);
}

if (leaks.length) {
  console.error(`\n✖ Private family data found in dist/ (${leaks.length}):`);
  for (const l of leaks.slice(0, 20)) console.error('  ' + l);
  console.error('Do NOT publish this build.\n');
  process.exit(1);
}
console.log(`✓ dist/ checked: ${files.length} files, ${needles.size} private strings, no family data.`);
