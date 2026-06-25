// 2-page environmental analysis PDF (jsPDF, client-side).
// Page 1: Shadow analysis — plan-view diagrams + BCA POS compliance
// Page 2: Facade guide diagram + wind rose
import { jsPDF } from 'jspdf';
import { footprintArea, storeysOf, outerRing, centroidOf } from './geometry';
import { buildFacadeGuide } from './facadeGuide';
import { buildShadowPolygons } from './shadows';
import { getSunPosition, sydneyDate } from './sun';
import area from '@turf/area';

// ── Geometry helpers ────────────────────────────────────────────────────────

function hexRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Build a [lng,lat] → [pdfX, pdfY] transform centred on the building centroid.
function makeTransform(building, cx, cy, size, radiusM = 100) {
  const c = centroidOf(building);
  if (!c) return null;
  const [cLng, cLat] = c;
  const mPerLng = Math.cos(cLat * Math.PI / 180) * 111320;
  const mPerLat = 111320;
  const scale = (size * 0.45) / radiusM;
  return ([lng, lat]) => [
    cx + (lng - cLng) * mPerLng * scale,
    cy - (lat - cLat) * mPerLat * scale,
  ];
}

// Draw a GeoJSON Polygon or MultiPolygon feature.
function drawFeature(doc, feature, toXY, fillRgb, strokeRgb, lineW = 0.3) {
  if (!feature?.geometry) return;
  const { type, coordinates } = feature.geometry;
  const polys = type === 'Polygon' ? [coordinates] :
                type === 'MultiPolygon' ? coordinates : [];
  for (const poly of polys) {
    const ring = poly[0];
    if (!ring || ring.length < 3) continue;
    const pts = ring.map(toXY);
    const [sx, sy] = pts[0];
    const segs = [];
    for (let i = 1; i < pts.length; i++) {
      segs.push([pts[i][0] - (i === 1 ? sx : pts[i-1][0]),
                 pts[i][1] - (i === 1 ? sy : pts[i-1][1])]);
    }
    doc.setFillColor(...fillRgb);
    doc.setDrawColor(...strokeRgb);
    doc.setLineWidth(lineW);
    doc.lines(segs, sx, sy, [1, 1], 'FD', true);
  }
}

// Draw a building polygon (via outerRing).
function drawBuilding(doc, building, toXY, fillRgb, strokeRgb, lineW = 0.4) {
  const ring = outerRing(building);
  if (!ring || ring.length < 2) return;
  const pts = ring.map(toXY);
  const [sx, sy] = pts[0];
  const segs = [];
  for (let i = 1; i < pts.length; i++) {
    segs.push([pts[i][0] - (i === 1 ? sx : pts[i-1][0]),
               pts[i][1] - (i === 1 ? sy : pts[i-1][1])]);
  }
  doc.setFillColor(...fillRgb);
  doc.setDrawColor(...strokeRgb);
  doc.setLineWidth(lineW);
  doc.lines(segs, sx, sy, [1, 1], 'FD', true);
}

// Buildings within radiusM of a [lng,lat] point.
function buildingsNear(buildings, center, radiusM = 130) {
  if (!buildings?.features) return [];
  const [cLng, cLat] = center;
  const mPerLng = Math.cos(cLat * Math.PI / 180) * 111320;
  return buildings.features.filter(b => {
    const c = centroidOf(b);
    if (!c) return false;
    const dx = (c[0] - cLng) * mPerLng;
    const dy = (c[1] - cLat) * 111320;
    return Math.sqrt(dx * dx + dy * dy) < radiusM;
  });
}

// ── POS compliance ──────────────────────────────────────────────────────────

function pointInRing(pt, ring) {
  let inside = false;
  const [x, y] = pt;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi)
      inside = !inside;
  }
  return inside;
}

function pointInShadow(pt, shadowFC) {
  if (!shadowFC?.features) return false;
  for (const f of shadowFC.features) {
    if (!f?.geometry) continue;
    const { type, coordinates } = f.geometry;
    const polys = type === 'Polygon' ? [coordinates] :
                  type === 'MultiPolygon' ? coordinates : [];
    for (const poly of polys) {
      if (poly[0] && pointInRing(pt, poly[0])) return true;
    }
  }
  return false;
}

