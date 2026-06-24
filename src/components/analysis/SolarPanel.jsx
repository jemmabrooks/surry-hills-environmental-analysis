import { useMemo } from 'react';
import { ColorBlock } from '../ui/Card';
import { scoreRoofZones, solarSummary } from '../../lib/solar';

const RATING_LABEL = { best: 'Recommended', ok: 'Acceptable', poor: 'Not recommended' };
const RATING_DOT = { best: '#1ea64a', ok: '#f3c01b', poor: '#e4572e' };

export function SolarPanel({ building, buildings }) {
  const result = useMemo(() => scoreRoofZones(building, buildings), [building, buildings]);

  return (
    <ColorBlock color="lime">
      <h4 className="type-headline mb-xs">Solar panel placement</h4>
      <p className="type-body-sm mb-sm">{solarSummary(result)}</p>
      <ul className="space-y-xxs">
        {result.zones
          .sort((a, b) => b.score - a.score)
          .map((z) => (
            <li key={z.key} className="flex items-center justify-between type-body-sm">
              <span className="flex items-center gap-xs">
                <span
                  className="inline-block h-3 w-3 rounded-full"
                  style={{ background: RATING_DOT[z.rating] }}
                />
                {z.label}-facing
              </span>
              <span className="text-ink/60">{RATING_LABEL[z.rating]}</span>
            </li>
          ))}
      </ul>
    </ColorBlock>
  );
}
