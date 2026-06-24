// Shared geometry helpers built on Turf.
import { center, area } from '@turf/turf';
import { DEFAULT_STOREY_HEIGHT, DEFAULT_BUILDING_HEIGHT } from '../constants';

// Resolve a building height in metres using the ADR-003 fallback chain:
// building:height -> building:levels * 3m -> 6m default.
export function heightOf(tags = {}) {
  const h = parseFloat(tags['building:height'] ?? tags.height);
  if (Number.isFinite(h) && h > 0) return h;
  const levels = parseFloat(tags['building:levels'] ?? tags.levels);
  if (Number.isFinite(levels) && levels > 0) return levels * DEFAULT_STOREY_HEIGHT;
  return DEFAULT_BUILDING_HEIGHT;
}

export function storeysOf(heightMeters) {
  return Math.max(1, Math.round(heightMeters / DEFAULT_STOREY_HEIGHT));
}

export function centroidOf(feature) {
  return center(feature).geometry.coordinates; // [lng, lat]
}

export function footprintArea(feature) {
  return area(feature); // square metres
}

// Compass bearing 0..360 (0 = north, 90 = east) between two [lng,lat] points.
export function bearing(a, b) {
  const toRad = (d) => (d * Math.PI) / 180;
  const toDeg = (r) => (r * 180) / Math.PI;
  const [lng1, lat1] = a.map(toRad);
  const [lng2, lat2] = b.map(toRad);
  const dLng = lng2 - lng1;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

// Outward-facing normal orientation for each edge of a polygon ring.
// Returns [{ bearing, midpoint, length, cardinal }] for the outer ring.
export function facadeOrientations(feature) {
  const ring = outerRing(feature);
  if (!ring) return [];
  const c = centroidOf(feature);
  const faces = [];
  for (let i = 0; i < ring.length - 1; i++) {
    const p1 = ring[i];
    const p2 = ring[i + 1];
    const mid = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2];
    // Edge direction, then the outward normal (pointing away from centroid).
    const edgeBearing = bearing(p1, p2);
    let normal = (edgeBearing + 90) % 360;
    // Flip if the normal points toward the centroid rather than away.
    const toCentroid = bearing(mid, c);
    if (angularDiff(normal, toCentroid) < 90) normal = (normal + 180) % 360;
    faces.push({
      bearing: normal,
      midpoint: mid,
      cardinal: toCardinal(normal),
      length: segmentMeters(p1, p2),
    });
  }
  return faces;
}

export function outerRing(feature) {
  const g = feature.geometry;
  if (!g) return null;
  if (g.type === 'Polygon') return g.coordinates[0];
  if (g.type === 'MultiPolygon') return g.coordinates[0][0];
  return null;
}

// Smallest absolute difference between two bearings (0..180).
export function angularDiff(a, b) {
  const d = Math.abs(((a - b + 540) % 360) - 180);
  return d;
}

export function toCardinal(bearingDeg) {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(bearingDeg / 45) % 8];
}

// Approx distance in metres between two [lng,lat] points (equirectangular).
export function segmentMeters(a, b) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const x = (toRad(b[0]) - toRad(a[0])) * Math.cos(toRad((a[1] + b[1]) / 2));
  const y = toRad(b[1]) - toRad(a[1]);
  return Math.sqrt(x * x + y * y) * R;
}
