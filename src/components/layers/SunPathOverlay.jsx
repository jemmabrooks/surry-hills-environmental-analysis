// Interactive 3D sun path diagram — perspective view with elliptical ground plane.
// When a building is selected it renders as a map-anchored Marker surrounding that building.
// When no building is selected it floats centred on screen.
import { useMemo, useRef, useState, useCallback, useEffect, memo } from 'react';
import { Marker } from 'react-map-gl/maplibre';
import { getSunPosition, sydneyDate } from '../../lib/sun';
import { centroidOf } from '../../lib/geometry';

// ── SVG canvas + projection constants ────────────────────────────────────────
const VW = 500;
const VH = 480;
const CX = VW / 2;        // centre x
const CY = VH * 0.55;    // centre y — slightly below mid so arcs have room above
const R  = 160;           // horizon circle radius (px in viewBox units)
const DEPTH = 0.38;       // north-south foreshortening (perspective compression)
const VERT  = 0.90;       // vertical height scale for arcs

// Sydney solstices (month 0-indexed)
const SUMMER = { month: 11, day: 21 }; // Dec 21
const WINTER = { month: 5,  day: 21 }; // Jun 21

// ── 3D → 2D projection ───────────────────────────────────────────────────────
function project(azDeg, altDeg) {
  const az  = azDeg  * Math.PI / 180;
  const alt = altDeg * Math.PI / 180;
  const cosAlt = Math.cos(alt);
  const sx = CX + cosAlt * Math.sin(az) * R;
  const sy = CY - cosAlt * Math.cos(az) * DEPTH * R - Math.sin(alt) * VERT * R;
  return [sx, sy];
}

// ── Ellipse ground ring ───────────────────────────────────────────────────────
function buildEllipsePath() {
  const pts = Array.from({ length: 65 }, (_, i) => project((i / 64) * 360, 0));
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ') + ' Z';
}
const ELLIPSE_PATH = buildEllipsePath();

// ── Arc point computation ─────────────────────────────────────────────────────
function buildArc(year, month, day) {
  const pts = [];
  for (let h = 4; h <= 20.5; h += 0.5) {
    const pos = getSunPosition(sydneyDate(year, month, day, h));
    if (pos.altitude > 0.2) {
      const [sx, sy] = project(pos.azimuth, pos.altitude);
      pts.push({ h, sx, sy, az: pos.azimuth, alt: pos.altitude });
    }
  }
  return pts;
}

