// 2D geometric shadow projection (ADR-005).
import { union, polygon, convex, featureCollection } from '@turf/turf';
import { outerRing } from './geometry';
import { MIN_SUN_ALTITUDE_DEG } from '../constants';

const METERS_PER_DEG_LAT = 111320;

// Project a [lng,lat] point by `distMeters` along compass `bearingDeg`.
function project(lngLat, distMeters, bearingDeg) {
  const rad = (bearingDeg * Math.PI) / 180;
  const dNorth = Math.cos(rad) * distMeters;
  const dEast = Math.sin(rad) * distMeters;
  const lat = lngLat[1] + dNorth / METERS_PER_DEG_LAT;
  const metersPerDegLng = METERS_PER_DEG_LAT * Math.cos((lngLat[1] * Math.PI) / 180);
  const lng = lngLat[0] + dEast / metersPerDegLng;
  return [lng, lat];
}

// Build one shadow polygon for a building footprint.
// sun: { azimuth, altitude } in degrees.
export function shadowForBuilding(feature, sun) {
  if (sun.altitude <= MIN_SUN_ALTITUDE_DEG) return null; // no/clamped shadow
  const ring = outerRing(feature);
  if (!ring) return null;

  const height = feature.properties?.height ?? 6;
  // Shadow length: L = height / tan(altitude).
  const L = height / Math.tan((sun.altitude * Math.PI) / 180);
  if (!Number.isFinite(L) || L <= 0) return null;

  // Project away from the sun (azimuth + 180).
  const shadowBearing = (sun.azimuth + 180) % 360;

  // Convex hull of footprint vertices + their projected copies = shadow envelope.
  const pts = [];
  for (const v of ring) {
    pts.push(point(v));
    pts.push(point(project(v, L, shadowBearing)));
  }
  const hull = convex(featureCollection(pts));
  if (!hull) return null;

  // Union the hull with the footprint so the building base is included.
  try {
    const foot = polygon([ring]);
    const merged = union(featureCollection([hull, foot]));
    return merged || hull;
  } catch {
    return hull;
  }
}

function point(coords) {
  return { type: 'Feature', geometry: { type: 'Point', coordinates: coords }, properties: {} };
}

// Build a FeatureCollection of shadow polygons for all buildings.
export function buildShadowPolygons(buildings, sun) {
  if (!buildings?.features?.length || sun.altitude <= MIN_SUN_ALTITUDE_DEG) {
    return { type: 'FeatureCollection', features: [] };
  }
  const features = [];
  for (const b of buildings.features) {
    const s = shadowForBuilding(b, sun);
    if (s) {
      s.properties = { ...(s.properties || {}), buildingId: b.properties?.id };
      features.push(s);
    }
  }
  return { type: 'FeatureCollection', features };
}
