import { Source, Layer } from 'react-map-gl/maplibre';

// Renders per-building analysis markers (solar zones, ventilation faces,
// glazing facades) as colored circles + optional flow lines. Each feature
// carries a `color` property and points/lines are styled data-driven.
export function AnalysisOverlay({ points, lines }) {
  return (
    <>
      {lines && (
        <Source id="analysis-lines" type="geojson" data={lines}>
          <Layer
            id="analysis-lines-layer"
            type="line"
            paint={{
              'line-color': ['get', 'color'],
              'line-width': 3,
            }}
          />
        </Source>
      )}
      {points && (
        <Source id="analysis-points" type="geojson" data={points}>
          <Layer
            id="analysis-points-halo"
            type="circle"
            paint={{
              'circle-radius': 13,
              'circle-color': ['get', 'color'],
              'circle-opacity': 0.25,
            }}
          />
          <Layer
            id="analysis-points-core"
            type="circle"
            paint={{
              'circle-radius': 7,
              'circle-color': ['get', 'color'],
              'circle-stroke-color': '#ffffff',
              'circle-stroke-width': 2,
            }}
          />
        </Source>
      )}
    </>
  );
}
