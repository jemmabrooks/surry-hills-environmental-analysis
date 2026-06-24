import { Eyebrow } from '../ui/Card';
import { MONTHS } from '../../constants';
import { getSunPosition, sydneyDate, getSunTimes } from '../../lib/sun';

// Date (month/year) + sun-arc time-of-day slider.
export function TimeControls({ year, month, day, hour, setYear, setMonth, setHour }) {
  const date = sydneyDate(year, month, day, hour);
  const sun = getSunPosition(date);
  const { sunrise, sunset } = getSunTimes(date);
  const fmtHour = (h) => {
    const hh = Math.floor(h);
    const ampm = hh >= 12 ? 'pm' : 'am';
    const disp = ((hh + 11) % 12) + 1;
    return `${disp}${ampm}`;
  };

  // Sun arc visual: position a dot along a semicircle by time fraction.
  const frac = Math.min(1, Math.max(0, (hour - 5) / (20 - 5)));
  const arcAngle = Math.PI * (1 - frac); // pi → 0
  const cx = 10 + frac * 200;
  const cy = 40 - Math.sin(Math.PI * frac) * 30;

  return (
    <div>
      <Eyebrow className="mb-xs">Time</Eyebrow>

      <div className="mb-sm flex items-center gap-xs">
        <select
          value={month}
          onChange={(e) => setMonth(Number(e.target.value))}
          className="type-body-sm rounded-md border border-hairline bg-canvas px-sm py-xxs"
        >
          {MONTHS.map((m, i) => (
            <option key={m} value={i}>{m}</option>
          ))}
        </select>
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="type-body-sm rounded-md border border-hairline bg-canvas px-sm py-xxs"
        >
          {[2024, 2025, 2026, 2027].map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {/* Sun arc */}
      <svg viewBox="0 0 220 48" className="mb-xxs w-full">
        <path d="M10 40 A 100 32 0 0 1 210 40" fill="none" stroke="#e6e6e6" strokeWidth="1.5" />
        <circle cx={cx} cy={cy} r="6" fill={sun.altitude > 0 ? '#f3c01b' : '#9aa0a6'} />
      </svg>

      <input
        type="range"
        min="5"
        max="20"
        step="0.25"
        value={hour}
        onChange={(e) => setHour(Number(e.target.value))}
        className="w-full accent-black"
      />
      <div className="mt-xxs flex justify-between">
        <span className="type-caption text-ink/60">5am</span>
        <span className="type-body-sm">
          {fmtHour(hour)} · alt {Math.round(sun.altitude)}° · az {Math.round(sun.azimuth)}°
        </span>
        <span className="type-caption text-ink/60">8pm</span>
      </div>
      <div className="mt-xxs type-caption text-ink/50">
        Sunrise {fmtHour(sunrise)} · Sunset {fmtHour(sunset)}
      </div>
    </div>
  );
}
