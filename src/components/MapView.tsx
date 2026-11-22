import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Person, Side } from '../types';
import type { FamilyGraph } from '../lib/graph';
import type { RelationFinder } from '../lib/relation';
import { displayName, formatDate, isRtl, relationLabel, type MsgKey } from '../lib/i18n';
import { geocodeOne, type GeoPlace } from '../lib/places';
import { placeCache } from '../data/placeCache';
import { useLang } from '../lib/LangContext';

type Kind = 'birth' | 'death' | 'burial' | 'marriage';
const KINDS: Kind[] = ['birth', 'death', 'burial', 'marriage'];
const KIND_COLOR: Record<Kind, string> = { birth: '#4f8a3a', death: '#8a6a3e', burial: '#7d7466', marriage: '#c49a3a' };
const HERE: Record<Kind, MsgKey> = { birth: 'bornHere', death: 'diedHere', burial: 'buriedHere', marriage: 'marriedHere' };

interface Item {
  person: Person;
  kind: Kind;
  date?: string;
  raw: string;
}

interface Group {
  key: string;
  geo: GeoPlace;
  raws: Set<string>;
  items: Item[];
}

interface Props {
  graph: FamilyGraph;
  relations: RelationFinder | undefined;
  side: Side;
  isAdmin: boolean;
  onOpenPerson: (id: string) => void;
}

/** A gentle arc between two points, so journeys that share a route stay distinguishable. */
function arc(a: L.LatLng, b: L.LatLng, bend = 0.18): L.LatLngExpression[] {
  const mx = (a.lng + b.lng) / 2, my = (a.lat + b.lat) / 2;
  const dx = b.lng - a.lng, dy = b.lat - a.lat;
  const cx = mx - dy * bend, cy = my + dx * bend;
  const pts: L.LatLngExpression[] = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    const lng = (1 - t) ** 2 * a.lng + 2 * (1 - t) * t * cx + t ** 2 * b.lng;
    const lat = (1 - t) ** 2 * a.lat + 2 * (1 - t) * t * cy + t ** 2 * b.lat;
    pts.push([lat, lng]);
  }
  return pts;
}

