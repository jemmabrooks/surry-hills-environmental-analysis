// Glazing & shading recommendations per facade, assessed against Sydney sun path.
import { facadeOrientations, angularDiff } from './geometry';

// Southern-hemisphere guidance from the product brief.
const STRATEGY = {
  N: {
    risk: 'medium',
    label: 'North',
    text: 'High annual solar gain — welcome in winter. Add eaves or horizontal shading to cut summer sun.',
  },
  W: {
    risk: 'high',
    label: 'West',
    text: 'Intense low afternoon sun. Specify high-performance glazing and external vertical fins.',
  },
  E: {
    risk: 'low',
    label: 'East',
    text: 'Morning sun, generally benign. Standard glazing is usually adequate.',
  },
  S: {
    risk: 'low',
    label: 'South',
    text: 'Minimal direct sun. Prioritise visible light transmittance over solar control.',
  },
};

function nearestPrimary(bearingDeg) {
  const primaries = [
    { k: 'N', b: 0 },
    { k: 'E', b: 90 },
    { k: 'S', b: 180 },
    { k: 'W', b: 270 },
  ];
  return primaries.reduce((best, p) =>
    angularDiff(bearingDeg, p.b) < angularDiff(bearingDeg, best.b) ? p : best,
  ).k;
}

// Returns { faces: [{cardinal, bearing, risk, label, text, midpoint}] }.
export function assessGlazing(building) {
  const faces = facadeOrientations(building);
  const byCardinal = {};
  for (const f of faces) {
    const primary = nearestPrimary(f.bearing);
    if (!byCardinal[primary] || f.length > byCardinal[primary].length) {
      byCardinal[primary] = { ...f, primary };
    }
  }
  const result = Object.values(byCardinal).map((f) => ({
    cardinal: f.primary,
    bearing: Math.round(f.bearing),
    midpoint: f.midpoint,
    ...STRATEGY[f.primary],
  }));
  // Stable order N, E, S, W
  const order = { N: 0, E: 1, S: 2, W: 3 };
  result.sort((a, b) => order[a.cardinal] - order[b.cardinal]);
  return { faces: result };
}

export const RISK_COLOR = { high: '#e4572e', medium: '#f3c01b', low: '#1ea64a' };
