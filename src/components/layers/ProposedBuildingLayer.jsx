import { Source, Layer } from 'react-map-gl/maplibre';

// Always-mounted with visibility toggle so layer IDs are stable for INTERACTIVE
// and shadow layers can reference them via beforeId without timing issues.
export function ProposedBuildingLayer({ building, view }) {
  const data = building
    ? { type: 'FeatureCollection', features: [building] }
    : { type: 'FeatureCollection', features: [] };
  const show2D = view === '3D' ? 'none' : 'visible';
  const show3D = view === '3D' ? 'visible' : 'none';

  return (
    <Source id="proposed-building" type="geojson" data={data} promoteId="id">
      <Layer
        id="proposed-building-fill"
        type="fill"
        layout={{ visibility: show2D }}
        paint={{ 'fill-color': '#ef4444', 'fill-opacity': 1 }}
      />
      <Layer
        id="proposed-building-outline"
        type="line"
        layout={{ visibility: show2D }}
        paint={{ 'line-color': '#b91c1c', 'line-width': 2 }}
      />
      <Layer
        id="proposed-building-3d"
        type="fill-extrusion"
        layout={{ visibility: show3D }}
        paint={{
          'fill-extrusion-color': '#ef4444',
          'fill-extrusion-height': ['get', 'height'],
          'fill-extrusion-base': 0,
          'fill-extrusion-opacity': 1,
        }}
      />
    </Source>
  );
}
