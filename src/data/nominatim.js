// Address search via OSM Nominatim (free geocoder, no key).
import { SURRY_HILLS } from '../constants';

// Bias and bound results to the Surry Hills area.
export async function geocode(query) {
  if (!query || !query.trim()) return [];
  const { lat, lng } = SURRY_HILLS.overpass;
  const d = 0.02; // ~2km viewbox
  const url =
    `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5` +
    `&q=${encodeURIComponent(query + ', Surry Hills, Sydney')}` +
    `&viewbox=${lng - d},${lat - d},${lng + d},${lat + d}&bounded=1`;

  const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
  if (!res.ok) throw new Error(`Nominatim ${res.status}`);
  const json = await res.json();
  return json.map((r) => ({
    label: r.display_name,
    lng: parseFloat(r.lon),
    lat: parseFloat(r.lat),
  }));
}
