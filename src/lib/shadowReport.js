// Shadow analysis calculation engine.
// Reuses shadowForBuilding() and getSunPosition() — no new solar math.
import { booleanPointInPolygon, bbox } from '@turf/turf';
import { shadowForBuilding } from './shadows';
import { getSunPosition, sydneyDate } from './sun';
import { facadeOrientations, angularDiff } from './geometry';
import { MIN_SUN_ALTITUDE_DEG } from '../constants';

const YEAR = 2026; // any year works for solstice geometry

export const SHADOW_MOMENTS = [
  { season: 'winter', label: 'Winter · 9am',   month: 5,  day: 21, hour: 9  },
  { season: 'winter', label: 'Winter · Noon',  month: 5,  day: 21, hour: 12 },
  { season: 'winter', label: 'Winter · 3pm',   month: 5,  day: 21, hour: 15 },
  { season: 'summer', label: 'Summer · 9am',   month: 11, day: 21, hour: 9  },
  { season: 'summer', label: 'Summer · Noon',  month: 11, day: 21, hour: 12 },
  { season: 'summer', label: 'Summer · 3pm',   month: 11, day: 21, hour: 15 },
];

export function computeShadowMoments(building) {
  return SHADOW_MOMENTS.map(m => {
    const sun = getSunPosition(sydneyDate(YEAR, m.month, m.day, m.hour));
    const shadow = shadowForBuilding(building, sun);
    return { ...m, sun, shadow };
  });
}

// BCA-style overshadowing compliance: 21 June, 9am–3pm, sampled every 30 min.
// A grid point passes if it receives ≥3 hours of unobstructed direct sun.
// Compliance requires ≥50% of POS area to pass.
export function computeCompliance(building, posFeature) {
  if (!posFeature) return null;

  const STEP = 0.5; // 30-min intervals
  const times = [];
  for (let h = 9; h <= 15.001; h += STEP) times.push(h);

  const shadows = times.map(h => {
    const sun = getSunPosition(sydneyDate(YEAR, 5, 21, h));
    // Sun below min altitude → building casts an "infinite" shadow, treat as fully shadowed
    if (sun.altitude <= MIN_SUN_ALTITUDE_DEG) return '__shadowed__';
    return shadowForBuilding(building, sun); // Feature|null
  });

  const [minX, minY, maxX, maxY] = bbox(posFeature);
  const midLat = (minY + maxY) / 2;
  const GRID_M = 2;
  const dLng = GRID_M / (111320 * Math.cos((midLat * Math.PI) / 180));
  const dLat = GRID_M / 111320;

  let total = 0, passing = 0;

  for (let lat = minY + dLat / 2; lat < maxY; lat += dLat) {
    for (let lng = minX + dLng / 2; lng < maxX; lng += dLng) {
      const pt = { type: 'Feature', geometry: { type: 'Point', coordinates: [lng, lat] }, properties: {} };
      if (!booleanPointInPolygon(pt, posFeature)) continue;
      total++;

      let sunHours = 0;
      for (const sh of shadows) {
        if (sh === '__shadowed__') continue; // sun below horizon — no contribution
        if (!sh || !booleanPointInPolygon(pt, sh)) sunHours += STEP; // not in shadow → direct sun
      }
      if (sunHours >= 3) passing++;
    }
  }

  if (total === 0) return { pass: false, posPercent: 0, total: 0, passing: 0 };
  const posPercent = Math.round((passing / total) * 100);
  return { pass: posPercent >= 50, posPercent, total, passing };
}

// Which facades drive the most winter overshadowing.
// Returns facade array enriched with winterShadowContrib (0..1).
export function analyseFacades(building, moments) {
  const faces = facadeOrientations(building);
  const winterMoments = moments.filter(m => m.season === 'winter' && m.shadow);
  if (!winterMoments.length) return faces.map(f => ({ ...f, winterShadowContrib: 0 }));

  return faces.map(f => {
    const contrib = winterMoments.filter(m => {
      // Shadow direction opposite to sun; facade "catches" shadow if its outward
      // normal faces the shadow direction (i.e. faces away from the sun)
      const shadowDir = (m.sun.azimuth + 180) % 360;
      return angularDiff(f.bearing, shadowDir) < 90;
    }).length / winterMoments.length;

    return { ...f, winterShadowContrib: contrib };
  });
}

// Rule-based plain-language recommendations.
// Logic is explicit: each rule records WHY it fired.
export function generateRecommendations(building, compliance, moments, facadeAnalysis) {
  const recs = [];
  const h = building.properties?.height ?? 6;

  // Rule 1: Compliance failure or marginal
  if (compliance?.pass === false) {
    recs.push(
      `Fails BCA overshadowing: only ${compliance.posPercent}% of POS receives ≥3h direct sun ` +
      `on 21 June 9am–3pm (minimum 50% required). ` +
      `Reduce building height or increase setback from the southern boundary.`
    );
  } else if (compliance && compliance.posPercent < 70) {
    recs.push(
      `Marginal compliance: ${compliance.posPercent}% of POS meets the 3-hour winter sun threshold ` +
      `(min 50%). A minor height reduction on the northern mass would improve solar access.`
    );
  }

  // Rule 2: Dominant winter-shadow facade
  const topFacade = facadeAnalysis
    ?.slice()
    .sort((a, b) => b.winterShadowContrib - a.winterShadowContrib)[0];
  if (topFacade?.winterShadowContrib >= 0.5) {
    recs.push(
      `${topFacade.cardinal}-facing facade contributes shadow for ` +
      `${Math.round(topFacade.winterShadowContrib * 100)}% of the winter analysis window. ` +
      `Horizontal eaves or cantilevered screens on this facade allow low winter sun through ` +
      `while blocking high summer sun (rule of thumb: eave depth ≈ 0.6× window height for Sydney lat 34°S).`
    );
  }

  // Rule 3: Height-based shadow reach
  if (h > 12) {
    recs.push(
      `Height of ${Math.round(h)} m generates shadows reaching ${Math.round(h / Math.tan(33 * Math.PI / 180))} m ` +
      `at solar noon in winter. A podium-and-tower articulation (lower base, smaller upper mass) ` +
      `reduces ground-level shadow extent without reducing floor area.`
    );
  }

  // Rule 4: West facade summer heat gain (always relevant in Sydney)
  recs.push(
    `West facade receives peak afternoon solar radiation in summer (heat gain risk). ` +
    `Install external vertical fins or a brise-soleil with fin spacing:projection ≥ 1:1, ` +
    `or specify high-performance glazing (SHGC ≤ 0.30, Uw ≤ 2.5 W/m²K).`
  );

  // Rule 5: South facade heat loss (always applies in Southern Hemisphere)
  recs.push(
    `South facade receives no direct sun year-round (Southern Hemisphere). ` +
    `Minimise south-facing glazing; specify double glazing (Uw ≤ 2.0 W/m²K) and R4.0+ wall insulation ` +
    `to limit conductive heat loss — this facade is the largest winter energy liability.`
  );

  return recs.slice(0, 5);
}
