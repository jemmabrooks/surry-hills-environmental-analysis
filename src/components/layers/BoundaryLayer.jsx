import { Source, Layer } from 'react-map-gl/maplibre';
import { SURRY_HILLS_BOUNDARY } from '../../data/boundary';

export function BoundaryLayer() {
  return (
    <Source id="sh-boundary" type="geojson" data={SURRY_HILLS_BOUNDARY}>
      <Layer
        id="sh-boundary-line"
        type="line"
        paint={{ 'line-color': '#000000', 'line-width': 2, 'line-dasharray': [3, 2] }}
      />
    </Source>
  );
}
