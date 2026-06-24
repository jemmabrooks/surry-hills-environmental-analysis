import { Source, Layer } from 'react-map-gl/maplibre';

export function PosLayer({ posPolygon }) {
  if (!posPolygon) return null;
  return (
    <Source id="pos-polygon" type="geojson" data={posPolygon}>
      <Layer
        id="pos-fill"
        type="fill"
        paint={{ 'fill-color': '#16a34a', 'fill-opacity': 0.12 }}
      />
      <Layer
        id="pos-outline"
        type="line"
        layout={{ 'line-cap': 'round', 'line-join': 'round' }}
        paint={{ 'line-color': '#16a34a', 'line-width': 2, 'line-dasharray': [5, 3] }}
      />
    </Source>
  );
}
