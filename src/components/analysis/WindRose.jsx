// Polar wind rose: 16-direction frequency + mean-speed chart.
const N_BINS = 16;
const BIN_DEG = 360 / N_BINS;
const CX = 100, CY = 100, RMAX = 80;
const FREQ_RINGS = [0.05, 0.10, 0.15, 0.20];
const CARD_LABELS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

function speedColor(speedKmh) {
  // Calm → gentle → moderate → fresh
  if (speedKmh < 8)  return '#93c5fd'; // blue
  if (speedKmh < 16) return '#34d399'; // teal
  if (speedKmh < 25) return '#fbbf24'; // amber
  return '#f87171';                    // red
}

function polarToXY(angleDeg, r) {
  const rad = ((angleDeg - 90) * Math.PI) / 180; // 0° = north = top
  return [CX + r * Math.cos(rad), CY + r * Math.sin(rad)];
}

export function WindRose({ rose }) {
  if (!rose?.length) return null;

  const maxFreq = Math.max(...rose.map((b) => b.freq), 0.001);
  const scale = (f) => (f / Math.max(maxFreq, 0.25)) * RMAX;

  // Build petal paths (arc sector)
  const petals = rose.map((b) => {
    const r = scale(b.freq);
    if (r < 1) return null;
    const half = BIN_DEG / 2;
    const a1 = b.dir - half;
    const a2 = b.dir + half;
    const [x1, y1] = polarToXY(a1, r);
    const [x2, y2] = polarToXY(a2, r);
    const largeArc = BIN_DEG > 180 ? 1 : 0;
    const d = `M ${CX} ${CY} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
    return { d, color: speedColor(b.speed), dir: b.dir, freq: b.freq, speed: b.speed };
  });

  return (
    <div>
      <svg viewBox="0 0 200 200" className="w-full max-w-[200px] mx-auto block">
        {/* Frequency rings */}
        {FREQ_RINGS.map((f) => {
          const r = scale(f);
          return (
            <circle key={f} cx={CX} cy={CY} r={r} fill="none"
              stroke="var(--color-hairline, #e6e6e6)" strokeWidth="0.5" />
          );
        })}
        {/* Axis lines */}
        {[0, 45, 90, 135].map((deg) => {
          const [x1, y1] = polarToXY(deg, RMAX + 2);
          const [x2, y2] = polarToXY(deg + 180, RMAX + 2);
          return <line key={deg} x1={x1} y1={y1} x2={x2} y2={y2}
            stroke="var(--color-hairline, #e6e6e6)" strokeWidth="0.5" />;
        })}
        {/* Petals */}
        {petals.map((p, i) => p && (
          <path key={i} d={p.d} fill={p.color} opacity="0.85"
            stroke="white" strokeWidth="0.3" />
        ))}
        {/* Cardinal labels */}
        {CARD_LABELS.map((label, i) => {
          const deg = i * 45;
          const [x, y] = polarToXY(deg, RMAX + 12);
          return (
            <text key={label} x={x} y={y} textAnchor="middle" dominantBaseline="middle"
              fontSize="9" fontFamily="Inter, system-ui, sans-serif"
              fill="currentColor" className="text-ink">
              {label}
            </text>
          );
        })}
        {/* Calm centre dot */}
        <circle cx={CX} cy={CY} r={2.5} fill="#94a3b8" />
      </svg>

      {/* Speed legend */}
      <div className="flex items-center justify-center gap-sm mt-xs flex-wrap">
        {[
          { label: '< 8', color: '#93c5fd' },
          { label: '8–16', color: '#34d399' },
          { label: '16–25', color: '#fbbf24' },
          { label: '> 25', color: '#f87171' },
        ].map(({ label, color }) => (
          <span key={label} className="flex items-center gap-xxs type-caption">
            <span style={{ background: color }} className="inline-block h-2 w-4 rounded-xs" />
            {label} km/h
          </span>
        ))}
      </div>

      <p className="type-caption text-ink/50 mt-xs text-center">
        Radius = frequency · colour = mean speed
      </p>
    </div>
  );
}
