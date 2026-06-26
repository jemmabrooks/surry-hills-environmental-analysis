// Fetch building footprints + heights from OpenStreetMap via Overpass (ADR-003).
// Static bundled snapshot is used immediately; a background refresh updates
// localStorage so subsequent loads get fresher data without blocking startup.
import osmtogeojson from 'osmtogeojson';
import { booleanIntersects } from '@turf/turf';
import { heightOf } from '../lib/geometry';
import { SURRY_HILLS } from '../constants';
import { SURRY_HILLS_BOUNDARY } from './boundary';
import STATIC_BUILDINGS from './buildings-static.json';

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

const CACHE_KEY = 'surry-hills-buildings-v1';

function buildQuery() {
  const { lat, lng, radius } = SURRY_HILLS.overpass;
  return `[out:json][timeout:30];
(
  way["building"](around:${radius},${lat},${lng});
  relation["building"](around:${radius},${lat},${lng});
);
out body geom;`;
}

// Returns a GeoJSON FeatureCollection of building polygons, each with
// properties: { id, height, name, address }.
// Strategy: return cached or bundled data immediately (never blocks the UI),
// then silently refresh from Overpass in the background.
export async function fetchBuildings({ useCache = true } = {}) {
  // 1. Return localStorage cache instantly if available
  if (useCache) {
    const cached = readCache();
    if (cached) {
      refreshInBackground();
      return cached;
    }
  }

  // 2. No cache — return the bundled static snapshot immediately so the app
  //    works on first load / fresh installs without waiting for the API.
  writeCache(STATIC_BUILDINGS);
  refreshInBackground();
  return STATIC_BUILDINGS;
}

// Silently fetch fresh data from Overpass and update localStorage.
// Never throws — failures are swallowed so they don't affect the UI.
function refreshInBackground() {
  const query = buildQuery();
  (async () => {
    for (const endpoint of ENDPOINTS) {
      try {
        const res = await fetchWithTimeout(endpoint, query, 35000);
        if (!res.ok) continue;
        const text = await res.text();
        if (text.startsWith('<')) continue; // HTML error page
        const json = JSON.parse(text);
        const fc = normalize(json);
        writeCache(fc);
        return;
      } catch {
        // try next endpoint
      }
    }
  })();
}

function normalize(osmJson) {
  const raw = osmtogeojson(osmJson);
  const features = raw.features
    .filter(
      (f) =>
        f.geometry &&
        (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon') &&
        f.properties?.building &&
        booleanIntersects(f, SURRY_HILLS_BOUNDARY),
    )
    .map((f, i) => {
      const tags = f.properties || {};
      const height = heightOf(tags);
      return {
        type: 'Feature',
        id: f.id ?? `b${i}`,
        geometry: f.geometry,
        properties: {
          id: f.id ?? `b${i}`,
          height,
          name: tags.name || null,
          address: formatAddress(tags),
        },
      };
    });
  return { type: 'FeatureCollection', features };
}

function formatAddress(tags) {
  const num = tags['addr:housenumber'];
  const street = tags['addr:street'];
  if (num && street) return `${num} ${street}, Surry Hills`;
  if (street) return `${street}, Surry Hills`;
  return tags.name || 'Surry Hills';
}

function fetchWithTimeout(endpoint, query, ms) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  return fetch(endpoint, {
    method: 'POST',
    body: 'data=' + encodeURIComponent(query),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    signal: controller.signal,
  }).finally(() => clearTimeout(t));
}

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.features?.length) return parsed;
  } catch {
    /* ignore */
  }
  return null;
}

function writeCache(fc) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(fc));
  } catch {
    /* quota — skip caching */
  }
}