export function MapView({ graph, relations, side, isAdmin, onOpenPerson }: Props) {
  const { lang, t } = useLang();
  const rtl = isRtl(lang);
  const divRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map>();
  const markersRef = useRef<L.LayerGroup>();
  const routesRef = useRef<L.LayerGroup>();
  const markerByKey = useRef(new Map<string, L.Marker>());
  const fittedFor = useRef('');
  const [kinds, setKinds] = useState<Set<Kind>>(new Set(['birth', 'death']));
  const [routes, setRoutes] = useState(false);
  const [cacheVersion, setCacheVersion] = useState(0);
  const [locating, setLocating] = useState(0);

  /* ---- every place event in the tree (respecting the father/mother side filter) ---- */
  const items = useMemo(() => {
    const out: Item[] = [];
    const inSide = (p: Person) => side === 'all' || relations?.get(p.id)?.side === side;
    for (const p of Object.values(graph.people)) {
      if (!inSide(p)) continue;
      if (p.birth?.place) out.push({ person: p, kind: 'birth', date: p.birth.date, raw: p.birth.place });
      if (p.death?.place) out.push({ person: p, kind: 'death', date: p.death.date, raw: p.death.place });
      if (p.burial?.place) out.push({ person: p, kind: 'burial', date: p.burial.date, raw: p.burial.place });
    }
    for (const u of Object.values(graph.unions)) {
      if (!u.marriage?.place) continue;
      for (const pid of u.partners) {
        const p = graph.people[pid];
        if (p && inSide(p)) out.push({ person: p, kind: 'marriage', date: u.marriage.date, raw: u.marriage.place });
      }
    }
    return out;
  }, [graph, relations, side]);

  /* ---- look up places nobody has located yet (1 per second, as the service asks) ---- */
  useEffect(() => {
    let cancelled = false;
    const missing = [...new Set(items.map((i) => i.raw))].filter((r) => placeCache.get(r) === undefined);
    if (!missing.length) return;
    (async () => {
      for (let i = 0; i < missing.length && !cancelled; i++) {
        setLocating(missing.length - i);
        try {
          placeCache.set(missing[i], await geocodeOne(missing[i], lang));
        } catch {
          break; // offline or rate-limited: try again next time
        }
        setCacheVersion((v) => v + 1);
        await new Promise((r) => setTimeout(r, 1100));
      }
      if (!cancelled) setLocating(0);
    })();
    return () => {
      cancelled = true;
    };
  }, [items]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---- group by location ---- */
  const { groups, unresolved } = useMemo(() => {
    const byKey = new Map<string, Group>();
    const unresolved = new Map<string, number>();
    for (const it of items) {
      if (!kinds.has(it.kind)) continue;
      const geo = placeCache.get(it.raw);
      if (!geo) {
        if (geo === null) unresolved.set(it.raw, (unresolved.get(it.raw) ?? 0) + 1);
        continue;
      }
      const key = `${geo.lat.toFixed(3)},${geo.lon.toFixed(3)}`;
      const g = byKey.get(key) ?? { key, geo, raws: new Set<string>(), items: [] };
      g.raws.add(it.raw);
      g.items.push(it);
      byKey.set(key, g);
    }
    return { groups: [...byKey.values()].sort((a, b) => b.items.length - a.items.length), unresolved };
  }, [items, kinds, cacheVersion]);

  /* ---- create the map once ---- */
  useEffect(() => {
    const map = L.map(divRef.current!, { worldCopyJump: true, zoomSnap: 0.5 }).setView([40, 15], 3);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 18,
    }).addTo(map);
    routesRef.current = L.layerGroup().addTo(map);
    markersRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = undefined;
    };
  }, []);

  const fixPlace = async (raw: string) => {
    const q = prompt(t('fixPrompt', { place: raw }), raw);
    if (!q) return;
    const hit = await geocodeOne(q, lang).catch(() => null);
    if (!hit) return alert(t('fixFailed'));
    placeCache.set(raw, hit);
    setCacheVersion((v) => v + 1);
  };

  /* ---- draw markers ---- */
  useEffect(() => {
    const map = mapRef.current, layer = markersRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    markerByKey.current.clear();
    for (const g of groups) {
      const counts = KINDS.map((k) => g.items.filter((i) => i.kind === k).length);
      const total = counts.reduce((a, b) => a + b, 0);
      let acc = 0;
      const stops = KINDS.map((k, i) => {
        if (!counts[i]) return '';
        const from = (acc / total) * 360;
        acc += counts[i];
        return `${KIND_COLOR[k]} ${from}deg ${(acc / total) * 360}deg`;
      }).filter(Boolean);
      const size = Math.round(26 + Math.min(22, Math.sqrt(total) * 5));
      const icon = L.divIcon({
        className: 'map-pin',
        html: `<div style="width:${size}px;height:${size}px;background:conic-gradient(${stops.join(',')})"><span>${total}</span></div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });
      const marker = L.marker([g.geo.lat, g.geo.lon], { icon, riseOnHover: true });
      marker.bindTooltip(`${g.geo.label} · ${t('peopleCount', { n: String(new Set(g.items.map((i) => i.person.id)).size) })}`, { direction: 'top', offset: [0, -size / 2] });
      marker.bindPopup(() => popupContent(g), { maxWidth: 320, minWidth: 220 });
      marker.addTo(layer);
      markerByKey.current.set(g.key, marker);
    }
    // zoom to show everything, but only when the set of places changes
    const sig = groups.map((g) => g.key).sort().join('|');
    if (groups.length && sig !== fittedFor.current) {
      fittedFor.current = sig;
      map.fitBounds(L.latLngBounds(groups.map((g) => [g.geo.lat, g.geo.lon] as L.LatLngTuple)), { padding: [50, 50], maxZoom: 7 });
    }
  }, [groups, lang]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---- life journeys: birthplace → place of death (or burial) ---- */
  useEffect(() => {
    const layer = routesRef.current;
    if (!layer) return;
    layer.clearLayers();
    if (!routes) return;
    const people = new Map<string, { from?: GeoPlace; to?: GeoPlace; p: Person }>();
    for (const it of items) {
      const geo = placeCache.get(it.raw);
      if (!geo) continue;
      const e = people.get(it.person.id) ?? { p: it.person };
      if (it.kind === 'birth') e.from = geo;
      if (it.kind === 'death' || (it.kind === 'burial' && !e.to)) e.to = geo;
      people.set(it.person.id, e);
    }
    for (const { from, to, p } of people.values()) {
      if (!from || !to || (Math.abs(from.lat - to.lat) < 0.05 && Math.abs(from.lon - to.lon) < 0.05)) continue;
      const line = L.polyline(arc(L.latLng(from.lat, from.lon), L.latLng(to.lat, to.lon)), {
        color: KIND_COLOR.birth, weight: 2, opacity: 0.55, dashArray: '6 6',
      });
      line.bindTooltip(`${displayName(p, lang)}: ${from.label} → ${to.label}`, { sticky: true });
      line.on('click', () => onOpenPerson(p.id));
      line.addTo(layer);
    }
  }, [routes, items, cacheVersion, lang]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Popup body built as DOM so the buttons can open people in the tree. */
  function popupContent(g: Group): HTMLElement {
    const root = document.createElement('div');
    root.className = 'map-popup';
    root.dir = rtl ? 'rtl' : 'ltr';
    const h = document.createElement('h3');
    h.textContent = g.geo.label;
    root.appendChild(h);
    const raws = [...g.raws].filter((r) => r !== g.geo.label);
    if (raws.length) {
      const sub = document.createElement('div');
      sub.className = 'map-popup-raw';
      sub.textContent = raws.join(' · ');
      root.appendChild(sub);
    }
    for (const k of KINDS) {
      const list = g.items.filter((i) => i.kind === k).sort((a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999'));
      if (!list.length) continue;
      const sec = document.createElement('div');
      sec.className = 'map-popup-sec';
      const title = document.createElement('div');
      title.className = 'map-popup-kind';
      title.innerHTML = `<i style="background:${KIND_COLOR[k]}"></i>`;
      title.append(t(HERE[k]));
      sec.appendChild(title);
      for (const it of list) {
        const b = document.createElement('button');
        const name = document.createElement('span');
        name.textContent = displayName(it.person, lang);
        const meta = document.createElement('span');
        meta.className = 'muted';
        meta.textContent = [formatDate({ date: it.date }, lang), relationLabel(relations?.get(it.person.id), lang)].filter(Boolean).join(' · ');
        b.append(name, meta);
        b.onclick = () => onOpenPerson(it.person.id);
        sec.appendChild(b);
      }
      root.appendChild(sec);
    }
    if (isAdmin) {
      for (const raw of g.raws) {
        const fix = document.createElement('a');
        fix.className = 'map-popup-fix';
        fix.textContent = `✎ ${t('fixLocation')}: ${raw}`;
        fix.onclick = () => fixPlace(raw);
        root.appendChild(fix);
      }
    }
    return root;
  }

  const toggleKind = (k: Kind) =>
    setKinds((cur) => {
      const next = new Set(cur);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  const focusGroup = (g: Group) => {
    mapRef.current?.flyTo([g.geo.lat, g.geo.lon], Math.max(mapRef.current.getZoom(), 8), { duration: 0.8 });
    setTimeout(() => markerByKey.current.get(g.key)?.openPopup(), 850);
  };

  return (
    <div className="map-view">
      <div ref={divRef} className="map-canvas" dir="ltr" />
      <div className="map-controls">
        <div className="map-kinds">
          {KINDS.map((k) => (
            <label key={k} className="check">
              <input type="checkbox" checked={kinds.has(k)} onChange={() => toggleKind(k)} />
              <i className="dot" style={{ background: KIND_COLOR[k] }} />
              {t(`kind_${k}` as MsgKey)}
            </label>
          ))}
        </div>
        <label className="check" title={t('lifeRoutesHint')}>
          <input type="checkbox" checked={routes} onChange={(e) => setRoutes(e.target.checked)} />
          <i className="dash" /> {t('lifeRoutes')}
        </label>
        {locating > 0 && <span className="muted">{t('locating', { n: String(locating) })}</span>}
      </div>

      <details className="map-places">
        <summary>{t('placesList')} ({groups.length})</summary>
        <ul>
          {groups.map((g) => (
            <li key={g.key}>
              <button onClick={() => focusGroup(g)}>
                <span>{g.geo.label}</span>
                <span className="count">{new Set(g.items.map((i) => i.person.id)).size}</span>
              </button>
            </li>
          ))}
          {[...unresolved.entries()].map(([raw, n]) => (
            <li key={raw} className="unresolved">
              <span>{raw}</span>
              <span className="muted">{t('notFound')} · {n}</span>
              {isAdmin && <button className="icon-btn" onClick={() => fixPlace(raw)} title={t('fixLocation')}>✎</button>}
            </li>
          ))}
        </ul>
      </details>

      {!groups.length && !locating && <div className="map-empty">{t('mapEmpty')}</div>}
    </div>
  );
}
