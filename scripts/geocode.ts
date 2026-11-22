// Usage: npm run geocode
// Looks up coordinates for every place in the tree (and research findings) and caches them in
// src/data/places.local.json. Only place names are sent to OpenStreetMap, never names of people.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { geocodeOne, normalizePlace, type GeoPlace } from '../src/lib/places.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p: string) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null);
const family = read(resolve(root, 'src/data/family.local.json')) ?? { people: {}, unions: {} };
const research = read(resolve(root, 'src/data/research.local.json')) ?? [];
const cacheFile = resolve(root, 'src/data/places.local.json');
const cache: Record<string, GeoPlace | null> = read(cacheFile) ?? {};

const names = new Set<string>();
for (const p of Object.values<any>(family.people)) for (const ev of [p.birth, p.death, p.burial]) if (ev?.place) names.add(ev.place);
for (const u of Object.values<any>(family.unions)) if (u.marriage?.place) names.add(u.marriage.place);
for (const f of research) if (typeof f.field === 'string' && f.field.endsWith('.place')) names.add(String(f.value));

const politeFetch: typeof fetch = (url, init) =>
  fetch(url, { ...init, headers: { ...(init?.headers ?? {}), 'User-Agent': 'family-tree-site/0.1 (personal genealogy project)' } });

const todo = [...names].filter((n) => !(normalizePlace(n) in cache));
console.log(`${names.size} places, ${todo.length} to look up`);
for (const name of todo) {
  const hit = await geocodeOne(name, 'he', politeFetch);
  cache[normalizePlace(name)] = hit;
  console.log(hit ? `  ✓ ${name}  →  ${hit.label} (${hit.lat.toFixed(3)}, ${hit.lon.toFixed(3)})` : `  ✗ ${name}  (not found)`);
  writeFileSync(cacheFile, JSON.stringify(cache, null, 2), 'utf8');
  await new Promise((r) => setTimeout(r, 1100));
}
console.log(`saved ${cacheFile}`);
