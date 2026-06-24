// Monthly average wind profiles + 16-direction wind rose for Sydney (Open-Meteo archive).
import { SYDNEY } from '../constants';

const CACHE_KEY = 'surry-hills-wind-v2';
const N_BINS = 16;
const BIN_DEG = 360 / N_BINS; // 22.5° per bin

// Returns { monthly: [{direction,speed}×12], windRose: [[{dir,freq,speed}×16]×12] }
export async function fetchMonthlyWind({ year = 2025 } = {}) {
  const cached = readCache();
  if (cached) return cached;

  const url =
    `https://archive-api.open-meteo.com/v1/archive?latitude=${SYDNEY.lat}` +
    `&longitude=${SYDNEY.lng}&start_date=${year}-01-01&end_date=${year}-12-31` +
    `&hourly=wind_speed_10m,wind_direction_10m&timezone=Australia%2FSydney`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
  const json = await res.json();
  const result = {
    monthly: reduceMonthly(json.hourly),
    windRose: reduceWindRose(json.hourly),
  };
  writeCache(result);
  return result;
}

// Speed-weighted vector mean per month → [{direction, speed}]
function reduceMonthly(hourly) {
  const { time, wind_speed_10m: speeds, wind_direction_10m: dirs } = hourly;
  const acc = Array.from({ length: 12 }, () => ({ sx: 0, sy: 0, speed: 0, n: 0 }));
  for (let i = 0; i < time.length; i++) {
    const speed = speeds[i];
    const dir = dirs[i];
    if (speed == null || dir == null) continue;
    const rad = (dir * Math.PI) / 180;
    const b = acc[new Date(time[i]).getMonth()];
    b.sx += Math.sin(rad) * speed;
    b.sy += Math.cos(rad) * speed;
    b.speed += speed;
    b.n++;
  }
  return acc.map((b) => {
    if (!b.n) return { direction: 0, speed: 0 };
    return {
      direction: ((Math.atan2(b.sx, b.sy) * 180) / Math.PI + 360) % 360,
      speed: b.speed / b.n,
    };
  });
}

// 16-bin directional frequency/speed per month → [[{dir,freq,speed}×16]×12]
function reduceWindRose(hourly) {
  const { time, wind_speed_10m: speeds, wind_direction_10m: dirs } = hourly;
  // [month][bin] → { count, totalSpeed }
  const rose = Array.from({ length: 12 }, () =>
    Array.from({ length: N_BINS }, () => ({ count: 0, totalSpeed: 0 })),
  );
  const monthCounts = Array(12).fill(0);

  for (let i = 0; i < time.length; i++) {
    const speed = speeds[i];
    const dir = dirs[i];
    if (speed == null || dir == null) continue;
    const month = new Date(time[i]).getMonth();
    monthCounts[month]++;
    const bin = Math.round(dir / BIN_DEG) % N_BINS;
    rose[month][bin].count++;
    rose[month][bin].totalSpeed += speed;
  }

  return rose.map((bins, m) => {
    const total = monthCounts[m] || 1;
    return bins.map((b, idx) => ({
      dir: idx * BIN_DEG,
      freq: b.count / total,
      speed: b.count > 0 ? b.totalSpeed / b.count : 0,
    }));
  });
}

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      // Validate it has the v2 shape
      if (data?.monthly && data?.windRose) return data;
    }
  } catch { /* ignore */ }
  return null;
}

function writeCache(data) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch { /* ignore */ }
}
