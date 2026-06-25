// Per-facade design recommendations: windows, shading, cross-ventilation.
// Combines glazing and ventilation logic into a single unified object per face.
import {
  outerRing, centroidOf, bearing as calcBearing,
  angularDiff, toCardinal, segmentMeters,
} from './geometry';
import { SYDNEY } from '../constants';

// ── Party wall detection ────────────────────────────────────────────────────

// Convert [lng, lat] → local metres relative to a reference centroid.
function makeToM(cLng, cLat) {
  const mPerLng = Math.cos(cLat * Math.PI / 180) * 111320;
  const mPerLat = 111320;
  return ([lng, lat]) => [(lng - cLng) * mPerLng, (lat - cLat) * mPerLat];
}

// True if segment p1→p2 shares a wall with segment q1→q2 (all in metres).
// maxGap: max perpendicular gap to still count as shared (metres).
// minOverlapFrac: min fractional overlap of p1-p2 length.
function segmentsShareWall(p1, p2, q1, q2, maxGap = 0.5, minOverlapFrac = 0.15) {
  const dx = p2[0]-p1[0], dy = p2[1]-p1[1];
  const len = Math.sqrt(dx*dx + dy*dy);
  if (len < 0.5) return false;
  const ux = dx/len, uy = dy/len;
  const nx = -uy, ny = ux;

  // Segments must be roughly parallel (cross product < sin(20°) ≈ 0.34)
  const qdx = q2[0]-q1[0], qdy = q2[1]-q1[1];
  const qlen = Math.sqrt(qdx*qdx + qdy*qdy);
  if (qlen < 0.5) return false;
  if (Math.abs(ux*(qdy/qlen) - uy*(qdx/qlen)) > 0.34) return false;

  // Perpendicular distance of neighbour midpoint from target edge line
  const mx = (q1[0]+q2[0])/2, my = (q1[1]+q2[1])/2;
  if (Math.abs((mx-p1[0])*nx + (my-p1[1])*ny) > maxGap) return false;

  // Overlap along target edge direction
  const tq1 = (q1[0]-p1[0])*ux + (q1[1]-p1[1])*uy;
  const tq2 = (q2[0]-p1[0])*ux + (q2[1]-p1[1])*uy;
  const overlapLen = Math.min(Math.max(tq1,tq2), len) - Math.max(Math.min(tq1,tq2), 0);
  return overlapLen >= len * minOverlapFrac;
}

// Returns a Set of cardinal strings where the face is a party wall.
function detectPartyWalls(building, allBuildings) {
  if (!allBuildings?.features) return new Set();
  const ring = outerRing(building);
  if (!ring) return new Set();

  const [cLng, cLat] = centroidOf(building);
  const toM = makeToM(cLng, cLat);

  // Pre-convert target ring to metres
  const targetSegs = [];
  for (let i = 0; i < ring.length - 1; i++) {
    targetSegs.push([toM(ring[i]), toM(ring[i+1])]);
  }

  // For each candidate neighbour building (within ~80 m)
  const partyEdgeIndices = new Set();
  for (const nb of allBuildings.features) {
    if (nb.properties?.id === building.properties?.id) continue;
    const nbRing = outerRing(nb);
    if (!nbRing) continue;

    // Quick bounding-box pre-filter: skip if centroid > 80 m away
    const nbC = centroidOf(nb);
    if (!nbC) continue;
    const distM = Math.sqrt(
      ((nbC[0]-cLng)*Math.cos(cLat*Math.PI/180)*111320)**2 +
      ((nbC[1]-cLat)*111320)**2
    );
    if (distM > 80) continue;

    const nbSegs = [];
    for (let j = 0; j < nbRing.length - 1; j++) {
      nbSegs.push([toM(nbRing[j]), toM(nbRing[j+1])]);
    }

    for (let i = 0; i < targetSegs.length; i++) {
      const [p1, p2] = targetSegs[i];
      for (const [q1, q2] of nbSegs) {
        if (segmentsShareWall(p1, p2, q1, q2)) {
          partyEdgeIndices.add(i);
          break;
        }
      }
    }
  }

  // Map edge indices back to cardinal directions used by deriveEdges
  const ring2 = outerRing(building);
  const c = centroidOf(building);
  const partyCardinals = new Set();
  for (const idx of partyEdgeIndices) {
    const p1 = ring2[idx], p2 = ring2[idx+1];
    const mid = [(p1[0]+p2[0])/2, (p1[1]+p2[1])/2];
    const edgeBearing = calcBearing(p1, p2);
    let normal = (edgeBearing + 90) % 360;
    if (angularDiff(normal, calcBearing(mid, c)) < 90) normal = (normal + 180) % 360;
    partyCardinals.add(toCardinal(normal));
  }
  return partyCardinals;
}

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

const PARTY_WALL = {
  windows: 'No openings — shared/party wall',
  shading: 'N/A',
  color: '#9aa0a6',
  vent: { label: 'No openings', ratio: '0% WWR', color: '#9aa0a6' },
  isPartyWall: true,
};

// windDirectionFrom: meteorological degrees (direction wind blows FROM).
// allBuildings: full FeatureCollection used to detect shared/party walls.
// Returns array of face objects for map overlay and PDF diagram.
export function buildFacadeGuide(building, windDirectionFrom = 0, allBuildings = null) {
  const edges = deriveEdges(building);
  const windFrom = (windDirectionFrom + SYDNEY.magneticDeclination) % 360;
  const windTo = (windFrom + 180) % 360;
  const partyWalls = detectPartyWalls(building, allBuildings);

  return edges.map(e => {
    if (partyWalls.has(e.cardinal)) {
      return {
        cardinal: e.cardinal,
        bearing: e.bearing,
        midpoint: e.midpoint,
        length: e.length,
        p1: e.p1,
        p2: e.p2,
        ...PARTY_WALL,
      };
    }

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
      isPartyWall: false,
    };
  });
}
