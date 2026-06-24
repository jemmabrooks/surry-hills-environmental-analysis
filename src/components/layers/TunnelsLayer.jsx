import { Source, Layer } from 'react-map-gl/maplibre';

// Highlighted wind-tunnel corridors; width/colour scale with intensity.
export function TunnelsLayer({ data }) {
  if (!data) return null;
  return (
    <Source id="tunnels" type="geojson" data={data}>
      <Layer
        id="tunnels-glow"
        type="line"
        paint={{
          'line-color': '#ff3d8b',
          'line-opacity': ['interpolate', ['linear'], ['get', 'intensity'], 0, 0.25, 1, 0.7],
          'line-width': ['interpolate', ['linear'], ['get', 'intensity'], 0, 6, 1, 16],
          'line-blur': 6,
        }}
      />
      <Layer
        id="tunnels-core"
        type="line"
        paint={{
          'line-color': '#ff3d8b',
          'line-width': ['interpolate', ['linear'], ['get', 'intensity'], 0, 1.5, 1, 4],
        }}
      />
    </Source>
  );
}
