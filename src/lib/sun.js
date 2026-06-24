// Sun position via SunCalc (ADR-002) — pure client-side maths, no API.
import * as SunCalc from 'suncalc';
import { SYDNEY } from '../constants';

// Build a Date in Sydney local time for the given year/month(0-11)/day/hour(float).
export function sydneyDate(year, month, day, hourFloat) {
  const h = Math.floor(hourFloat);
  const m = Math.round((hourFloat - h) * 60);
  // Construct as local browser time; SunCalc only needs a Date + coords.
  // For studio-grade accuracy this treats the browser clock as Sydney time.
  return new Date(year, month, day, h, m, 0);
}

// Returns { azimuth, altitude } in degrees.
// This suncalc build already returns compass-bearing degrees:
// azimuth 0 = north, 90 = east, 180 = south, 270 = west; altitude above horizon.
export function getSunPosition(date, lat = SYDNEY.lat, lng = SYDNEY.lng) {
  const pos = SunCalc.getPosition(date, lat, lng);
  return {
    azimuth: ((pos.azimuth % 360) + 360) % 360,
    altitude: pos.altitude,
  };
}

// Sunrise / sunset hours (local) for the date, used by TimeControls bounds.
export function getSunTimes(date, lat = SYDNEY.lat, lng = SYDNEY.lng) {
  const t = SunCalc.getTimes(date, lat, lng);
  const toHour = (d) => d.getHours() + d.getMinutes() / 60;
  return { sunrise: toHour(t.sunrise), sunset: toHour(t.sunset) };
}
