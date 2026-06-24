import { useMemo } from 'react';
import { Source, Layer } from 'react-map-gl/maplibre';
import { centroidOf } from '../../lib/geometry';

const OUTER_R   = 120;  // tail start (metres from centre)
const INNER_R   = 28;   // arrowhead tip
const WING_LEN  = 14;   // arrowhead wing length (metres)
const WING_ANG  = 32;   // wing spread angle (degrees from shaft)
const BLUE      = '#3b82f6';

function mToDeg(lat) {
  return {
    pLng: 1 / (111000 * Math.cos((lat * Math.PI) / 180)),
    pLat: 1 / 111000,
  };
}

// Point from origin (cx,cy) along compass bearing at distance
function bearPt(cx, cy, pLng, pLat, bearDeg, distM, perpM = 0) {
  const r  = (bearDeg * Math.PI) / 180;
  const rE = Math.sin(r), rN = Math.cos(r);
  return [cx + (rE * distM + rN * perpM) * pLng,
          cy + (rN * distM - rE * perpM) * pLat];
}

// Point from any geo coordinate along a bearing
function ptFrom([ox, oy], pLng, pLat, bearDeg, distM) {
  const r = (bearDeg * Math.PI) / 180;
  return [ox + Math.sin(r) * distM * pLng,
          oy + Math.cos(r) * distM * pLat];
}

// Quadratic bezier
function qBez(p0, p1, p2, steps = 50) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, u = 1 - t;
    pts.push([u*u*p0[0] + 2*u*t*p1[0] + t*t*p2[0],
              u*u*p0[1] + 2*u*t*p1[1] + t*t*p2[1]]);
  }
  return pts;
}

// Returns true if two line segments (a1→a2) and (b1→b2) intersect
function segmentsIntersect(a1, a2, b1, b2) {
  const dx1 = a2[0] - a1[0], dy1 = a2[1] - a1[1];
  const dx2 = b2[0] - b1[0], dy2 = b2[1] - b1[1];
  const denom = dx1 * dy2 - dy1 * dx2;
  if (Math.abs(denom) < 1e-12) return false;
  const t = ((b1[0] - a1[0]) * dy2 - (b1[1] - a1[1]) * dx2) / denom;
  const u = ((b1[0] - a1[0]) * dy1 - (b1[1] - a1[1]) * dx1) / denom;
  return t > 0.01 && t < 0.99 && u > 0.01 && u < 0.99;
}

function polylinesIntersect(p1, p2) {
  for (let i = 0; i < p1.length - 1; i++) {
    for (let j = 0; j < p2.length - 1; j++) {
      if (segmentsIntersect(p1[i], p1[i + 1], p2[j], p2[j + 1])) return true;
    }
  }
  return false;
}

function buildArrow(cx, cy, pLng, pLat, dirDeg, side) {
  // Tail starts outside, curves inward
  const tail  = bearPt(cx, cy, pLng, pLat, dirDeg, OUTER_R, side * 22);
  const ctrl  = bearPt(cx, cy, pLng, pLat, dirDeg, OUTER_R * 0.42, side * 50);
  // Offset tip perpendicular so the two arrows target different sides and never cross
  const tip   = bearPt(cx, cy, pLng, pLat, dirDeg, INNER_R, side * 16);

  // Curve ends exactly at the tip so tail and head share the apex point
  const curve = qBez(tail, ctrl, tip);

  // Compute wings from the curve's actual arrival bearing at the tip,
  // so they open backward along the line direction (not fixed to dirDeg)
  const prev = curve[curve.length - 2];
  const dxM = (tip[0] - prev[0]) / pLng;
  const dyM = (tip[1] - prev[1]) / pLat;
  const arrivalBear = (Math.atan2(dxM, dyM) * 180) / Math.PI;
  const backBear    = (arrivalBear + 180 + 360) % 360;
  const wL = ptFrom(tip, pLng, pLat, (backBear + WING_ANG + 360) % 360, WING_LEN);
  const wR = ptFrom(tip, pLng, pLat, (backBear - WING_ANG + 360) % 360, WING_LEN);

  // V-shape: wL → tip → wR (open, no fill), shares tip with curve endpoint
  const head = [wL, tip, wR];

  return { curve, head };
}

export function WindArrows3DLayer({ building, allWindRose, month }) {
  const rose = allWindRose?.[month] ?? null;

  const geojson = useMemo(() => {
    if (!building || !rose?.length) return null;
    const [cx, cy] = centroidOf(building);
    const { pLng, pLat } = mToDeg(cy);

    const top2    = [...rose].sort((a, b) => b.freq - a.freq).slice(0, 2);
    const features = [];

    const arrows = top2.map((bin, idx) => {
      const side = idx === 0 ? 1 : -1;
      const lw   = idx === 0 ? 3.5 : 2;
      return { ...buildArrow(cx, cy, pLng, pLat, bin.dir, side), lw };
    });

    // Drop secondary arrow if it would cross the dominant
    const visibleArrows =
      arrows.length === 2 && polylinesIntersect(arrows[0].curve, arrows[1].curve)
        ? [arrows[0]]
        : arrows;

    visibleArrows.forEach(({ curve, head, lw }) => {
      features.push({
        type: 'Feature',
        properties: { w: lw },
        geometry: { type: 'LineString', coordinates: curve },
      });
      features.push({
        type: 'Feature',
        properties: { w: lw },
        geometry: { type: 'LineString', coordinates: head },
      });
    });

    return { type: 'FeatureCollection', features };
  }, [building, rose]);

  if (!geojson) return null;

  return (
    <Source id="wind-arrows-lines" type="geojson" data={geojson}>
      <Layer
        id="wind-arrows-lines-layer"
        type="line"
        layout={{
          'line-cap':  'round',
          'line-join': 'round',
        }}
        paint={{
          'line-color':   BLUE,
          'line-width':   ['get', 'w'],
          'line-opacity': 0.92,
        }}
      />
    </Source>
  );
}
