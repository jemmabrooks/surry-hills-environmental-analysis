// Fetch building footprints + heights from OpenStreetMap via Overpass (ADR-003).
import osmtogeojson from 'osmtogeojson';
import { booleanIntersects } from '@turf/turf';
import { heightOf } from '../lib/geometry';
import { SURRY_HILLS } from '../constants';
import { SURRY_HILLS_BOUNDARY } from './boundary';

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
export async function fetchBuildings({ useCache = true } = {}) {
  if (useCache) {
    const cached = readCache();
    if (cached) return cached;
  }

  const query = buildQuery();
  let lastError;
  for (const endpoint of ENDPOINTS) {
    try {
      const res = await fetchWithTimeout(endpoint, query, 35000);
      if (!res.ok) throw new Error(`Overpass ${res.status}`);
      const json = await res.json();
      const fc = normalize(json);
      writeCache(fc);
      return fc;
    } catch (err) {
      lastError = err;
    }
  }
  // Fall back to stale cache if the network failed entirely.
  const stale = readCache();
  if (stale) return stale;
  throw lastError ?? new Error('Failed to fetch buildings');
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
