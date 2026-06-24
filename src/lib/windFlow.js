// Wind flow paths around buildings using 2D potential flow (cylinder approximation).
// Used for pedestrian wind comfort assessment (Lawson criteria).
import { area } from '@turf/turf';
import { centroidOf, outerRing } from './geometry';

const DEG_TO_M_LAT = 111320;
const LAT = -33.8874;
const DEG_TO_M_LNG = DEG_TO_M_LAT * Math.cos((LAT * Math.PI) / 180);

// Pedestrian-level speed factor (10 m → 1.5 m, urban power-law α=0.22)
const PED_FACTOR = (1.5 / 10) ** 0.22; // ≈ 0.70
const MS_TO_MPH = 2.23694;

// Lawson criteria expressed in mph (pedestrian level, monthly mean).
export const LAWSON = [
  { grade: 'A', label: 'Sitting',       maxMph: 5.5,     color: '#1ea64a' },
  { grade: 'B', label: 'Standing',      maxMph: 9.0,     color: '#76b947' },
  { grade: 'C', label: 'Walking',       maxMph: 13.5,    color: '#f3c01b' },
  { grade: 'D', label: 'Uncomfortable', maxMph: 22.0,    color: '#e4572e' },
  { grade: 'E', label: 'Unsafe',        maxMph: Infinity, color: '#c0392b' },
];

export function lawsonCategory(speedMph) {
  return LAWSON.find((l) => speedMph < l.maxMph) ?? LAWSON[LAWSON.length - 1];
}

// ── Coordinate helpers ────────────────────────────────────────────────────────

function toMeters(lng, lat, originLng, originLat) {
  return [(lng - originLng) * DEG_TO_M_LNG, (lat - originLat) * DEG_TO_M_LAT];
}

function fromMeters(x, y, originLng, originLat) {
  return [originLng + x / DEG_TO_M_LNG, originLat + y / DEG_TO_M_LAT];
}

// ── Potential flow velocity field ─────────────────────────────────────────────
// Uniform flow past a circular cylinder of radius a, freestream speed V.
// Wind blows TO direction windTo (compass degrees, 0=N, 90=E).
// Point (x, y) in metres, relative to cylinder centre.
// Returns velocity {vx, vy} in m/s in the same (east=+x, north=+y) frame.

function velocityAt(x, y, windTo, a, V) {
  const toRad = (windTo * Math.PI) / 180;
  // Wind unit vector (east, north)
  const wx = Math.sin(toRad);
  const wy = Math.cos(toRad);
  // Perpendicular unit vector (left of wind)
  const px = -wy;
  const py = wx;

  // Project (x,y) onto wind-aligned axes
  const xi = x * wx + y * wy;   // component along wind (downwind +)
  const eta = x * px + y * py;  // component perpendicular (left +)
  const r2 = xi * xi + eta * eta;
  if (r2 < (a * 0.75) ** 2) return { vx: 0, vy: 0 }; // inside building

  const a2 = a * a;
  const r4 = r2 * r2;

  // Potential flow velocity in the wind-aligned frame
  const u_along = V * (1 - a2 * (xi * xi - eta * eta) / r4);
  const u_perp  = -V * 2 * a2 * xi * eta / r4;

  // Back to geo frame: wind direction + perpendicular direction
  let vx = u_along * wx + u_perp * px;
  let vy = u_along * wy + u_perp * py;

  // Gaussian wake deficit leeward of the building
  if (xi > 0) {
    const wakeLen   = a * 4;
    const wakeWidth = a * (1.2 + xi / (a * 3));
    const deficit   = 0.65 * Math.exp(-xi / wakeLen) * Math.exp(-(eta * eta) / (2 * wakeWidth * wakeWidth));
    vx *= (1 - deficit);
    vy *= (1 - deficit);
  }

  return { vx, vy };
}

// ── Streamline tracing ────────────────────────────────────────────────────────

