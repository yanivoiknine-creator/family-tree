// Copies ONLY the files that are safe to publish into upload.local/, ready to drag into
// GitHub's "Add file → Upload files" page. Private data (*.local.json, *.ged, .env.local,
// notes, node_modules, dist) is never copied. Run:  npm run prepare-upload
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const out = path.join(root, 'upload.local');
const INCLUDE = [
  'index.html', 'package.json', 'package-lock.json', 'tsconfig.json', 'vite.config.ts',
  'README.md', 'SETUP.md', '.gitignore', '.env.example',
  '.github', 'public', 'scripts', 'src', 'supabase',
];
const PRIVATE = [/\.local\./, /\.ged$/i, /^\.env(?!\.example$)/, /^node_modules$/, /^dist$/, /^notes\.local$/];

fs.rmSync(out, { recursive: true, force: true });
let count = 0;
const copy = (rel) => {
  const src = path.join(root, rel);
  if (!fs.existsSync(src)) return;
  if (PRIVATE.some((re) => re.test(path.basename(rel)))) return;
  if (fs.statSync(src).isDirectory()) {
    for (const name of fs.readdirSync(src)) copy(path.join(rel, name));
  } else {
    fs.mkdirSync(path.dirname(path.join(out, rel)), { recursive: true });
    fs.copyFileSync(src, path.join(out, rel));
    count++;
  }
};
for (const rel of INCLUDE) copy(rel);
for (const f of fs.readdirSync(root).filter((f) => /^tsconfig\..*\.json$/.test(f))) copy(f);
console.log(`✓ ${count} files copied to upload.local/ (no private data). Drag its CONTENTS into GitHub.`);
