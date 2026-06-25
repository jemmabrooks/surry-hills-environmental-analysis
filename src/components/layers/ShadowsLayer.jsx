import { Source, Layer } from 'react-map-gl/maplibre';

// Both layer types stay mounted at all times — visibility toggled by view.
// 2D: flat fill below buildings-fill. 3D: fill-extrusion at 0.1 m so depth
// testing naturally places shadows below the taller building extrusions.
// beforeId2D / beforeId3D let callers control stacking order between two
// ShadowsLayer instances (e.g. proposed below existing).
export function ShadowsLayer({
  data,
  view,
  sourceId = 'shadows',
  color = '#3a3a3a',
  opacity = 1,
  beforeId2D = undefined,
  beforeId3D = undefined,
}) {
  const geoData = data ?? { type: 'FeatureCollection', features: [] };
  const show2D = (!data || view === '3D') ? 'none' : 'visible';
  const show3D = (data && view === '3D') ? 'visible' : 'none';
  return (
    <Source id={sourceId} type="geojson" data={geoData}>
      <Layer
        id={`${sourceId}-fill`}
        type="fill"
        beforeId={beforeId2D}
        layout={{ visibility: show2D }}
        paint={{ 'fill-color': color, 'fill-opacity': opacity }}
      />
      <Layer
        id={`${sourceId}-fill-3d`}
        type="fill-extrusion"
        beforeId={beforeId3D}
        layout={{ visibility: show3D }}
        paint={{
          'fill-extrusion-color': color,
          'fill-extrusion-opacity': opacity,
          'fill-extrusion-height': 0.1,
          'fill-extrusion-base': 0,
        }}
      />
    </Source>
  );
}
