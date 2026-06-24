import { Source, Layer } from 'react-map-gl/maplibre';

const WAKE_LAYER = {
  id: 'wind-flow-wake',
  type: 'fill',
  filter: ['==', ['get', 'zone'], 'wake'],
  paint: {
    'fill-color': '#64748b',
    'fill-opacity': 0.12,
  },
};

const STREAM_LAYER = {
  id: 'wind-flow-lines',
  type: 'line',
  filter: ['!=', ['get', 'zone'], 'wake'],
  paint: {
    'line-color': [
      'interpolate', ['linear'], ['get', 'speedFactor'],
      0.2, '#2563eb',   // decelerated — blue
      0.6, '#0891b2',   // below freestream — cyan
      1.0, '#0d9488',   // freestream — teal
      1.4, '#d97706',   // accelerated — amber
      1.8, '#dc2626',   // high acceleration — red
    ],
    'line-width': 2,
    'line-opacity': 0.85,
  },
};

export function WindFlowLayer({ data }) {
  if (!data) return null;
  return (
    <Source id="wind-flow" type="geojson" data={data}>
      <Layer {...WAKE_LAYER} />
      <Layer {...STREAM_LAYER} />
    </Source>
  );
}
