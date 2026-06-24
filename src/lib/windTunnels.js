// Heuristic wind-tunnel (Venturi) detection (ADR-006).
import { centroidOf, outerRing, segmentMeters, angularDiff, bearing } from './geometry';
import { TUNNEL, SYDNEY } from '../constants';

// windDirection: meteorological degrees (direction wind comes FROM).
// Returns a FeatureCollection of LineString corridors with { intensity } props.
export function detectTunnels(buildings, windDirectionFrom) {
  const feats = buildings?.features ?? [];
  if (!feats.length) return { type: 'FeatureCollection', features: [] };

  // Convert "from" direction to the axis the wind travels along (true bearing).
  const windAxis = (windDirectionFrom + SYDNEY.magneticDeclination) % 360;

  // Precompute centroid + a representative radius for cheap proximity culling.
  const meta = feats.map((f) => {
    const c = centroidOf(f);
    const ring = outerRing(f) || [];
    let r = 0;
    for (const v of ring) r = Math.max(r, segmentMeters(c, v));
    return { f, c, r, height: f.properties?.height ?? 0 };
  });

  const corridors = [];
  for (let i = 0; i < meta.length; i++) {
    const a = meta[i];
    if (a.height < TUNNEL.minBuildingHeight) continue;
    for (let j = i + 1; j < meta.length; j++) {
      const b = meta[j];
      if (b.height < TUNNEL.minBuildingHeight) continue;

      const centerDist = segmentMeters(a.c, b.c);
      if (centerDist > a.r + b.r + TUNNEL.searchRadius) continue; // too far

      const gap = minRingGap(a.f, b.f);
      if (gap == null || gap > TUNNEL.maxGapWidth) continue;

      // Gap corridor runs perpendicular to the line joining the two buildings,
      // i.e. wind blowing through the gap travels along that joining line.
      const corridorBearing = bearing(a.c, b.c);
      const align = Math.min(
        angularDiff(corridorBearing, windAxis),
        angularDiff((corridorBearing + 180) % 360, windAxis),
      );
      if (align > TUNNEL.alignmentTolerance) continue;

      const intensity = scoreIntensity(gap, Math.min(a.height, b.height), align);
      corridors.push({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: [a.c, b.c] },
        properties: { intensity, gap: Math.round(gap), align: Math.round(align) },
      });
    }
  }
  return { type: 'FeatureCollection', features: corridors };
}

// Minimum vertex-to-vertex distance between two polygon outer rings (sampled).
function minRingGap(fa, fb) {
  const ra = outerRing(fa);
  const rb = outerRing(fb);
  if (!ra || !rb) return null;
  let min = Infinity;
  for (const va of ra) {
    for (const vb of rb) {
      const d = segmentMeters(va, vb);
      if (d < min) min = d;
    }
  }
  return Number.isFinite(min) ? min : null;
}

// 0..1 intensity: narrower gap, taller flanks, better alignment => higher.
function scoreIntensity(gap, minHeight, align) {
  const narrow = 1 - gap / TUNNEL.maxGapWidth; // 0..1
  const tall = Math.min(1, (minHeight - TUNNEL.minBuildingHeight) / 20 + 0.3);
  const aligned = 1 - align / TUNNEL.alignmentTolerance; // 0..1
  return Math.max(0, Math.min(1, narrow * 0.5 + tall * 0.25 + aligned * 0.25));
}

export const TUNNEL_DISCLAIMER =
  'Wind tunnel zones are heuristic approximations based on building geometry and ' +
  'prevailing wind direction. For engineering decisions, commission a full CFD analysis.';
