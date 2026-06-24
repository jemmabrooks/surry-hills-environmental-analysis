import { useMemo } from 'react';
import { ColorBlock } from '../ui/Card';
import { assessGlazing, RISK_COLOR } from '../../lib/glazing';

export function GlazingPanel({ building }) {
  const result = useMemo(() => assessGlazing(building), [building]);

  return (
    <ColorBlock color="cream">
      <h4 className="type-headline mb-sm">Glazing & shading</h4>
      <ul className="space-y-sm">
        {result.faces.map((f) => (
          <li key={f.cardinal}>
            <div className="flex items-center gap-xs">
              <span
                className="inline-block h-3 w-3 rounded-full"
                style={{ background: RISK_COLOR[f.risk] }}
              />
              <span className="type-body-sm font-semibold">
                {f.label} · {f.risk} risk
              </span>
            </div>
            <p className="type-body-sm text-ink/70">{f.text}</p>
          </li>
        ))}
      </ul>
    </ColorBlock>
  );
}