// Estimate fraction of POS polygon covered by shadow (grid sampling).
function posShadedFraction(shadowFC, posFeature) {
  if (!shadowFC?.features?.length || !posFeature?.geometry) return 0;
  const ring = posFeature.geometry.coordinates?.[0];
  if (!ring || ring.length < 3) return 0;

  const lngs = ring.map(p => p[0]);
  const lats = ring.map(p => p[1]);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);

  let inside = 0, shaded = 0;
  const N = 12;
  for (let i = 0; i <= N; i++) {
    for (let j = 0; j <= N; j++) {
      const pt = [
        minLng + (maxLng - minLng) * i / N,
        minLat + (maxLat - minLat) * j / N,
      ];
      if (!pointInRing(pt, ring)) continue;
      inside++;
      if (pointInShadow(pt, shadowFC)) shaded++;
    }
  }
  return inside === 0 ? 0 : shaded / inside;
}

// ── Shadow diagram ──────────────────────────────────────────────────────────

// selectedShadowFC → light grey shadow envelope (selected/subject building only)
// proposedShadowFC → amber shadow envelope (proposed building only)
// Draw order: amber first, grey on top — so overlap is clearly grey over amber.
// sunAlt → degrees (already converted in sun.js).
function renderShadowDiagram(doc, x, y, w, h, building, nearbyBuildings, selectedShadowFC, proposedShadowFC, proposedBuilding, posFeature, sunAlt) {
  const diagramH = h - 20; // box height; bottom reserved for time label + area text

  // Dynamic zoom: fit the shadow length inside the diagram
  const bldHeight = building.properties?.height ?? 6;
  const altRad = sunAlt * Math.PI / 180;
  const shadowLen = altRad > 0.05 ? bldHeight / Math.tan(altRad) : 0;
  const radiusM = Math.max(55, Math.min(shadowLen * 1.4 + 25, 200));

  const cx = x + w / 2;
  const cy = y + diagramH / 2;
  const toXY = makeTransform(building, cx, cy, Math.min(w, diagramH) * 0.92, radiusM);
  if (!toXY) return;

  // ── Clipping: confine all drawing to the diagram box ──────────────────────
  const pageH = doc.internal.pageSize.getHeight();
  const pdfY = pageH - y - diagramH; // PDF y is from bottom
  doc.saveGraphicsState();
  doc.internal.write(
    `${x.toFixed(2)} ${pdfY.toFixed(2)} ${w.toFixed(2)} ${diagramH.toFixed(2)} re W n`
  );

  // Background (inside clip, so it fills exactly the box)
  doc.setFillColor(248, 247, 244);
  doc.rect(x, y, w, diagramH, 'F');

  // Nearby building footprints — medium grey, NO shadows
  for (const nb of nearbyBuildings) {
    if (nb.properties?.id === building.properties?.id) continue;
    if (proposedBuilding && nb.properties?.id === proposedBuilding.properties?.id) continue;
    drawBuilding(doc, nb, toXY, [200, 198, 196], [185, 183, 181], 0.2);
  }

  // Proposed shadow — amber underneath (drawn first)
  if (proposedShadowFC?.features) {
    for (const f of proposedShadowFC.features) {
      drawFeature(doc, f, toXY, [245, 158, 11], [217, 119, 6], 0.1);
    }
  }

  // Selected building shadow — light grey ON TOP of amber so overlap is visible
  if (selectedShadowFC?.features) {
    for (const f of selectedShadowFC.features) {
      drawFeature(doc, f, toXY, [165, 163, 160], [148, 146, 143], 0.1);
    }
  }

  // POS polygon — light green fill + green outline
  if (posFeature?.geometry) {
    drawFeature(doc, posFeature, toXY, [220, 252, 231], [22, 163, 74], 1.0);
  }

  // Proposed building — red footprint on top of shadows
  if (proposedBuilding) {
    drawBuilding(doc, proposedBuilding, toXY, [239, 68, 68], [185, 28, 28], 0.8);
  }

  // Subject building — dark footprint clearly above shadow
  if (!building.properties?.isProposed) {
    drawBuilding(doc, building, toXY, [50, 50, 50], [30, 30, 30], 0.8);
  }

  // Sun altitude label — top-left inside box
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(130, 130, 130);
  doc.text(`alt ${Math.round(sunAlt)}°`, x + 5, y + 10);

  // North arrow — top-right inside box
  const arrowX = x + w - 12;
  const arrowY = y + 12;
  doc.setDrawColor(80, 80, 80);
  doc.setLineWidth(0.6);
  doc.line(arrowX, arrowY + 6, arrowX, arrowY - 1);
  doc.line(arrowX, arrowY - 1, arrowX - 2.5, arrowY + 3);
  doc.line(arrowX, arrowY - 1, arrowX + 2.5, arrowY + 3);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  doc.setTextColor(60, 60, 60);
  doc.text('N', arrowX, arrowY - 3, { align: 'center' });

  // ── End clip — restore graphics state ─────────────────────────────────────
  doc.restoreGraphicsState();

  // Box border drawn AFTER restoreGraphicsState so it's always clean (not clipped)
  doc.setDrawColor(210, 208, 205);
  doc.setLineWidth(0.5);
  doc.rect(x, y, w, diagramH, 'S');
}

