import { Source, Layer } from 'react-map-gl/maplibre';

// Semi-transparent dark shadow polygons.
export function ShadowsLayer({ data }) {
  if (!data) return null;
  return (
    <Source id="shadows" type="geojson" data={data}>
      <Layer
        id="shadows-fill"
        type="fill"
        beforeId="buildings-fill"
        paint={{ 'fill-color': '#4a4a4a', 'fill-opacity': 1 }}
      />
    </Source>
  );
}
