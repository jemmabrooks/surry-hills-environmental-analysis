import { useMemo, useCallback } from 'react';
import { Source, Layer, Marker } from 'react-map-gl/maplibre';
import { getSunPosition, sydneyDate } from '../../lib/sun';

const RADIUS_M = 160;
const STEP_H   = 0.08; // arc resolution in hours

// Sydney solstices
const SUMMER = { month: 11, day: 21, color: '#dc2626', label: 'Summer solstice' };
const WINTER = { month:  5, day: 21, color: '#1d4ed8', label: 'Winter solstice' };
const ARCS   = [SUMMER, WINTER];

// Time-of-day tick marks to show on each arc
const TICK_HOURS = [
  { h: 9,  label: '9 am' },
  { h: 12, label: 'Noon' },
  { h: 15, label: '3 pm' },
];

function mToDeg(m, lat) {
  return {
    dLng: m / (111000 * Math.cos((lat * Math.PI) / 180)),
    dLat: m / 111000,
  };
}

function sunToGeo(cx, cy, azDeg, altDeg) {
  if (altDeg < 0.3) return null;
  const r = RADIUS_M * (1 - altDeg / 90);
  const azRad = (azDeg * Math.PI) / 180;
  const { dLng, dLat } = mToDeg(r, cy);
  return [cx + dLng * Math.sin(azRad), cy + dLat * Math.cos(azRad)];
}

function arcForDate(cx, cy, year, month, day) {
  const pts = [];
  for (let h = 4; h <= 21; h += STEP_H) {
    const pos = getSunPosition(sydneyDate(year, month, day, h));
    const pt = sunToGeo(cx, cy, pos.azimuth, pos.altitude);
    if (pt) pts.push(pt);
  }
  return pts;
}

function horizonRing(cx, cy) {
  const pts = [];
  for (let a = 0; a <= 361; a += 3) {
    const azRad = (a * Math.PI) / 180;
    const { dLng, dLat } = mToDeg(RADIUS_M, cy);
    pts.push([cx + dLng * Math.sin(azRad), cy + dLat * Math.cos(azRad)]);
  }
  return pts;
}

function cardinalPt(cx, cy, bearingDeg, r) {
  const azRad = (bearingDeg * Math.PI) / 180;
  const { dLng, dLat } = mToDeg(r, cy);
  return [cx + dLng * Math.sin(azRad), cy + dLat * Math.cos(azRad)];
}

// Which arc the dot lives on — summer if Dec/Jan/Feb, winter if Jun/Jul/Aug, else nearest
function activeArc(month) {
  // Southern hemisphere: summer = Nov–Feb, winter = May–Aug
  if ([10, 11, 0, 1, 2].includes(month)) return SUMMER;
  return WINTER;
}