// ── Wind rose ───────────────────────────────────────────────────────────────

function drawWindRose(doc, cx, cy, radius, windFromDeg, windSpeed) {
  const DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

  // Outer ring
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.circle(cx, cy, radius, 'S');
  doc.circle(cx, cy, radius * 0.5, 'S');

  // Direction tick marks
  for (let i = 0; i < 8; i++) {
    const ang = (i * 45 - 90) * Math.PI / 180;
    const inner = i % 2 === 0 ? radius * 0.85 : radius * 0.9;
    doc.line(
      cx + Math.cos(ang) * inner, cy + Math.sin(ang) * inner,
      cx + Math.cos(ang) * radius, cy + Math.sin(ang) * radius,
    );
    // Labels
    const labelR = radius + 9;
    doc.setFont('helvetica', i % 2 === 0 ? 'bold' : 'normal');
    doc.setFontSize(7);
    doc.setTextColor(60, 60, 60);
    doc.text(DIRS[i], cx + Math.cos(ang) * labelR, cy + Math.sin(ang) * labelR + 2.5, { align: 'center' });
  }

  // Prevailing wind arrow — points FROM windFromDeg
  const fromRad = (windFromDeg - 90) * Math.PI / 180;
  const toRad = (windFromDeg + 180 - 90) * Math.PI / 180;
  const ax = cx + Math.cos(fromRad) * radius * 0.85;
  const ay = cy + Math.sin(fromRad) * radius * 0.85;
  const bx = cx + Math.cos(toRad) * radius * 0.45;
  const by = cy + Math.sin(toRad) * radius * 0.45;

  // Arrow shaft
  doc.setDrawColor(59, 130, 246);
  doc.setLineWidth(2);
  doc.line(ax, ay, bx, by);

  // Arrowhead at destination (bx, by)
  const headAng = Math.atan2(by - ay, bx - ax);
  const hLen = 6;
  doc.line(bx, by, bx - hLen * Math.cos(headAng - 0.4), by - hLen * Math.sin(headAng - 0.4));
  doc.line(bx, by, bx - hLen * Math.cos(headAng + 0.4), by - hLen * Math.sin(headAng + 0.4));

  // Centre dot
  doc.setFillColor(59, 130, 246);
  doc.circle(cx, cy, 2, 'F');

  // Speed label
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(30, 30, 30);
  doc.text(`${windSpeed ? windSpeed.toFixed(1) : '—'} km/h`, cx, cy + radius + 20, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 100, 100);
  doc.text(`From ${Math.round(windFromDeg)}°`, cx, cy + radius + 29, { align: 'center' });
}

// ── Facade callouts ─────────────────────────────────────────────────────────

