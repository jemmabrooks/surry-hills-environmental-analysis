import { useMemo } from 'react';
import { Source, Layer } from 'react-map-gl/maplibre';

export function DrawingPreviewLayer({ points, color = '#ef4444', sourceId = 'drawing-preview' }) {
  const data = useMemo(() => {
    if (!points || points.length === 0) return null;

    const features = [];

    // Line connecting all placed points (+ closing line if >=3)
    if (points.length >= 2) {
      const coords = points.length >= 3
        ? [...points, points[0]]
        : points;
      features.push({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: coords },
        properties: {},
      });
    }

    // Vertex dots
    for (const pt of points) {
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: pt },
        properties: {},
      });
    }

    return { type: 'FeatureCollection', features };
  }, [points]);

  if (!data) return null;

  return (
    <Source id={sourceId} type="geojson" data={data}>
      <Layer
        id={`${sourceId}-fill`}
        type="fill"
        filter={['==', '$type', 'Polygon']}
        paint={{ 'fill-color': color, 'fill-opacity': 0.12 }}
      />
      <Layer
        id={`${sourceId}-line`}
        type="line"
        filter={['==', '$type', 'LineString']}
        paint={{ 'line-color': color, 'line-width': 2, 'line-dasharray': [4, 2] }}
      />
      <Layer
        id={`${sourceId}-points`}
        type="circle"
        filter={['==', '$type', 'Point']}
        paint={{
          'circle-radius': 6,
          'circle-color': color,
          'circle-stroke-color': '#fff',
          'circle-stroke-width': 2,
        }}
      />
    </Source>
  );
}
