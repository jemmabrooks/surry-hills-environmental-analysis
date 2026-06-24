import { Source, Layer } from 'react-map-gl/maplibre';

export function ProposedBuildingLayer({ building, view }) {
  if (!building) return null;
  const data = { type: 'FeatureCollection', features: [building] };
  const is3D = view === '3D';
  return (
    <Source id="proposed-building" type="geojson" data={data}>
      {!is3D && (
        <Layer
          id="proposed-building-fill"
          type="fill"
          paint={{ 'fill-color': '#ef4444', 'fill-opacity': 1 }}
        />
      )}
      {!is3D && (
        <Layer
          id="proposed-building-outline"
          type="line"
          paint={{ 'line-color': '#b91c1c', 'line-width': 2 }}
        />
      )}
      {is3D && (
        <Layer
          id="proposed-building-3d"
          type="fill-extrusion"
          paint={{
            'fill-extrusion-color': '#ef4444',
            'fill-extrusion-height': ['get', 'height'],
            'fill-extrusion-base': 0,
            'fill-extrusion-opacity': 1,
          }}
        />
      )}
    </Source>
  );
}
