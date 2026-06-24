// Sydney / Surry Hills geographic constants (from product brief).
export const SYDNEY = {
  lat: -33.8936,
  lng: 151.2093,
  timezone: 'Australia/Sydney',
  magneticDeclination: 12.7, // degrees east — applied when converting wind to true bearing
};

// MapLibre uses [lng, lat] order.
export const SURRY_HILLS = {
  center: [151.2117, -33.8874],
  defaultZoom: 15.2,
  // Overpass search anchor (town hall) + radius in metres.
  overpass: { lat: -33.8874, lng: 151.2117, radius: 2000 },
};

// 3D view uses a fixed isometric-style tilt (no free rotation), per brief.
export const VIEW_3D_PITCH = 50;
export const VIEW_2D_PITCH = 0;

// Building height fallbacks (ADR-003).
export const DEFAULT_STOREY_HEIGHT = 3.0; // metres per level
export const DEFAULT_BUILDING_HEIGHT = 6.0; // metres (2 storeys) when no data

// Shadow rendering (ADR-005): clamp very low sun to avoid infinite shadows.
export const MIN_SUN_ALTITUDE_DEG = 5;

// Wind tunnel heuristic thresholds (ADR-006).
export const TUNNEL = {
  maxGapWidth: 12, // metres
  minBuildingHeight: 10, // metres (both flanks)
  searchRadius: 20, // metres between building pairs
  alignmentTolerance: 45, // degrees from wind direction
};

export const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];
