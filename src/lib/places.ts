/**
 * Turning free-text place names ("andrinople", "Essaouira Maroc", "France Paris") into coordinates.
 * Uses OpenStreetMap's Nominatim service. Only the place text is sent — never names of people.
 * Results are cached so each place is looked up once.
 */

export interface GeoPlace {
  lat: number;
  lon: number;
  /** short display name returned by the geocoder */
  label: string;
}

/** Historical / French / misspelled names → names the geocoder knows. Whole-word, case-insensitive. */
const ALIASES: [RegExp, string][] = [
  [/\bandrinople\b/gi, 'Edirne'],
  [/\badrianople\b/gi, 'Edirne'],
  [/\bmogador\b/gi, 'Essaouira'],
  [/\bmaroc\b/gi, 'Morocco'],
  [/\bturquie\b/gi, 'Turkey'],
  [/\bbulgarie\b/gi, 'Bulgaria'],
  [/\balg[ée]rie\b/gi, 'Algeria'],
  [/\btunisie\b/gi, 'Tunisia'],
  [/\bkiboutz\b/gi, 'Kibbutz'],
  [/\bherzlia\b/gi, 'Herzliya'],
  [/\bconstantinople\b/gi, 'Istanbul'],
  [/\bsmyrne\b/gi, 'Izmir'],
  [/\bsalonique\b/gi, 'Thessaloniki'],
];

export function normalizePlace(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Search texts to try, most specific first. */
export function candidates(raw: string): string[] {
  let s = raw.trim().replace(/\s+/g, ' ');
  for (const [re, to] of ALIASES) s = s.replace(re, to);
  // "Essaouira (Mogador)" → drop the bracketed alternative
  s = s.replace(/\s*\([^)]*\)/g, '').trim();
  const out = [s];
  const split = (x: string) => x.split(',').map((p) => p.trim()).filter(Boolean);
  // "City, Old-Region, Country": regions get renamed, so try just "City, Country" and "City"
  const cityCountry = (ps: string[]) => (ps.length >= 3 ? [`${ps[0]}, ${ps[ps.length - 1]}`] : []).concat(ps.length >= 2 ? [ps[0]] : []);
  out.push(...cityCountry(split(s)));
  // drop Hebrew duplicates such as "Holon Cemetery בית עלמין חולון, Holon"
  const latinOnly = s.replace(/[֐-׿]+/g, ' ').replace(/\s+/g, ' ').replace(/\s+,/g, ',').replace(/^,|,$/g, '').trim();
  const parts = split(latinOnly);
  if (latinOnly && latinOnly !== s) out.push(latinOnly, ...cityCountry(parts));
  // progressively broader: drop the first comma part ("Père Lachaise Cemetery, Paris" → "Paris")
  for (let i = 1; i < parts.length; i++) out.push(parts.slice(i).join(', '));
  // "France Paris" style (country first, no comma): try the reversed order, then each word alone
  if (parts.length === 1 && parts[0].split(' ').length === 2) {
    const [a, b] = parts[0].split(' ');
    out.push(`${b}, ${a}`);
  }
  if (parts.length === 1 && parts[0].includes(' ')) {
    out.push(...parts[0].split(' ').filter((w) => w.length > 2).sort((a, b) => b.length - a.length));
  }
  return [...new Set(out)];
}

interface Hit {
  lat: string;
  lon: string;
  name?: string;
  display_name: string;
  category: string;
  type: string;
}

const CEMETERY_RE = /cemetery|cimeti[eè]re|בית עלמין|בית קברות/i;

/** Places people are born/buried in are towns, regions, countries — or cemeteries. Not roads, shops or schools. */
function acceptable(h: Hit, query: string): boolean {
  if (h.category === 'place') return true;
  if (h.category === 'boundary') return h.type === 'administrative';
  if (CEMETERY_RE.test(query)) return h.type === 'cemetery' || h.type === 'grave_yard';
  return false;
}

export async function geocodeOne(raw: string, lang = 'he', fetchImpl: typeof fetch = fetch): Promise<GeoPlace | null> {
  for (const q of candidates(raw)) {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&accept-language=${lang},en&q=${encodeURIComponent(q)}`;
    const res = await fetchImpl(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`geocoder HTTP ${res.status}`);
    const hits = (await res.json()) as Hit[];
    const h = hits.find((x) => acceptable(x, q));
    if (h) return { lat: Number(h.lat), lon: Number(h.lon), label: h.name || h.display_name.split(',')[0] };
    await new Promise((r) => setTimeout(r, 1100)); // usage policy: max 1 request per second
  }
  return null;
}