export function SunPath2DLayer({ year, month, day, hour, setHour, center }) {
  const [cx, cy] = center;
  const arc = activeArc(month);

  const geojson = useMemo(() => {
    const features = [];

    // Horizon ring
    features.push({
      type: 'Feature',
      properties: { color: '#94a3b8', w: 0.8 },
      geometry: { type: 'LineString', coordinates: horizonRing(cx, cy) },
    });

    // Cardinal spokes
    for (const b of [0, 90, 180, 270]) {
      features.push({
        type: 'Feature',
        properties: { color: '#cbd5e1', w: 0.5 },
        geometry: {
          type: 'LineString',
          coordinates: [cardinalPt(cx, cy, b, 2), cardinalPt(cx, cy, b, RADIUS_M + 10)],
        },
      });
    }

    // Two solstice arcs
    for (const a of ARCS) {
      const pts = arcForDate(cx, cy, year, a.month, a.day);
      if (pts.length >= 2) {
        features.push({
          type: 'Feature',
          properties: { color: a.color, w: 1.8 },
          geometry: { type: 'LineString', coordinates: pts },
        });
      }
    }

    // Tick marks at 9am / noon / 3pm on each arc
    for (const a of ARCS) {
      for (const tick of TICK_HOURS) {
        const pos = getSunPosition(sydneyDate(year, a.month, a.day, tick.h));
        const pt = sunToGeo(cx, cy, pos.azimuth, pos.altitude);
        if (!pt) continue;
        // Small cross / circle via a point feature
        features.push({
          type: 'Feature',
          properties: { color: a.color },
          geometry: { type: 'Point', coordinates: pt },
        });
      }
    }

    return { type: 'FeatureCollection', features };
  }, [cx, cy, year]);

  // Tick label Markers
  const tickMarkers = useMemo(() => {
    const markers = [];
    for (const a of ARCS) {
      for (const tick of TICK_HOURS) {
        const pos = getSunPosition(sydneyDate(year, a.month, a.day, tick.h));
        const pt = sunToGeo(cx, cy, pos.azimuth, pos.altitude);
        if (!pt) continue;
        // Offset label above the dot — toward centre of diagram
        const offsetDir = tick.h === 12 ? 0 : tick.h < 12 ? 1 : -1; // noon above, am right, pm left
        markers.push({ key: `${a.label}-${tick.h}`, pt, label: tick.label, color: a.color, h: tick.h });
      }
    }
    return markers;
  }, [cx, cy, year]);

  // Active sun dot position
  const sunPos = useMemo(() => {
    const pos = getSunPosition(sydneyDate(year, arc.month, arc.day, hour));
    return sunToGeo(cx, cy, pos.azimuth, pos.altitude);
  }, [cx, cy, year, arc, hour]);

  // Drag: snap to nearest time on either arc
  const handleDragEnd = useCallback((evt) => {
    const { lng, lat } = evt.lngLat;
    let bestH = hour;
    let bestD = Infinity;
    // Try both arcs, pick closest point overall
    for (const a of ARCS) {
      for (let h = 4; h <= 21; h += 1 / 12) {
        const pos = getSunPosition(sydneyDate(year, a.month, a.day, h));
        const pt = sunToGeo(cx, cy, pos.azimuth, pos.altitude);
        if (!pt) continue;
        const dist = (pt[0] - lng) ** 2 + (pt[1] - lat) ** 2;
        if (dist < bestD) { bestD = dist; bestH = h; }
      }
    }
    setHour(Math.round(bestH * 2) / 2);
  }, [cx, cy, year, hour, setHour]);

  const cardinals = useMemo(() => [
    { label: 'N', pt: cardinalPt(cx, cy, 0,   RADIUS_M + 22) },
    { label: 'E', pt: cardinalPt(cx, cy, 90,  RADIUS_M + 22) },
    { label: 'S', pt: cardinalPt(cx, cy, 180, RADIUS_M + 22) },
    { label: 'W', pt: cardinalPt(cx, cy, 270, RADIUS_M + 22) },
  ], [cx, cy]);

  return (
    <>
      <Source id="sun-path-2d" type="geojson" data={geojson}>
        <Layer
          id="sun-path-2d-lines"
          type="line"
          filter={['==', '$type', 'LineString']}
          paint={{
            'line-color': ['get', 'color'],
            'line-width': ['get', 'w'],
            'line-opacity': 0.9,
          }}
        />
        <Layer
          id="sun-path-2d-ticks"
          type="circle"
          filter={['==', '$type', 'Point']}
          paint={{
            'circle-radius': 4,
            'circle-color': ['get', 'color'],
            'circle-stroke-color': '#fff',
            'circle-stroke-width': 1.5,
          }}
        />
      </Source>

      {/* Cardinal labels */}
      {cardinals.map(({ label, pt }) => (
        <Marker key={label} longitude={pt[0]} latitude={pt[1]} anchor="center">
          <span style={{
            fontFamily: 'Inter, sans-serif', fontSize: 11, fontWeight: 700,
            color: '#475569', pointerEvents: 'none', userSelect: 'none',
          }}>{label}</span>
        </Marker>
      ))}

      {/* Time-of-day labels */}
      {tickMarkers.map(({ key, pt, label, color, h }) => (
        <Marker key={key} longitude={pt[0]} latitude={pt[1]} anchor="bottom">
          <div style={{
            fontFamily: 'Inter, sans-serif', fontSize: 9, fontWeight: 600,
            color, whiteSpace: 'nowrap', pointerEvents: 'none',
            textShadow: '0 0 3px white, 0 0 3px white',
            marginBottom: 6,
          }}>{label}</div>
        </Marker>
      ))}

      {/* Draggable sun dot on the active arc */}
      {sunPos && (
        <Marker
          longitude={sunPos[0]}
          latitude={sunPos[1]}
          anchor="center"
          draggable
          onDragEnd={handleDragEnd}
        >
          <div style={{
            width: 18, height: 18, borderRadius: '50%',
            background: arc.color,
            border: '2.5px solid white',
            boxShadow: '0 1px 5px rgba(0,0,0,0.4)',
            cursor: 'grab',
          }} />
        </Marker>
      )}
    </>
  );
}
