import { useMemo } from 'react';
import { Source, Layer } from 'react-map-gl/maplibre';
import { centroidOf } from '../../lib/geometry';

// Ring extends from INNER_R to INNER_R + petal length.
// Petals hug the building edge so the building sits in the centre.
const INNER_R_M  = 30;   // metres from centroid where petals start
const MAX_EXT_M  = 80;   // max petal extension beyond inner ring
const N_ARC_PTS  = 10;   // arc resolution per petal
const RING_FRACS = [0.25, 0.5, 0.75, 1.0]; // ring lines as fraction of max

// Convert metres → degrees (approximate, good enough at suburb scale)
function mToDeg(metres, lat) {
  const dLat = metres / 111000;
  const dLng = metres / (111000 * Math.cos((lat * Math.PI) / 180));
  return { dLat, dLng };
}

// Point at `bearing` degrees (0=N, 90=E) and `radiusM` metres from centre
function polarPt(lng, lat, radiusM, bearingDeg) {
  const rad = (bearingDeg * Math.PI) / 180;
  const { dLat, dLng } = mToDeg(radiusM, lat);
  return [lng + dLng * Math.sin(rad), lat + dLat * Math.cos(rad)];
}

function speedColor(kmh) {
  if (kmh < 8)  return '#60a5fa'; // calm  — light blue
  if (kmh < 16) return '#34d399'; // light — teal
  if (kmh < 25) return '#0d9488'; // moderate — dark teal
  return '#1d4ed8';               // strong — deep blue
}

// Build ring-sector (annular wedge) polygon for one direction bin
function ringPetal(lng, lat, innerR, outerR, dirDeg, halfBin) {
  // inner arc (clockwise)
  const inner = [];
  for (let i = 0; i <= N_ARC_PTS; i++) {
    const a = (dirDeg - halfBin) + (i / N_ARC_PTS) * halfBin * 2;
    inner.push(polarPt(lng, lat, innerR, a));
  }
  // outer arc (counter-clockwise back)
  const outer = [];
  for (let i = N_ARC_PTS; i >= 0; i--) {
    const a = (dirDeg - halfBin) + (i / N_ARC_PTS) * halfBin * 2;
    outer.push(polarPt(lng, lat, outerR, a));
  }
  return [...inner, ...outer, inner[0]]; // closed ring
}

function buildGeoJSON(center, rose) {
  const [lng, lat] = center;
  const BIN_DEG  = 360 / rose.length;
  const halfBin  = BIN_DEG / 2;
  const maxFreq  = Math.max(...rose.map(b => b.freq), 0.001);

  const petalFeatures = rose.flatMap((bin) => {
    const ext = (bin.freq / Math.max(maxFreq, 0.15)) * MAX_EXT_M;
    if (ext < 2) return [];
    const inner = INNER_R_M;
    const outer = INNER_R_M + ext;
    const ring  = ringPetal(lng, lat, inner, outer, bin.dir, halfBin);
    return [{
      type: 'Feature',
      properties: { color: speedColor(bin.speed) },
      geometry: { type: 'Polygon', coordinates: [ring] },
    }];
  });

  // Concentric ring lines (guides at 25 / 50 / 75 / 100 % of max extension)
  const ringFeatures = RING_FRACS.map((frac) => {
    const r = INNER_R_M + frac * MAX_EXT_M;
    const pts = [];
    for (let a = 0; a <= 360; a += 5) pts.push(polarPt(lng, lat, r, a));
    return {
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: pts },
    };
  });

  // Spoke lines at cardinals + intercardinals
  const spokeFeatures = [0, 45, 90, 135, 180, 225, 270, 315].map(bearing => ({
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'LineString',
      coordinates: [
        polarPt(lng, lat, INNER_R_M, bearing),
        polarPt(lng, lat, INNER_R_M + MAX_EXT_M + 8, bearing),
      ],
    },
  }));

  return {
    petals: { type: 'FeatureCollection', features: petalFeatures },
    guides: { type: 'FeatureCollection', features: [...ringFeatures, ...spokeFeatures] },
  };
}

export function WindRoseGroundLayer({ building, allWindRose, month }) {
  const rose = allWindRose?.[month] ?? null;

  const { petals, guides } = useMemo(() => {
    if (!building || !rose?.length) return {};
    const center = centroidOf(building);
    return buildGeoJSON(center, rose);
  }, [building, rose]);

  if (!petals) return null;

  return (
    <>
      {/* Petals — rendered on top of building fills */}
      <Source id="wr-petals" type="geojson" data={petals}>
        <Layer
          id="wr-petals-fill"
          type="fill"
          paint={{
            'fill-color': ['get', 'color'],
            'fill-opacity': 0.78,
          }}
        />
        <Layer
          id="wr-petals-stroke"
          type="line"
          paint={{ 'line-color': 'rgba(255,255,255,0.5)', 'line-width': 0.6 }}
        />
      </Source>

      {/* Concentric guide rings + spokes */}
      <Source id="wr-guides" type="geojson" data={guides}>
        <Layer
          id="wr-guides-line"
          type="line"
          paint={{
            'line-color': 'rgba(0,0,0,0.20)',
            'line-width': 0.7,
            'line-dasharray': [3, 3],
          }}
        />
      </Source>
    </>
  );
}