function arcPath(pts) {
  if (pts.length < 2) return '';
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.sx.toFixed(1)} ${p.sy.toFixed(1)}`).join(' ');
}

function peakOf(pts) {
  return pts.reduce((best, p) => (p.sy < best.sy ? p : best), pts[0] ?? { sx: CX, sy: CY });
}

const CARDINALS = [
  { label: 'N', az: 0,   offset: [0,   -14] },
  { label: 'E', az: 90,  offset: [14,    0] },
  { label: 'S', az: 180, offset: [0,    14] },
  { label: 'W', az: 270, offset: [-14,   0] },
];

// ── SVG content (shared between both render modes) ────────────────────────────
const SunPathSVG = memo(function SunPathSVG({
  svgRef, dragging, onMouseDown, onTouchStart, onTouchMove, onTouchEnd,
  winterPts, summerPts, currentPts, winterPeak, summerPeak, sunXY, sunPos,
}) {
  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${VW} ${VH}`}
      style={{ width: '100%', height: 'auto', pointerEvents: 'none', overflow: 'visible' }}
    >
      {/* Ground ellipse */}
      <path d={ELLIPSE_PATH} fill="rgba(255,255,255,0.07)" stroke="rgba(255,255,255,0.70)" strokeWidth="2" />

      {/* Cross-hair axis lines */}
      {[0, 90].map((az) => {
        const [ax, ay] = project(az, 0);
        const [bx, by] = project(az + 180, 0);
        return <line key={az} x1={ax} y1={ay} x2={bx} y2={by}
          stroke="rgba(255,255,255,0.25)" strokeWidth="1" strokeDasharray="5 5" />;
      })}

      {/* Winter solstice arc — blue */}
      <path d={arcPath(winterPts)} fill="none" stroke="#93c5fd" strokeWidth="3" strokeDasharray="8 5" strokeLinecap="round" />
      {winterPts.length > 0 && (
        <>
          <circle cx={winterPts[0].sx} cy={winterPts[0].sy} r={5} fill="#93c5fd" stroke="white" strokeWidth="1.5" />
          <circle cx={winterPts[winterPts.length-1].sx} cy={winterPts[winterPts.length-1].sy} r={5} fill="#93c5fd" stroke="white" strokeWidth="1.5" />
        </>
      )}

      {/* Summer solstice arc — amber */}
      <path d={arcPath(summerPts)} fill="none" stroke="#fb923c" strokeWidth="3" strokeDasharray="8 5" strokeLinecap="round" />
      {summerPts.length > 0 && (
        <>
          <circle cx={summerPts[0].sx} cy={summerPts[0].sy} r={5} fill="#fb923c" stroke="white" strokeWidth="1.5" />
          <circle cx={summerPts[summerPts.length-1].sx} cy={summerPts[summerPts.length-1].sy} r={5} fill="#fb923c" stroke="white" strokeWidth="1.5" />
        </>
      )}

      {/* Current day arc */}
      <path d={arcPath(currentPts)} fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" />
      {currentPts.length > 0 && (
        <>
          <circle cx={currentPts[0].sx} cy={currentPts[0].sy} r={6} fill="#fde68a" stroke="white" strokeWidth="1.5" />
          <circle cx={currentPts[currentPts.length-1].sx} cy={currentPts[currentPts.length-1].sy} r={6} fill="#fcd34d" stroke="white" strokeWidth="1.5" />
        </>
      )}

      {/* Sun dot — only interactive element; drag it along the arc to change time */}
      {sunXY && (
        <g
          style={{ pointerEvents: 'all', cursor: dragging ? 'grabbing' : 'grab' }}
          onMouseDown={onMouseDown}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <circle cx={sunXY[0]} cy={sunXY[1]} r={22} fill="rgba(251,191,36,0.08)" />
          <circle cx={sunXY[0]} cy={sunXY[1]} r={10} fill="rgba(251,191,36,0.30)" />
          <circle cx={sunXY[0]} cy={sunXY[1]} r={7}  fill="#fbbf24" stroke="white" strokeWidth="2" />
          {[0,45,90,135,180,225,270,315].map((a) => {
            const rad = a * Math.PI / 180;
            return <line key={a}
              x1={sunXY[0] + 9  * Math.cos(rad)} y1={sunXY[1] + 9  * Math.sin(rad)}
              x2={sunXY[0] + 13 * Math.cos(rad)} y2={sunXY[1] + 13 * Math.sin(rad)}
              stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round" />;
          })}
        </g>
      )}

      {/* Cardinal labels */}
      {CARDINALS.map(({ label, az, offset }) => {
        const [px, py] = project(az, 0);
        return (
          <g key={label}>
            <text x={px + offset[0]} y={py + offset[1]}
              textAnchor="middle" dominantBaseline="middle"
              fontSize="17" fontWeight="800" fontFamily="Inter,system-ui,sans-serif"
              stroke="rgba(0,0,0,0.55)" strokeWidth="4" paintOrder="stroke">{label}</text>
            <text x={px + offset[0]} y={py + offset[1]}
              textAnchor="middle" dominantBaseline="middle"
              fontSize="17" fontWeight="800" fontFamily="Inter,system-ui,sans-serif"
              fill="white">{label}</text>
          </g>
        );
      })}

      {/* Solstice peak labels */}
      {winterPts.length > 0 && (
        <text x={winterPeak.sx} y={winterPeak.sy - 12}
          textAnchor="middle" fontSize="12" fontWeight="700" fontFamily="Inter,system-ui,sans-serif"
          stroke="rgba(0,0,0,0.5)" strokeWidth="3" paintOrder="stroke" fill="#93c5fd">
          June 21
        </text>
      )}
      {summerPts.length > 0 && (
        <text x={summerPeak.sx} y={summerPeak.sy - 12}
          textAnchor="middle" fontSize="12" fontWeight="700" fontFamily="Inter,system-ui,sans-serif"
          stroke="rgba(0,0,0,0.5)" strokeWidth="3" paintOrder="stroke" fill="#fdba74">
          Dec 21
        </text>
      )}

      {/* Legend */}
      <g transform={`translate(${CX}, ${CY + R * DEPTH + 22})`}>
        <rect x={-90} y={-5} width={18} height={3} rx="1.5" fill="#60a5fa" />
        <text x={-68} y={0} dominantBaseline="middle" fontSize="9"
          fontFamily="Inter,system-ui,sans-serif" fill="rgba(255,255,255,0.7)">Winter solstice</text>
        <rect x={12} y={-5} width={18} height={3} rx="1.5" fill="#fb923c" />
        <text x={34} y={0} dominantBaseline="middle" fontSize="9"
          fontFamily="Inter,system-ui,sans-serif" fill="rgba(255,255,255,0.7)">Summer solstice</text>
      </g>

      {/* Altitude / azimuth readout */}
      {sunXY && (
        <text x={CX} y={CY + R * DEPTH + 38}
          textAnchor="middle" fontSize="9" fontFamily="Inter,system-ui,sans-serif"
          fill="rgba(255,255,255,0.5)">
          {`alt ${Math.round(sunPos.altitude)}°  ·  az ${Math.round(sunPos.azimuth)}°`}
        </text>
      )}
    </svg>
  );
});