function drawFaceCallouts(doc, faces, toXY, diagramX, diagramY) {
  const CALLOUT = 32;
  doc.setFont('helvetica', 'normal');
  for (const f of faces) {
    const [r, g, b] = hexRgb(f.color);
    const [mx, my] = toXY(f.midpoint);
    const [x1, y1] = toXY(f.p1);
    const [x2, y2] = toXY(f.p2);

    // Coloured face edge
    doc.setDrawColor(r, g, b);
    doc.setLineWidth(2.5);
    doc.line(x1, y1, x2, y2);

    // Callout line
    const ang = Math.atan2(my - diagramY, mx - diagramX);
    const lx = mx + Math.cos(ang) * CALLOUT;
    const ly = my + Math.sin(ang) * CALLOUT;
    doc.setLineWidth(0.8);
    doc.line(mx, my, lx, ly);

    // Label
    const rightSide = lx > diagramX;
    const tx = rightSide ? lx + 3 : lx - 3;
    const align = rightSide ? 'left' : 'right';
    let ty = ly - 12;

    // Cardinal badge
    doc.setFillColor(r, g, b);
    const bw = 14, bh = 9;
    const bx = rightSide ? tx : tx - bw;
    doc.roundedRect(bx, ty - 7, bw, bh, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text(f.cardinal, bx + bw / 2, ty, { align: 'center' });
    ty += 10;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    const maxW = 100;
    const lines = f.isPartyWall
      ? ['Shared / party wall', 'No openings permitted']
      : [`W: ${f.windows}`, `S: ${f.shading}`, `V: ${f.vent.label} (${f.vent.ratio})`];
    for (const txt of lines) {
      const wrapped = doc.splitTextToSize(txt, maxW);
      doc.setTextColor(f.isPartyWall ? 120 : 60, 60, 60);
      doc.text(wrapped, tx, ty, { align });
      ty += 8 * wrapped.length;
    }
  }
}

// ── Page 1: Shadow analysis ─────────────────────────────────────────────────

function renderShadowPage(doc, building, analyses) {
  const M = 40;
  let y = M;
  const W = 515; // usable width

  const props = building.properties || {};

  // ── Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(20, 20, 20);
  doc.text('Shadow Analysis Report', M, y); y += 24;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(90, 90, 90);
  doc.text(props.address || 'Surry Hills building', M, y); y += 14;

  const height = Math.round(props.height ?? 6);
  const areaM2 = Math.round(footprintArea(building));
  doc.setFontSize(9);
  doc.text(
    `Height: ~${height} m (${storeysOf(props.height ?? 6)} storeys)  ·  Footprint: ${areaM2.toLocaleString()} m²  ·  Analysis date: June 21 & December 21`,
    M, y,
  ); y += 10;

  doc.setDrawColor(220); doc.setLineWidth(0.5);
  doc.line(M, y, M + W, y); y += 16;

  // ── Diagram grid setup
  const SOLSTICES = [
    { label: 'WINTER SOLSTICE  —  June 21', monthIdx: 5, day: 21 },
    { label: 'SUMMER SOLSTICE  —  December 21', monthIdx: 11, day: 21 },
  ];
  const TIMES = [
    { label: '9:00 am', hour: 9 },
    { label: '12:00 pm', hour: 12 },
    { label: '3:00 pm', hour: 15 },
  ];

  const GAP = 10;
  const diagW = Math.floor((W - GAP * 2) / 3);
  const diagH = 155; // height includes time label space below

  const center = centroidOf(building);
  const nearby = center ? buildingsNear(analyses.buildings, center) : [];

  // Winter compliance data collected during diagram rendering
  const winterCompliance = [];

  for (const solstice of SOLSTICES) {
    // Section eyebrow
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(solstice.label, M, y); y += 4;

    // Thin rule
    doc.setDrawColor(235); doc.setLineWidth(0.4);
    doc.line(M, y, M + W, y); y += 8;

    const rowY = y;

    for (let t = 0; t < TIMES.length; t++) {
      const { label, hour } = TIMES[t];
      const sun = getSunPosition(sydneyDate(2026, solstice.monthIdx, solstice.day, hour));
      const sunUp = sun.altitude > 0.05;

      // Shadow for SELECTED BUILDING ONLY — shown in diagram as light grey envelope
      const selectedShadowFC = sunUp
        ? buildShadowPolygons({ type: 'FeatureCollection', features: [building] }, sun)
        : null;

      // Shadow for PROPOSED BUILDING ONLY — shown in amber
      const proposedShadowFC = sunUp && analyses.proposedBuilding
        ? buildShadowPolygons({ type: 'FeatureCollection', features: [analyses.proposedBuilding] }, sun)
        : null;

      const diagX = M + t * (diagW + GAP);

      renderShadowDiagram(
        doc, diagX, rowY, diagW, diagH,
        building, nearby,
        selectedShadowFC, proposedShadowFC, analyses.proposedBuilding ?? null,
        analyses.posFeature ?? null,
        sun.altitude,
      );

      // Time label (centred below diagram box)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(40, 40, 40);
      doc.text(label, diagX + diagW / 2, rowY + diagH + 5, { align: 'center' });

      // Shadow area — one or two lines below time label
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      if (!sunUp) {
        doc.setTextColor(150, 150, 150);
        doc.text('Sun below horizon', diagX + diagW / 2, rowY + diagH + 13, { align: 'center' });
      } else {
        let selArea = 0;
        if (selectedShadowFC?.features) for (const f of selectedShadowFC.features) selArea += area(f);
        let propArea = 0;
        if (proposedShadowFC?.features) for (const f of proposedShadowFC.features) propArea += area(f);

        if (analyses.proposedBuilding && propArea > 0) {
          doc.setTextColor(90, 90, 90);
          doc.text(`Existing: ${Math.round(selArea).toLocaleString()} m²`, diagX + diagW / 2, rowY + diagH + 13, { align: 'center' });
          doc.setTextColor(160, 100, 0);
          doc.text(`+ Proposed: ${Math.round(propArea).toLocaleString()} m²`, diagX + diagW / 2, rowY + diagH + 20, { align: 'center' });
        } else {
          doc.setTextColor(100, 100, 100);
          doc.text(`${Math.round(selArea).toLocaleString()} m² shadow`, diagX + diagW / 2, rowY + diagH + 13, { align: 'center' });
        }
      }

      // POS compliance — use ALL buildings for an accurate picture
      if (solstice.monthIdx === 5 && analyses.posFeature) {
        const allShadow = sunUp && analyses.buildings
          ? buildShadowPolygons(analyses.buildings, sun)
          : null;
        const withProposed = allShadow && proposedShadowFC
          ? { type: 'FeatureCollection', features: [...allShadow.features, ...proposedShadowFC.features] }
          : (allShadow ?? null);
        const frac = withProposed ? posShadedFraction(withProposed, analyses.posFeature) : 0;
        winterCompliance.push({ label, frac });
      }
    }

    y = rowY + diagH + (analyses.proposedBuilding ? 26 : 18);
  }

  // ── Legend
  y += 4;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(90, 90, 90);
  const legendItems = [
    { fill: [58, 58, 58], label: 'Existing building shadow' },
    ...(analyses.proposedBuilding ? [{ fill: [245, 158, 11], label: 'Proposed building shadow' }] : []),
    { fill: [99, 102, 241], label: 'Selected building' },
    ...(analyses.proposedBuilding ? [{ fill: [239, 68, 68], label: 'Proposed building' }] : []),
    { fill: [187, 247, 208], label: 'PPOS polygon', stroke: [22, 163, 74] },
    { fill: [215, 213, 210], label: 'Surrounding buildings' },
  ];
  let lx = M;
  for (const item of legendItems) {
    doc.setFillColor(...item.fill);
    if (item.stroke) { doc.setDrawColor(...item.stroke); doc.setLineWidth(0.8); doc.rect(lx, y - 6, 8, 8, 'FD'); }
    else { doc.rect(lx, y - 6, 8, 8, 'F'); }
    doc.setTextColor(60, 60, 60);
    doc.text(item.label, lx + 11, y);
    lx += doc.getTextWidth(item.label) + 22;
    if (lx > M + W - 80) { lx = M; y += 12; }
  }
  y += 16;

  // ── POS Compliance (only if posFeature was provided)
  if (analyses.posFeature && winterCompliance.length) {
    doc.setDrawColor(220); doc.setLineWidth(0.5);
    doc.line(M, y, M + W, y); y += 14;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    doc.text('PRINCIPAL PRIVATE OPEN SPACE — BCA SHADOW COMPLIANCE (June 21)', M, y); y += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(110, 110, 110);
    doc.text('NSW BASIX: PPOS must receive direct sunlight for a minimum of 2 hours between 9 am and 3 pm on June 21.', M, y); y += 14;

    // Table header
    const col = [M, M + 90, M + 220, M + 360];
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    doc.text('Time', col[0], y);
    doc.text('POS shadowed', col[1], y);
    doc.text('POS in sunlight', col[2], y);
    doc.text('Status', col[3], y);
    y += 4;
    doc.setDrawColor(200); doc.line(M, y, M + W, y); y += 10;

    let passCount = 0;
    doc.setFont('helvetica', 'normal');
    for (const { label, frac } of winterCompliance) {
      const shadPct = Math.round(frac * 100);
      const sunPct = 100 - shadPct;
      const passes = frac < 0.5;
      if (passes) passCount++;

      doc.setFontSize(10);
      doc.setTextColor(30, 30, 30);
      doc.text(label, col[0], y);

      doc.setTextColor(58, 58, 58);
      doc.text(`${shadPct}%`, col[1], y);

      doc.setTextColor(30, 30, 30);
      doc.text(`${sunPct}%`, col[2], y);

      doc.setTextColor(...(passes ? [22, 163, 74] : [220, 38, 38]));
      doc.setFont('helvetica', 'bold');
      doc.text(passes ? '✓  PASS' : '✗  FAIL', col[3], y);
      doc.setFont('helvetica', 'normal');
      y += 16;
    }

    // Compliance verdict box
    y += 4;
    let verdict, verdictColor;
    if (passCount === 3) {
      verdict = 'Compliant — PPOS receives full sunlight across all reference times.';
      verdictColor = [22, 163, 74];
    } else if (passCount === 2) {
      verdict = 'Likely Compliant — PPOS receives at least 2 hours of direct sunlight (9 am–3 pm).';
      verdictColor = [22, 163, 74];
    } else if (passCount === 1) {
      verdict = 'Marginal — PPOS receives limited sunlight. Further detailed assessment is recommended.';
      verdictColor = [217, 119, 6];
    } else {
      verdict = 'Non-Compliant — PPOS is significantly shadowed throughout the reference day. Redesign required.';
      verdictColor = [220, 38, 38];
    }

    const boxH = 28;
    doc.setFillColor(verdictColor[0], verdictColor[1], verdictColor[2]);
    doc.setDrawColor(...verdictColor);
    doc.setLineWidth(1);
    doc.roundedRect(M, y, W, boxH, 3, 3, 'FD');

    // Light overlay so text is readable
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(0);
    doc.roundedRect(M + 1, y + 1, W - 2, boxH - 2, 2, 2, 'F');

    doc.setFillColor(...verdictColor);
    doc.rect(M, y, 6, boxH, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...verdictColor);
    const lines = doc.splitTextToSize(verdict, W - 20);
    doc.text(lines, M + 12, y + 10);
    y += boxH + 10;
  }

  // ── Disclaimer
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(160);
  const disclaimer = 'Shadow analysis is indicative only. Building heights sourced from OpenStreetMap. POS compliance assessment uses sampled shadow coverage at reference times and is not a substitute for professional planning assessment under applicable NSW legislation.';
  doc.text(doc.splitTextToSize(disclaimer, W), M, 810);
}

// ── Page 2: Facade guide + wind ─────────────────────────────────────────────

function renderFacadePage(doc, building, analyses) {
  const M = 40;
  let y = M;
  const W = 515;
  const props = building.properties || {};

  const line = (txt, size = 11, weight = 'normal', gap = 16, color = [0, 0, 0]) => {
    doc.setFont('helvetica', weight);
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const wrapped = doc.splitTextToSize(txt, W);
    doc.text(wrapped, M, y);
    y += gap * wrapped.length;
  };

  const rule = () => {
    doc.setDrawColor(220); doc.setLineWidth(0.5);
    doc.line(M, y, M + W, y); y += 14;
  };
  const eyebrow = (txt) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(txt, M, y); y += 12;
  };

  // Header
  line('Design Recommendations', 18, 'bold', 24);
  line(props.address || 'Surry Hills building', 11, 'normal', 16, [90, 90, 90]);
  rule();

  // ── Facade guide diagram
  eyebrow('FACADE GUIDE — WINDOWS, SHADING & VENTILATION');
  line('Colour coding: amber = moderate solar gain  ·  green = low risk  ·  red = high solar load  ·  grey = party wall', 8, 'normal', 12, [110, 110, 110]);
  line('W = window-to-wall ratio target  ·  S = shading device  ·  V = cross-ventilation role', 8, 'normal', 14, [110, 110, 110]);

  const DIAG_SIZE = 220;
  const diagCX = M + DIAG_SIZE / 2 + 30;
  const diagCY = y + DIAG_SIZE / 2 + 10;

  const toXY = makeTransform(building, diagCX, diagCY, DIAG_SIZE, 150);
  if (toXY) {
    // Background
    doc.setFillColor(245, 244, 240);
    doc.rect(diagCX - DIAG_SIZE / 2, diagCY - DIAG_SIZE / 2, DIAG_SIZE, DIAG_SIZE, 'F');

    // Nearby buildings
    const center = centroidOf(building);
    if (center) {
      const nearby = buildingsNear(analyses.buildings, center, 160);
      for (const nb of nearby) {
        if (nb.properties?.id === building.properties?.id) continue;
        drawBuilding(doc, nb, toXY, [210, 210, 208], [180, 180, 178], 0.3);
      }
    }

    // Subject building
    const isProposed = building.properties?.isProposed;
    drawBuilding(doc, building, toXY,
      isProposed ? [239, 68, 68] : [160, 155, 200],
      isProposed ? [185, 28, 28] : [100, 90, 160],
      1.5,
    );

    const faces = buildFacadeGuide(building, analyses.wind?.direction ?? 0, analyses.buildings ?? null);
    drawFaceCallouts(doc, faces, toXY, diagCX, diagCY);
  }

  y += DIAG_SIZE + 18;

  // Facade legend
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  const legendItems = [
    { color: '#e4572e', label: 'High solar load — prioritise shading + high-performance glazing' },
    { color: '#f3c01b', label: 'Moderate solar gain — horizontal shading recommended' },
    { color: '#1ea64a', label: 'Low solar risk — standard glazing adequate' },
    { color: '#9aa0a6', label: 'Party / shared wall — no openings permitted' },
  ];
  for (const { color, label } of legendItems) {
    const [r, g, b] = hexRgb(color);
    doc.setFillColor(r, g, b);
    doc.rect(M, y - 6, 8, 8, 'F');
    doc.setTextColor(60, 60, 60);
    doc.text(label, M + 12, y);
    y += 13;
  }
  y += 4;
  rule();

  // ── Wind section
  eyebrow('WIND EXPOSURE');

  const ROSE_R = 50;
  const roseX = M + ROSE_R + 15;
  const roseY = y + ROSE_R + 5;

  if (analyses.wind) {
    drawWindRose(doc, roseX, roseY, ROSE_R, analyses.wind.direction, analyses.wind.speed);
  } else {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(150);
    doc.text('Wind data unavailable.', M, y + 10);
  }

  // Wind text info beside rose
  const textX = roseX + ROSE_R + 30;
  let ty = y + 10;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(30, 30, 30);
  if (analyses.wind) {
    doc.text(`${analyses.wind.speed?.toFixed(1) ?? '—'} km/h`, textX, ty); ty += 14;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    doc.text(`Prevailing direction: from ${Math.round(analyses.wind.direction)}°`, textX, ty); ty += 12;

    const card = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
    const cardIdx = Math.round(analyses.wind.direction / 22.5) % 16;
    doc.text(`Cardinal: ${card[cardIdx]}`, textX, ty); ty += 12;
    doc.text('Source: Open-Meteo monthly average', textX, ty); ty += 18;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(110, 110, 110);
    const windNote = 'The wind arrow shows the prevailing direction wind blows FROM. Windward faces (facing the arrow origin) are primary ventilation inlets; leeward faces are outlets. Refer to facade guide for recommended window-to-wall ratios.';
    const wrapped = doc.splitTextToSize(windNote, W - (textX - M));
    doc.text(wrapped, textX, ty);
  }

  y = roseY + ROSE_R + 30;
  rule();

  // ── Disclaimer
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(160);
  doc.text(
    doc.splitTextToSize(
      'Design recommendations are heuristic and based on Sydney climate data. Not a substitute for energy modelling, NCC Section J compliance assessment, or engineering advice.',
      W,
    ),
    M,
    810,
  );
}

// ── Entry point ─────────────────────────────────────────────────────────────

export function generatePdf(building, analyses) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });

  renderShadowPage(doc, building, analyses);

  doc.addPage();
  renderFacadePage(doc, building, analyses);

  const safe = ((building.properties?.address || 'building')).replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  doc.save(`surry-hills-report-${safe}.pdf`);
}
