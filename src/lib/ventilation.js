// Cross ventilation: identify windward (inlet) and leeward (outlet) faces.
import { facadeOrientations } from './geometry';
import { angularDiff, toCardinal } from './geometry';
import { SYDNEY } from '../constants';

// windDirectionFrom: meteorological degrees (direction wind blows FROM).
// Returns { windFrom, faces: [{cardinal, bearing, role, ratio, midpoint}], pairs }.
export function assessVentilation(building, windDirectionFrom) {
  const faces = facadeOrientations(building);
  if (!faces.length) return { windFrom: windDirectionFrom, faces: [], summary: '' };

  // True bearing the wind comes from (apply magnetic declination correction).
  const windFrom = (windDirectionFrom + SYDNEY.magneticDeclination) % 360;
  const windTo = (windFrom + 180) % 360;

  // Collapse many polygon edges into 8 cardinal faces, keeping the longest edge per side.
  const byCardinal = {};
  for (const f of faces) {
    const card = f.cardinal;
    if (!byCardinal[card] || f.length > byCardinal[card].length) byCardinal[card] = f;
  }

  const rated = Object.values(byCardinal).map((f) => {
    const toWind = angularDiff(f.bearing, windFrom); // face pointing into the wind
    let role, ratio;
    if (toWind <= 45) {
      role = 'inlet'; // windward, positive pressure
      ratio = '8–12%';
    } else if (angularDiff(f.bearing, windTo) <= 45) {
      role = 'outlet'; // leeward, negative pressure
      ratio = '10–15%';
    } else {
      role = 'neutral';
      ratio = '5–8%';
    }
    return { cardinal: f.cardinal, bearing: Math.round(f.bearing), role, ratio, midpoint: f.midpoint };
  });

  const inlet = rated.find((r) => r.role === 'inlet');
  const outlet = rated.find((r) => r.role === 'outlet');
  const summary =
    inlet && outlet
      ? `Place inlets on the ${inlet.cardinal} (windward) face and outlets on the ${outlet.cardinal} (leeward) face for effective cross ventilation.`
      : `Prevailing wind from the ${toCardinal(windFrom)}. Provide openings on opposite faces to drive cross ventilation.`;

  return { windFrom, faces: rated, inlet, outlet, summary };
}