// ── Main component ────────────────────────────────────────────────────────────
export const SunPathOverlay = memo(function SunPathOverlay({ year, month, day, hour, setHour, building }) {
  const svgRef    = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [localHour, setLocalHour] = useState(null);
  const displayHour = localHour ?? hour;

  const summerPts  = useMemo(() => buildArc(year, SUMMER.month, SUMMER.day), [year]);
  const winterPts  = useMemo(() => buildArc(year, WINTER.month, WINTER.day), [year]);
  const currentPts = useMemo(() => buildArc(year, month, day), [year, month, day]);
  const summerPeak = useMemo(() => peakOf(summerPts), [summerPts]);
  const winterPeak = useMemo(() => peakOf(winterPts), [winterPts]);

  const sunPos = useMemo(
    () => getSunPosition(sydneyDate(year, month, day, displayHour)),
    [year, month, day, displayHour],
  );
  const sunXY = sunPos.altitude > 0 ? project(sunPos.azimuth, sunPos.altitude) : null;

  const nearestHour = useCallback((clientX, clientY) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || !currentPts.length) return null;
    const scaleX = VW / rect.width;
    const scaleY = VH / rect.height;
    const vx = (clientX - rect.left) * scaleX;
    const vy = (clientY - rect.top)  * scaleY;
    let best = null, bestD = Infinity;
    for (const p of currentPts) {
      const d = (p.sx - vx) ** 2 + (p.sy - vy) ** 2;
      if (d < bestD) { bestD = d; best = p.h; }
    }
    return bestD < 80 * 80 ? best : null;
  }, [currentPts]);

  const onMouseDown = useCallback((e) => {
    const h = nearestHour(e.clientX, e.clientY);
    if (h == null) return; // not near arc — let click pass through to map
    e.stopPropagation();
    e.preventDefault();
    setDragging(true);
    setLocalHour(Math.round(h * 4) / 4);
  }, [nearestHour]);

  const onMouseMove = useCallback((e) => {
    if (!dragging) return;
    const h = nearestHour(e.clientX, e.clientY);
    if (h != null) setLocalHour(Math.round(h * 4) / 4);
  }, [dragging, nearestHour]);

  const onMouseUp = useCallback(() => {
    if (localHour != null) setHour(localHour);
    setDragging(false);
    setLocalHour(null);
  }, [localHour, setHour]);

  useEffect(() => {
    if (!dragging) return;
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup',   onMouseUp);
    return () => { window.removeEventListener('mousemove', onMouseMove); window.removeEventListener('mouseup', onMouseUp); };
  }, [dragging, onMouseMove, onMouseUp]);

  const onTouchStart = useCallback((e) => {
    e.stopPropagation();
    const t = e.touches[0];
    const h = nearestHour(t.clientX, t.clientY);
    if (h != null) { setDragging(true); setLocalHour(Math.round(h * 4) / 4); }
  }, [nearestHour]);
  const onTouchMove = useCallback((e) => {
    e.preventDefault();
    const t = e.touches[0];
    const h = nearestHour(t.clientX, t.clientY);
    if (h != null) setLocalHour(Math.round(h * 4) / 4);
  }, [nearestHour]);
  const onTouchEnd = useCallback(() => {
    if (localHour != null) setHour(localHour);
    setDragging(false); setLocalHour(null);
  }, [localHour, setHour]);

  const svgProps = {
    svgRef, dragging, onMouseDown, onTouchStart, onTouchMove, onTouchEnd,
    winterPts, summerPts, currentPts, winterPeak, summerPeak, sunXY, sunPos,
  };

  // ── Building-anchored mode: Marker centred on building centroid ───────────
  if (building) {
    const [lng, lat] = centroidOf(building);
    return (
      <Marker longitude={lng} latitude={lat} anchor="center" style={{ zIndex: 25 }}>
        {/* Shift up so the ground ellipse centre (CY = 55% from top) lands on the geo point */}
        <div style={{ width: 'min(52vw, 560px)', transform: 'translateY(-5%)', pointerEvents: 'auto' }}>
          <SunPathSVG {...svgProps} />
        </div>
      </Marker>
    );
  }

  // ── Free-floating mode: centred on screen when no building selected ────────
  return (
    <div style={{
      position:  'absolute',
      top:       '50%',
      left:      'calc((100vw - max(25vw, 320px)) / 2)',
      transform: 'translate(-50%, -50%)',
      width:     'min(56vw, 640px)',
      zIndex:    25,
      pointerEvents: 'none',
    }}>
      <SunPathSVG {...svgProps} />
    </div>
  );
});
