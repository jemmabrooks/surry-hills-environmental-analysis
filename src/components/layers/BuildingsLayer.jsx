import { Source, Layer } from 'react-map-gl/maplibre';

// Buildings: 2D fill or 3D extrusion depending on `view`. Both layers stay
// mounted at all times (toggled via layout.visibility) so other layers can
// always use beforeId="buildings-fill" as a stable insertion point.
export function BuildingsLayer({ data, view, selectedId }) {
  // Always mount so "buildings-fill" exists as a stable beforeId anchor.
  const geoData = data ?? { type: 'FeatureCollection', features: [] };
  const is3D = view === '3D';
  const show2D = (data && !is3D) ? 'visible' : 'none';
  const show3D = (data && is3D) ? 'visible' : 'none';

  return (
    <Source id="buildings" type="geojson" data={geoData} promoteId="id">
      <Layer
        id="buildings-fill"
        type="fill"
        layout={{ visibility: show2D }}
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
      <Layer
        id="buildings-outline"
        type="line"
        layout={{ visibility: show2D }}
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
      <Layer
        id="buildings-3d"
        type="fill-extrusion"
        layout={{ visibility: show3D }}
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
    </Source>
  );
}
