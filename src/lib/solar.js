// Solar panel placement: score roof quadrants by orientation + shadow exposure.
import { bbox, booleanPointInPolygon } from '@turf/turf';
import { outerRing, centroidOf } from './geometry';
import { getSunPosition, sydneyDate } from './sun';
import { shadowForBuilding } from './shadows';

// Quadrants of the roof, named by the compass face they lean toward.
const QUADRANTS = [
  { key: 'N', label: 'North', dx: 0, dy: 1 },
  { key: 'E', label: 'East', dx: 1, dy: 0 },
  { key: 'S', label: 'South', dx: 0, dy: -1 },
  { key: 'W', label: 'West', dx: -1, dy: 0 },
];

// Sample sun positions across the year at solar-relevant hours.
function yearSunSamples() {
  const samples = [];
  for (const month of [0, 3, 5, 8, 11]) {
    for (const hour of [9, 10, 11, 12, 13, 14, 15]) {
      const date = sydneyDate(2026, month, 15, hour);
      const sun = getSunPosition(date);
      if (sun.altitude > 5) samples.push(sun);
    }
  }
  return samples;
}

// Returns { zones: [{key,label,score,rating,center}], best }.
export function scoreRoofZones(building, neighbours) {
  const ring = outerRing(building);
  if (!ring) return { zones: [], best: null };
  const [minX, minY, maxX, maxY] = bbox(building);
  const c = centroidOf(building);
  const samples = yearSunSamples();

  // For shadow checks, only consider the closest nearby buildings (capped).
  const near = (neighbours?.features ?? [])
    .filter((f) => f.properties?.id !== building.properties?.id)
    .map((f) => ({ f, c: centroidOf(f) }))
    .filter((o) => Math.abs(o.c[0] - c[0]) < 0.003 && Math.abs(o.c[1] - c[1]) < 0.003)
    .sort((a, b) => dist2(a.c, c) - dist2(b.c, c))
    .slice(0, 25)
    .map((o) => o.f);

  // Probe points for each quadrant.
  const probes = QUADRANTS.map((q) => ({
    q,
    probe: [c[0] + q.dx * (maxX - minX) * 0.25, c[1] + q.dy * (maxY - minY) * 0.25],
    unshaded: 0,
  }));

  // Compute each neighbour's shadow ONCE per sun sample, then test all probes.
  for (const sun of samples) {
    const shadows = [];
    for (const n of near) {
      const s = shadowForBuilding(n, sun);
      if (s) shadows.push(s);
    }
    for (const p of probes) {
      if (!anyShadowCovers(p.probe, shadows)) p.unshaded++;
    }
  }

  const ORIENT = { N: 1.0, E: 0.6, W: 0.55, S: 0.25 };
  const zones = probes.map(({ q, probe, unshaded }) => {
    const shadowScore = samples.length ? unshaded / samples.length : 1;
    const score = ORIENT[q.key] * 0.6 + shadowScore * 0.4;
    return {
      key: q.key,
      label: q.label,
      score,
      shadowScore,
      rating: score >= 0.7 ? 'best' : score >= 0.45 ? 'ok' : 'poor',
      center: probe,
    };
  });

  const best = [...zones].sort((a, b) => b.score - a.score)[0];
  return { zones, best };
}

function dist2(a, b) {
  return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;
}

function anyShadowCovers(probe, shadows) {
  for (const shadow of shadows) {
    try {
      if (booleanPointInPolygon(probe, shadow)) return true;
    } catch {
      /* ignore malformed */
    }
  }
  return false;
}

export function solarSummary(result) {
  if (!result?.best) return 'No clear recommendation.';
  const b = result.best;
  const pct = Math.round(b.shadowScore * 100);
  return `${b.label}-facing roof zone — unshaded ${pct}% of peak sun hours across the year.`;
}
