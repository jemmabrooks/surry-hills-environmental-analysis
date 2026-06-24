// Approximate Surry Hills suburb boundary (hand-traced, [lng, lat]).
// Sufficient for visual delineation + clipping; not survey-accurate.
export const SURRY_HILLS_BOUNDARY = {
  type: 'Feature',
  properties: { name: 'Surry Hills' },
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [151.2068, -33.8792],
        [151.2118, -33.8782],
        [151.2178, -33.8800],
        [151.2208, -33.8852],
        [151.2206, -33.8918],
        [151.2168, -33.8964],
        [151.2098, -33.8958],
        [151.2064, -33.8902],
        [151.2058, -33.8848],
        [151.2068, -33.8792],
      ],
    ],
  },
};

// A large rectangle covering the map extent, used as the "mask" outer ring so
// everything OUTSIDE the boundary can be dimmed (polygon-with-hole fill).
export const SURRY_HILLS_MASK = {
  type: 'Feature',
  properties: {},
  geometry: {
    type: 'Polygon',
    coordinates: [
      // Outer ring (whole world-ish around Sydney)
      [
        [151.16, -33.85],
        [151.27, -33.85],
        [151.27, -33.93],
        [151.16, -33.93],
        [151.16, -33.85],
      ],
      // Hole = the suburb boundary (reversed not required for rendering)
      SURRY_HILLS_BOUNDARY.geometry.coordinates[0],
    ],
  },
};