function traceStreamline(sx, sy, windTo, a, V, DT = a * 0.18, MAX_STEPS = 90, stopDist = a * 6) {
  const coords = [[sx, sy]];
  let x = sx, y = sy;

  const toRad = (windTo * Math.PI) / 180;
  const wx = Math.sin(toRad);
  const wy = Math.cos(toRad);

  for (let i = 0; i < MAX_STEPS; i++) {
    const r2 = x * x + y * y;
    if (r2 < (a * 0.75) ** 2) break;

    // RK4
    const k1 = velocityAt(x, y, windTo, a, V);
    const k2 = velocityAt(x + k1.vx * DT / 2, y + k1.vy * DT / 2, windTo, a, V);
    const k3 = velocityAt(x + k2.vx * DT / 2, y + k2.vy * DT / 2, windTo, a, V);
    const k4 = velocityAt(x + k3.vx * DT, y + k3.vy * DT, windTo, a, V);

    const dvx = (k1.vx + 2 * k2.vx + 2 * k3.vx + k4.vx) / 6;
    const dvy = (k1.vy + 2 * k2.vy + 2 * k3.vy + k4.vy) / 6;
    const spd = Math.sqrt(dvx * dvx + dvy * dvy);
    if (spd < 0.01) break;

    // Normalize step length for uniform tracing
    x += (dvx / spd) * DT;
    y += (dvy / spd) * DT;

    // Local speed factor relative to freestream (for colour mapping)
    const localSpd = Math.sqrt(k1.vx ** 2 + k1.vy ** 2) / V;
    coords.push([x, y, localSpd]);

    // Stop when past the field boundary downwind
    const downwind = x * wx + y * wy;
    if (downwind > stopDist) break;
  }

  return coords;
}

// ── Wake zone polygon ─────────────────────────────────────────────────────────

