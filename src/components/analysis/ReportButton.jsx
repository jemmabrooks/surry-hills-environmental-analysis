import { Button } from '../ui/Button';
import { generatePdf } from '../../lib/report';
import { scoreRoofZones } from '../../lib/solar';
import { assessVentilation } from '../../lib/ventilation';
import { assessGlazing } from '../../lib/glazing';
import { buildShadowPolygons } from '../../lib/shadows';
import { getSunPosition, sydneyDate } from '../../lib/sun';
import area from '@turf/area';

// Key times for shadow comparison: winter solstice (June 21), Sydney
const SHADOW_TIMES = [
  { label: '9 am', hour: 9 },
  { label: '12 pm', hour: 12 },
  { label: '3 pm', hour: 15 },
];

function shadowAreaM2(featureCollection, sun) {
  if (!featureCollection) return 0;
  let total = 0;
  for (const feat of featureCollection.features) {
    total += area(feat);
  }
  return Math.round(total);
}

function computeShadowComparison(buildings, proposedBuilding) {
  if (!buildings) return null;
  const rows = [];
  for (const { label, hour } of SHADOW_TIMES) {
    const sun = getSunPosition(sydneyDate(2026, 5, 21, hour)); // June = month 5 (0-indexed)
    const existingShadows = buildShadowPolygons(buildings, sun);
    const existingArea = shadowAreaM2(existingShadows, sun);

    let proposedArea = 0;
    if (proposedBuilding) {
      const propShadows = buildShadowPolygons(
        { type: 'FeatureCollection', features: [proposedBuilding] },
        sun,
      );
      proposedArea = shadowAreaM2(propShadows, sun);
    }

    rows.push({ label, existingArea, proposedArea, newArea: proposedArea });
  }
  return rows;
}

export function ReportButton({ building, buildings, wind, proposedBuilding, posPolygon }) {
  const download = () => {
    const analyses = {
      solar: scoreRoofZones(building, buildings),
      ventilation: assessVentilation(building, wind?.direction ?? 0),
      glazing: assessGlazing(building),
      wind: wind ? { direction: wind.direction, speed: wind.speed } : null,
      buildings,
      shadowComparison: proposedBuilding
        ? computeShadowComparison(buildings, proposedBuilding)
        : null,
      hasProposed: !!proposedBuilding,
      proposedBuilding,
      posFeature: posPolygon ?? null,
    };
    generatePdf(building, analyses);
  };

  return (
    <Button variant="primary" className="w-full" onClick={download}>
      ↓ Download report
    </Button>
  );
}
