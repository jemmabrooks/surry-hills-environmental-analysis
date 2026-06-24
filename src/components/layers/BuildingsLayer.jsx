import { Source, Layer } from 'react-map-gl/maplibre';

// Buildings: 2D fill or 3D extrusion depending on `view`. Selected building
// is highlighted via a feature-state-independent filter on its id.
export function BuildingsLayer({ data, view, selectedId }) {
  if (!data) return null;
  const is3D = view === '3D';

  return (
    <Source id="buildings" type="geojson" data={data} promoteId="id">
      {!is3D && (
        <Layer
          id="buildings-fill"
          type="fill"
          paint={{
            'fill-color': [
              'case',
              ['==', ['get', 'id'], selectedId ?? '__none__'],
              '#c5b0f4',
              '#d8d8d4',
            ],
            'fill-opacity': 1,
          }}
        />
      )}
      {!is3D && (
        <Layer
          id="buildings-outline"
          type="line"
          paint={{
            'line-color': [
              'case',
              ['==', ['get', 'id'], selectedId ?? '__none__'],
              '#000000',
              '#b6b6b0',
            ],
            'line-width': [
              'case',
              ['==', ['get', 'id'], selectedId ?? '__none__'],
              2.5,
              0.6,
            ],
          }}
        />
      )}
      {is3D && (
        <Layer
          id="buildings-3d"
          type="fill-extrusion"
          paint={{
            'fill-extrusion-color': [
              'case',
              ['==', ['get', 'id'], selectedId ?? '__none__'],
              '#c5b0f4',
              '#d2d2cc',
            ],
            'fill-extrusion-height': ['get', 'height'],
            'fill-extrusion-base': 0,
            'fill-extrusion-opacity': 1,
          }}
        />
      )}
    </Source>
  );
}
