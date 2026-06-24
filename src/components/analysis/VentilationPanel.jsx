import { useMemo } from 'react';
import { ColorBlock } from '../ui/Card';
import { assessVentilation } from '../../lib/ventilation';
import { assessPedestrianComfort, cornerSpeedMph } from '../../lib/windFlow';
import { WindRose } from './WindRose';

const ROLE_LABEL = { inlet: 'Inlet (windward)', outlet: 'Outlet (leeward)', neutral: 'Neutral' };

export function VentilationPanel({ building, wind, windRose }) {
  const result = useMemo(
    () => assessVentilation(building, wind?.direction ?? 0),
    [building, wind?.direction],
  );

  const comfort = useMemo(
    () => assessPedestrianComfort(result.faces, wind?.direction ?? 0, wind?.speed ?? 0),
    [result.faces, wind?.direction, wind?.speed],
  );

  const cornerSpd = wind?.speed ? cornerSpeedMph(wind.speed) : null;

  return (
    <div className="space-y-md">
      {/* Wind rose */}
      {windRose && (
        <ColorBlock color="navy">
          <h4 className="type-headline mb-sm" style={{ color: '#e2e8f0' }}>Monthly wind rose</h4>
          <WindRose rose={windRose} />
        </ColorBlock>
      )}

      {/* Cross ventilation */}
      <ColorBlock color="mint">
        <h4 className="type-headline mb-xs">Cross ventilation</h4>
        <p className="type-body-sm mb-sm">{result.summary}</p>
        <ul className="space-y-xxs">
          {result.faces.map((f) => (
            <li key={f.cardinal} className="flex items-center justify-between type-body-sm">
              <span>{f.cardinal} face — {ROLE_LABEL[f.role]}</span>
              <span className="text-ink/60">WWR {f.ratio}</span>
            </li>
          ))}
        </ul>
      </ColorBlock>

      {/* Pedestrian comfort */}
      {comfort.length > 0 && wind?.speed > 0 && (
        <ColorBlock color="cream">
          <h4 className="type-headline mb-xxs">Pedestrian comfort</h4>
          <p className="type-caption text-ink/50 mb-sm leading-snug">
            Lawson criteria — estimated mean wind speed at 1.5 m. Based on monthly average;
            peak gusts will exceed these values.
          </p>
          <ul className="space-y-xs">
            {comfort.map((f) => (
              <li key={f.cardinal} className="flex items-center justify-between type-body-sm">
                <span>{f.cardinal} face</span>
                <span className="flex items-center gap-xs">
                  <span className="type-body-sm text-ink/60">{f.speedMph} mph</span>
                  <span
                    className="rounded-pill px-xs py-xxs type-caption font-medium"
                    style={{ background: f.comfort.color, color: '#fff' }}
                  >
                    {f.comfort.grade} · {f.comfort.label}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          {cornerSpd !== null && (
            <p className="mt-sm type-caption text-ink/60 leading-snug">
              Corner acceleration est. {cornerSpd} mph — check for downdraught risk if building
              exceeds 4 storeys.
            </p>
          )}
        </ColorBlock>
      )}
    </div>
  );
}