function buildWakeZone(cx, cy, windTo, a) {
  const toRad = (windTo * Math.PI) / 180;
  const wx = Math.sin(toRad); // wind direction (east component)
  const wy = Math.cos(toRad); // wind direction (north component)
  const px = -wy;             // perpendicular (left)
  const py = wx;

  const N = 32;
  const pts = [];
  for (let i = 0; i <= N; i++) {
    const t = (i / N) * Math.PI * 2;
    // Ellipse in the wind-aligned frame: centre 2a downwind, 2.5a long, 1.4a wide
    const along = Math.cos(t) * a * 2.5 + a * 2;
    const lateral = Math.sin(t) * a * 1.4;
    // Back to geo metres
    const gx = along * wx + lateral * px;
    const gy = along * wy + lateral * py;
    pts.push(fromMeters(gx, gy, cx, cy));
  }

  return {
    type: 'Feature',
    geometry: { type: 'Polygon', coordinates: [pts] },
    properties: { zone: 'wake' },
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

export function computeWindFlowPaths(building, windFrom, speedKmh, fieldRadiusM = 500) {
  if (!building || speedKmh == null) return null;
  if (!outerRing(building)) return null;

  const [cx, cy] = centroidOf(building);
  const areaM2 = area(building);
  if (!areaM2 || areaM2 <= 0) return null;
  const a = Math.sqrt(areaM2 / Math.PI);

  const V = speedKmh / 3.6;
  const windTo = (windFrom + 180) % 360;
  const toRad = (windTo * Math.PI) / 180;
  const wx = Math.sin(toRad);
  const wy = Math.cos(toRad);
  const perpX = -wy;
  const perpY = wx;

  // Span the full field radius so lines trace through the heatmap area.
  const N_LINES = 20;
  const upstreamDist = Math.min(fieldRadiusM * 0.9, Math.max(a * 3.5, 200));
  const sideSpan = Math.min(fieldRadiusM * 0.7, Math.max(a * 2.6, 150));

  const features = [];
  // Step size and max steps scaled to field radius so lines trace full distance.
  const DT_FIELD = Math.max(a * 0.18, fieldRadiusM / 120);
  const MAX_STEPS_FIELD = Math.ceil((fieldRadiusM * 2) / DT_FIELD);

  for (let i = 0; i < N_LINES; i++) {
    const t = -1 + (2 * i) / (N_LINES - 1); // -1 … +1
    const offset = t * sideSpan;
    const sx = -wx * upstreamDist + perpX * offset;
    const sy = -wy * upstreamDist + perpY * offset;

    const raw = traceStreamline(sx, sy, windTo, a, V, DT_FIELD, MAX_STEPS_FIELD, fieldRadiusM);
    if (raw.length < 3) continue;

    const geoCoords = raw.map(([mx, my]) => fromMeters(mx, my, cx, cy));
    const meanSpeedFactor = raw.reduce((s, p) => s + (p[2] ?? 1), 0) / raw.length;

    features.push({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: geoCoords },
      properties: { speedFactor: Math.round(meanSpeedFactor * 100) / 100 },
    });
  }

  features.push(buildWakeZone(cx, cy, windTo, a));

  return { type: 'FeatureCollection', features };
}

// ── Comfort field ─────────────────────────────────────────────────────────────
// Returns a GeoJSON FeatureCollection of square grid cells covering a 500 m
// radius around the building.  Each cell is coloured by estimated pedestrian
// wind speed (Lawson comfort) from the potential-flow model, producing a
// continuous CFD-style heatmap at ground level.

export function buildComfortField(building, windFrom, speedKmh, radiusM = 500, gridM = 12) {
  if (!building || !speedKmh) return null;
  if (!outerRing(building)) return null;

  const [cx, cy] = centroidOf(building);
  const areaM2 = area(building);
  if (!areaM2 || areaM2 <= 0) return null;
  const a = Math.sqrt(areaM2 / Math.PI);
  const V = speedKmh / 3.6;
  const windTo = (windFrom + 180) % 360;

  const features = [];
  const half = gridM / 2;
  const r2Max = radiusM * radiusM;
  const buildingR2 = (a * 0.85) ** 2; // skip cells inside building footprint

  for (let mx = -radiusM + half; mx < radiusM; mx += gridM) {
    for (let my = -radiusM + half; my < radiusM; my += gridM) {
      const r2 = mx * mx + my * my;
      if (r2 > r2Max) continue;     // outside 500 m circle
      if (r2 < buildingR2) continue; // inside building

      const { vx, vy } = velocityAt(mx, my, windTo, a, V);
      const speedMph = Math.sqrt(vx * vx + vy * vy) * PED_FACTOR * MS_TO_MPH;

      const corners = [
        fromMeters(mx - half, my - half, cx, cy),
        fromMeters(mx + half, my - half, cx, cy),
        fromMeters(mx + half, my + half, cx, cy),
        fromMeters(mx - half, my + half, cx, cy),
        fromMeters(mx - half, my - half, cx, cy),
      ];

      features.push({
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [corners] },
        properties: { speedMph: Math.round(speedMph * 10) / 10 },
      });
    }
  }

  return { type: 'FeatureCollection', features };
}

// Per-face pedestrian comfort (Lawson, speeds in mph).
export function assessPedestrianComfort(faces, windFrom, speedKmh) {
  if (!faces?.length || !speedKmh) return [];
  const V_ped = (speedKmh / 3.6) * PED_FACTOR;
  return faces.map((f) => {
    const factor = f.role === 'inlet' ? 0.6 : f.role === 'outlet' ? 0.35 : 0.85;
    const speedMph = Math.round(V_ped * factor * MS_TO_MPH * 10) / 10;
    return { ...f, speedMph, comfort: lawsonCategory(speedMph) };
  });
}

export function cornerSpeedMph(speedKmh) {
  return Math.round((speedKmh / 3.6) * PED_FACTOR * 1.55 * MS_TO_MPH * 10) / 10;
}
