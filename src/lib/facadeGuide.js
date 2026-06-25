// Per-facade design recommendations: windows, shading, cross-ventilation.
// Combines glazing and ventilation logic into a single unified object per face.
import {
  outerRing, centroidOf, bearing as calcBearing,
  angularDiff, toCardinal, segmentMeters,
} from './geometry';
import { SYDNEY } from '../constants';

// Recommendation matrix for Sydney (Southern Hemisphere).
const MATRIX = {
  N:  { windows: 'Large openings — 40–50% WWR',       shading: 'Horizontal eaves / louvres (600–900 mm)', color: '#f3c01b' },
  NE: { windows: 'Medium-large — 30–40% WWR',          shading: 'Horizontal + light vertical fins',        color: '#f3c01b' },
  E:  { windows: 'Medium — 25–35% WWR',                shading: 'Shallow horizontal louvres',              color: '#1ea64a' },
  SE: { windows: 'Medium — 20–30% WWR',                shading: 'Minimal shading needed',                  color: '#1ea64a' },
  S:  { windows: 'Small — 15–20% WWR, high VLT',       shading: 'None — maximise daylight transmission',   color: '#1ea64a' },
  SW: { windows: 'Small–medium — 20–25% WWR',          shading: 'Vertical fins',                           color: '#e4572e' },
  W:  { windows: 'Small — 15–20% WWR, high-perf glaz', shading: 'External vertical fins or screens',       color: '#e4572e' },
  NW: { windows: 'Medium — 25–30% WWR',                shading: 'Horizontal eaves + vertical fins',        color: '#f3c01b' },
};

const VENT_ROLE = {
  inlet:   { label: 'Windward inlet',  ratio: '8–12% WWR',  color: '#1ea64a' },
  outlet:  { label: 'Leeward outlet',  ratio: '10–15% WWR', color: '#2d7dd2' },
  neutral: { label: 'Neutral',         ratio: '5–8% WWR',   color: '#9aa0a6' },
};

// Re-derives faces from the ring so we can store p1 and p2 for PDF edge drawing.
function deriveEdges(building) {
  const ring = outerRing(building);
  if (!ring) return [];
  const c = centroidOf(building);
  const slots = {};
  for (let i = 0; i < ring.length - 1; i++) {
    const p1 = ring[i], p2 = ring[i + 1];
    const mid = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2];
    const edgeBearing = calcBearing(p1, p2);
    let normal = (edgeBearing + 90) % 360;
    if (angularDiff(normal, calcBearing(mid, c)) < 90) normal = (normal + 180) % 360;
    const cardinal = toCardinal(normal);
    const length = segmentMeters(p1, p2);
    if (!slots[cardinal] || length > slots[cardinal].length) {
      slots[cardinal] = { cardinal, bearing: normal, midpoint: mid, length, p1, p2 };
    }
  }
  return Object.values(slots);
}

// windDirectionFrom: meteorological degrees (direction wind blows FROM).
// Returns array of face objects for map overlay and PDF diagram.
export function buildFacadeGuide(building, windDirectionFrom = 0) {
  const edges = deriveEdges(building);
  const windFrom = (windDirectionFrom + SYDNEY.magneticDeclination) % 360;
  const windTo = (windFrom + 180) % 360;

  return edges.map(e => {
    const rec = MATRIX[e.cardinal] ?? MATRIX.S;

    const toWind = angularDiff(e.bearing, windFrom);
    const role = toWind <= 45
      ? 'inlet'
      : angularDiff(e.bearing, windTo) <= 45
        ? 'outlet'
        : 'neutral';

    return {
      cardinal: e.cardinal,
      bearing: e.bearing,
      midpoint: e.midpoint,
      length: e.length,
      p1: e.p1,
      p2: e.p2,
      windows: rec.windows,
      shading: rec.shading,
      color: rec.color,
      vent: VENT_ROLE[role],
    };
  });
}
