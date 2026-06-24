import { Source, Layer } from 'react-map-gl/maplibre';

// Continuous speed → colour ramp (mph at 1.5 m pedestrian height).
// Breakpoints align with Lawson A/B/C/D thresholds (converted to mph).
const FILL_LAYER = {
  id: 'comfort-ring-fill',
  type: 'fill',
  paint: {
    'fill-color': [
      'interpolate', ['linear'], ['get', 'speedMph'],
      0,    '#2563eb',  // calm — blue
      3.4,  '#059669',  // A (sitting) — emerald   (~1.5 m/s)
      5.5,  '#16a34a',  // A upper — green          (2.5 m/s)
      7.2,  '#84cc16',  // B (standing) — lime      (3.2 m/s)
      9.0,  '#eab308',  // B/C border — yellow      (4.0 m/s)
      11.2, '#f97316',  // C (walking) — orange     (5.0 m/s)
      13.4, '#dc2626',  // D (uncomfortable) — red  (6.0 m/s)
      22.4, '#7c3aed',  // E (unsafe) — purple      (10 m/s)
    ],
    'fill-opacity': 0.62,
  },
};

// Thin dark outline between segments for definition
const OUTLINE_LAYER = {
  id: 'comfort-ring-outline',
  type: 'line',
  paint: {
    'line-color': 'rgba(0,0,0,0.15)',
    'line-width': 0.5,
  },
};

export function ComfortRingLayer({ data }) {
  if (!data) return null;
  return (
    <Source id="comfort-ring" type="geojson" data={data}>
      <Layer {...FILL_LAYER} />
      <Layer {...OUTLINE_LAYER} />
    </Source>
  );
}

// Legend data — exported so a sidebar/overlay component can consume it.
export const COMFORT_LEGEND = [
  { label: 'A  Sitting',       color: '#059669', maxMph: 5.5  },
  { label: 'B  Standing',      color: '#84cc16', maxMph: 9.0  },
  { label: 'C  Walking',       color: '#eab308', maxMph: 13.5 },
  { label: 'D  Uncomfortable', color: '#f97316', maxMph: 22.0 },
  { label: 'E  Unsafe',        color: '#dc2626', maxMph: null  },
];
