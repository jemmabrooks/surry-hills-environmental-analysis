import { Button } from '../ui/Button';
import { generatePdf } from '../../lib/report';
import { scoreRoofZones } from '../../lib/solar';
import { assessVentilation } from '../../lib/ventilation';
import { assessGlazing } from '../../lib/glazing';

export function ReportButton({ building, buildings, wind }) {
  const download = () => {
    const analyses = {
      solar: scoreRoofZones(building, buildings),
      ventilation: assessVentilation(building, wind?.direction ?? 0),
      glazing: assessGlazing(building),
      wind: wind ? { direction: wind.direction, speed: wind.speed } : null,
    };
    generatePdf(building, analyses);
  };

  return (
    <Button variant="primary" className="w-full" onClick={download}>
      ↓ Download report
    </Button>
  );
}
