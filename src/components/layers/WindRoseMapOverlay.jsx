import { useState } from 'react';
import { Marker } from 'react-map-gl/maplibre';
import { centroidOf } from '../../lib/geometry';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const N_BINS = 16;
const BIN_DEG = 360 / N_BINS;
const CX = 90, CY = 90, RMAX = 66;

function speedColor(kmh) {
  if (kmh < 8)  return '#93c5fd';
  if (kmh < 16) return '#34d399';
  if (kmh < 25) return '#fbbf24';
  return '#f87171';
}

function polarToXY(angleDeg, r) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return [CX + r * Math.cos(rad), CY + r * Math.sin(rad)];
}

function MiniRose({ rose }) {
  if (!rose?.length) return null;
  const maxFreq = Math.max(...rose.map((b) => b.freq), 0.001);
  const scale = (f) => (f / Math.max(maxFreq, 0.25)) * RMAX;

  const petals = rose.map((b) => {
    const r = scale(b.freq);
    if (r < 1) return null;
    const half = BIN_DEG / 2;
    const [x1, y1] = polarToXY(b.dir - half, r);
    const [x2, y2] = polarToXY(b.dir + half, r);
    const d = `M ${CX} ${CY} L ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2} Z`;
    return { d, color: speedColor(b.speed) };
  });

  return (
    <svg viewBox="0 0 180 180" width="150" height="150">
      {/* Frequency rings */}
      {[0.05, 0.10, 0.20].map((f) => (
        <circle key={f} cx={CX} cy={CY} r={scale(f)}
          fill="none" stroke="rgba(0,0,0,0.12)" strokeWidth="0.6" />
      ))}
      {/* Axes */}
      {[0, 45, 90, 135].map((deg) => {
        const [x1, y1] = polarToXY(deg, RMAX + 2);
        const [x2, y2] = polarToXY(deg + 180, RMAX + 2);
        return <line key={deg} x1={x1} y1={y1} x2={x2} y2={y2}
          stroke="rgba(0,0,0,0.10)" strokeWidth="0.6" />;
      })}
      {/* Petals */}
      {petals.map((p, i) => p && (
        <path key={i} d={p.d} fill={p.color} opacity="0.88"
          stroke="white" strokeWidth="0.4" />
      ))}
      {/* Cardinal labels */}
      {['N','E','S','W'].map((label, i) => {
        const [x, y] = polarToXY(i * 90, RMAX + 12);
        return (
          <text key={label} x={x} y={y} textAnchor="middle" dominantBaseline="middle"
            fontSize="8" fontFamily="Inter,system-ui,sans-serif" fontWeight="600"
            fill="#374151">
            {label}
          </text>
        );
      })}
      <circle cx={CX} cy={CY} r={2.5} fill="#94a3b8" />
    </svg>
  );
}

export function WindRoseMapOverlay({ building, allWindRose, currentMonth }) {
  const [month, setMonth] = useState(currentMonth ?? 0);

  if (!building || !allWindRose?.length) return null;
  const [lng, lat] = centroidOf(building);
  const rose = allWindRose[month];

  return (
    <Marker longitude={lng} latitude={lat} anchor="top" offset={[0, 8]}>
      <div
        style={{
          background: 'rgba(255,255,255,0.94)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(0,0,0,0.10)',
          borderRadius: 12,
          boxShadow: '0 4px 20px rgba(0,0,0,0.14)',
          padding: '10px 12px 8px',
          width: 178,
          userSelect: 'none',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', color: '#6b7280', textTransform: 'uppercase', fontFamily: 'Inter,system-ui,sans-serif' }}>
            Wind rose
          </span>
          <span style={{ fontSize: 9, color: '#9ca3af', fontFamily: 'Inter,system-ui,sans-serif' }}>
            km/h · frequency
          </span>
        </div>

        {/* Wind rose SVG */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <MiniRose rose={rose} />
        </div>

        {/* Speed legend */}
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', margin: '4px 0 6px', flexWrap: 'wrap' }}>
          {[['< 8','#93c5fd'],['8–16','#34d399'],['16–25','#fbbf24'],['>25','#f87171']].map(([label, color]) => (
            <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 8, fontFamily: 'Inter,system-ui,sans-serif', color: '#4b5563' }}>
              <span style={{ width: 14, height: 6, borderRadius: 2, background: color, display: 'inline-block' }} />
              {label}
            </span>
          ))}
        </div>

        {/* Month selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
          <button
            onClick={() => setMonth((m) => (m + 11) % 12)}
            style={{ fontSize: 14, lineHeight: 1, background: 'none', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 4, width: 22, height: 22, cursor: 'pointer', color: '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >‹</button>
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            style={{ flex: 1, fontSize: 10, fontFamily: 'Inter,system-ui,sans-serif', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 4, padding: '2px 4px', background: 'white', color: '#374151', cursor: 'pointer', textAlign: 'center' }}
          >
            {MONTHS.map((m, i) => (
              <option key={m} value={i}>{m}</option>
            ))}
          </select>
          <button
            onClick={() => setMonth((m) => (m + 1) % 12)}
            style={{ fontSize: 14, lineHeight: 1, background: 'none', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 4, width: 22, height: 22, cursor: 'pointer', color: '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >›</button>
        </div>
      </div>
    </Marker>
  );
}
