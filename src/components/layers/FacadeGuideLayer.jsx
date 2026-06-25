import { Marker } from 'react-map-gl/maplibre';
import { buildFacadeGuide } from '../../lib/facadeGuide';

const VENT_COLOR = { inlet: '#1ea64a', outlet: '#2d7dd2', neutral: '#9aa0a6' };
const RISK_BG = {
  '#1ea64a': '#f0fdf4', '#f3c01b': '#fefce8',
  '#e4572e': '#fff1ee', '#9aa0a6': '#f5f5f5',
};
const RISK_BORDER = {
  '#1ea64a': '#bbf7d0', '#f3c01b': '#fde68a',
  '#e4572e': '#fecaca', '#9aa0a6': '#d4d4d4',
};

function offsetPoint([lng, lat], bearingDeg, distM) {
  const R = 6371000;
  const d = distM / R;
  const b = (bearingDeg * Math.PI) / 180;
  const φ1 = (lat * Math.PI) / 180;
  const λ1 = (lng * Math.PI) / 180;
  const φ2 = Math.asin(Math.sin(φ1) * Math.cos(d) + Math.cos(φ1) * Math.sin(d) * Math.cos(b));
  const λ2 = λ1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(φ1), Math.cos(d) - Math.sin(φ1) * Math.sin(φ2));
  return [(λ2 * 180) / Math.PI, (φ2 * 180) / Math.PI];
}

export function FacadeGuideLayer({ building, wind, buildings }) {
  if (!building) return null;
  const windDir = wind?.direction ?? 0;
  const faces = buildFacadeGuide(building, windDir, buildings);

  return faces.map(f => {
    const [lng, lat] = offsetPoint(f.midpoint, f.bearing, 22);
    const bg = RISK_BG[f.color] ?? '#f9f9f9';
    const border = RISK_BORDER[f.color] ?? '#e0e0e0';

    return (
      <Marker key={f.cardinal} longitude={lng} latitude={lat} anchor="center">
        <div style={{
          background: bg,
          border: `1.5px solid ${border}`,
          borderRadius: 8,
          padding: '6px 8px',
          minWidth: f.isPartyWall ? 140 : 160,
          maxWidth: 200,
          boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
          pointerEvents: 'none',
          fontSize: 8,
          lineHeight: 1.3,
          fontFamily: 'Inter, sans-serif',
        }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginBottom: 3 }}>
            <span style={{
              background: f.color,
              color: '#fff',
              borderRadius: 3,
              padding: '0px 4px',
              fontWeight: 700,
              fontSize: 8,
              letterSpacing: '0.04em',
            }}>{f.cardinal}</span>
            <span style={{ color: '#888', fontSize: 7 }}>{Math.round(f.bearing)}°</span>
            {f.isPartyWall && (
              <span style={{ color: '#9aa0a6', fontSize: 7, marginLeft: 2, fontStyle: 'italic' }}>party wall</span>
            )}
          </div>

          {f.isPartyWall ? (
            <div style={{ color: '#666', fontSize: 7, fontStyle: 'italic' }}>
              Shared wall — no openings permitted
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 3, marginBottom: 1 }}>
                <span style={{ color: '#aaa', fontSize: 7, minWidth: 10 }}>W</span>
                <span style={{ color: '#333', fontSize: 7 }}>{f.windows}</span>
              </div>
              <div style={{ display: 'flex', gap: 3, marginBottom: 1 }}>
                <span style={{ color: '#aaa', fontSize: 7, minWidth: 10 }}>S</span>
                <span style={{ color: '#333', fontSize: 7 }}>{f.shading}</span>
              </div>
              <div style={{ display: 'flex', gap: 3 }}>
                <span style={{ color: '#aaa', fontSize: 7, minWidth: 10 }}>V</span>
                <span style={{
                  color: VENT_COLOR[f.vent.label.includes('inlet') ? 'inlet' : f.vent.label.includes('outlet') ? 'outlet' : 'neutral'],
                  fontSize: 7,
                  fontWeight: 600,
                }}>{f.vent.label}</span>
              </div>
            </>
          )}
        </div>
      </Marker>
    );
  });
}
