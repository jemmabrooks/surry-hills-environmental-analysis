// Single-page PDF building report (jsPDF, client-side).
import { jsPDF } from 'jspdf';
import { footprintArea, storeysOf, outerRing, centroidOf } from './geometry';
import { solarSummary } from './solar';
import { buildFacadeGuide } from './facadeGuide';

// ── Facade diagram helpers ─────────────────────────────────────────────────

// Hex color → [r, g, b]
function hexRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Build a neighbourhood-scale transform centred on the building.
// Uses a fixed ~150 m radius bbox so surrounding buildings are visible.
function makeFacadeTransform(building, cx, cy, size) {
  const c = centroidOf(building);
  if (!c) return null;
  const [cLng, cLat] = c;
  const mPerLng = Math.cos(cLat * Math.PI / 180) * 111320;
  const mPerLat = 111320;
  const RADIUS_M = 150; // neighbourhood radius in metres
  const dLng = RADIUS_M / mPerLng;
  const dLat = RADIUS_M / mPerLat;
  const pad = size * 0.05;
  const scale = Math.min(
    (size - pad * 2) / (2 * RADIUS_M),
    (size - pad * 2) / (2 * RADIUS_M),
  );
  return ([lng, lat]) => [
    cx + (lng - cLng) * mPerLng * scale,
    cy - (lat - cLat) * mPerLat * scale, // PDF y flipped
  ];
}

// Draw a single building polygon with given fill/stroke colours.
function drawPolygon(doc, building, toXY, fillRgb, strokeRgb, lineW = 0.4) {
  const ring = outerRing(building);
  if (!ring || ring.length < 2) return;
  const pts = ring.map(toXY);
  const [sx, sy] = pts[0];
  const segs = [];
  for (let i = 1; i < pts.length; i++) {
    segs.push([pts[i][0] - (i === 1 ? sx : pts[i-1][0]), pts[i][1] - (i === 1 ? sy : pts[i-1][1])]);
  }
  doc.setFillColor(...fillRgb);
  doc.setDrawColor(...strokeRgb);
  doc.setLineWidth(lineW);
  doc.lines(segs, sx, sy, [1, 1], 'FD', true);
}

// Draw all neighbouring buildings within ~150 m, then the subject building on top.
function drawContext(doc, building, nearbyBuildings, toXY) {
  // Background map tile colour
  const [cx, cy] = toXY(centroidOf(building));

  // Nearby buildings in medium grey
  for (const b of nearbyBuildings) {
    if (b === building || b.properties?.id === building.properties?.id) continue;
    drawPolygon(doc, b, toXY, [210, 210, 208], [180, 180, 178], 0.3);
  }

  // Subject building: red if proposed, otherwise darker grey
  const isProposed = building.properties?.isProposed;
  if (isProposed) {
    drawPolygon(doc, building, toXY, [239, 68, 68], [185, 28, 28], 1.5);
  } else {
    drawPolygon(doc, building, toXY, [160, 155, 200], [100, 90, 160], 1.5);
  }
}

// Filter buildings within radius_m of a centroid [lng, lat].
function buildingsNear(buildings, center, radiusM = 160) {
  if (!buildings?.features) return [];
  const [cLng, cLat] = center;
  const mPerLng = Math.cos(cLat * Math.PI / 180) * 111320;
  const mPerLat = 111320;
  return buildings.features.filter(b => {
    const c = centroidOf(b);
    if (!c) return false;
    const dx = (c[0] - cLng) * mPerLng;
    const dy = (c[1] - cLat) * mPerLat;
    return Math.sqrt(dx*dx + dy*dy) < radiusM;
  });
}

// Draw colored face edges + callout labels.
function drawFaceCallouts(doc, faces, toXY, diagramX, diagramY, diagramSize) {
  const CALLOUT = 36; // callout line length in pt
  doc.setFont('helvetica', 'normal');

  for (const f of faces) {
    const [r, g, b] = hexRgb(f.color);
    const [mx, my] = toXY(f.midpoint);

    // Colored face edge
    const [x1, y1] = toXY(f.p1);
    const [x2, y2] = toXY(f.p2);
    doc.setDrawColor(r, g, b);
    doc.setLineWidth(2.5);
    doc.line(x1, y1, x2, y2);

    // Callout line direction: away from diagram center
    const ang = Math.atan2(my - diagramY, mx - diagramX);
    const lx = mx + Math.cos(ang) * CALLOUT;
    const ly = my + Math.sin(ang) * CALLOUT;
    doc.setDrawColor(r, g, b);
    doc.setLineWidth(0.8);
    doc.line(mx, my, lx, ly);

    // Label anchor: left or right of callout end
    const rightSide = lx > diagramX;
    const tx = rightSide ? lx + 3 : lx - 3;
    const align = rightSide ? 'left' : 'right';
    let ty = ly - 14;

    // Cardinal badge
    doc.setFillColor(r, g, b);
    const badgeW = 14, badgeH = 9;
    const bx = rightSide ? tx : tx - badgeW;
    doc.roundedRect(bx, ty - 7, badgeW, badgeH, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text(f.cardinal, bx + badgeW / 2, ty, { align: 'center' });
    ty += 10;

    // Windows, shading, vent lines
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    const maxW = 110;
    for (const txt of [
      `W: ${f.windows}`,
      `S: ${f.shading}`,
      `V: ${f.vent.label} (${f.vent.ratio})`,
    ]) {
      const wrapped = doc.splitTextToSize(txt, maxW);
      doc.setTextColor(60, 60, 60);
      doc.text(wrapped, tx, ty, { align });
      ty += 8 * wrapped.length;
    }
  }
}

// ── Main report ────────────────────────────────────────────────────────────

// analyses: { solar, ventilation, glazing, wind, buildings?, shadowComparison? }
export function generatePdf(building, analyses) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const M = 48;
  let y = M;
  const props = building.properties || {};

  const line = (txt, size = 11, weight = 'normal', gap = 16, color = [0, 0, 0]) => {
    doc.setFont('helvetica', weight);
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const wrapped = doc.splitTextToSize(txt, 515);
    doc.text(wrapped, M, y);
    y += gap * wrapped.length;
  };
  const rule = () => {
    doc.setDrawColor(230);
    doc.line(M, y, 547, y);
    y += 18;
  };
  const heading = (txt) => {
    y += 6;
    line(txt.toUpperCase(), 9, 'bold', 14, [120, 120, 120]);
  };

  // Title
  line('Environmental Analysis Report', 22, 'bold', 26);
  line(props.address || 'Surry Hills building', 13, 'normal', 20, [80, 80, 80]);
  rule();

  // Stats
  const height = props.height ?? 6;
  const areaM2 = Math.round(footprintArea(building));
  heading('Building');
  line(`Height: ~${Math.round(height)} m  (${storeysOf(height)} storeys est.)`, 11);
  line(`Footprint area: ${areaM2.toLocaleString()} m²`, 11);
  rule();

  // Solar
  heading('Solar panel placement');
  line(solarSummary(analyses.solar), 11);
  rule();

  // Ventilation
  heading('Cross ventilation');
  line(analyses.ventilation?.summary || '—', 11);
  if (analyses.ventilation?.faces?.length) {
    for (const f of analyses.ventilation.faces) {
      line(`• ${f.cardinal} face — ${f.role} (window-to-wall ${f.ratio})`, 10, 'normal', 13);
    }
  }
  rule();

  // Glazing
  heading('Glazing & shading');
  for (const f of analyses.glazing?.faces || []) {
    line(`• ${f.label} (${f.risk} risk): ${f.text}`, 10, 'normal', 13);
  }
  rule();

  // Wind
  heading('Wind exposure');
  if (analyses.wind) {
    line(
      `Prevailing wind from ${Math.round(analyses.wind.direction)}°, ` +
        `average ${analyses.wind.speed.toFixed(1)} km/h (monthly mean).`,
      11,
    );
  } else {
    line('Wind data unavailable.', 11);
  }
  rule();

  // ── Design Recommendations — facade diagram ──────────────────────────────
  heading('Design recommendations — facade guide');
  line('Colour coding: amber = moderate solar gain  ·  green = low risk  ·  red = high solar / heat load', 9, 'normal', 13, [100, 100, 100]);
  line('W = windows (WWR target)  ·  S = shading device  ·  V = cross-ventilation role', 9, 'normal', 14, [100, 100, 100]);

  const DIAG_SIZE = 220; // diagram bounding box in pt
  const diagCX = M + DIAG_SIZE / 2 + 20;
  const diagCY = y + DIAG_SIZE / 2 + 10;

  const toXY = makeFacadeTransform(building, diagCX, diagCY, DIAG_SIZE);
  if (toXY) {
    // Light background tile
    doc.setFillColor(245, 244, 240);
    doc.rect(diagCX - DIAG_SIZE / 2, diagCY - DIAG_SIZE / 2, DIAG_SIZE, DIAG_SIZE, 'F');

    // Context buildings then subject building
    const nearby = buildingsNear(analyses.buildings, centroidOf(building));
    drawContext(doc, building, nearby, toXY);

    const faces = buildFacadeGuide(building, analyses.wind?.direction ?? 0);
    drawFaceCallouts(doc, faces, toXY, diagCX, diagCY, DIAG_SIZE);
  }

  y += DIAG_SIZE + 20;

  // Legend
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const legendItems = [
    { color: '#e4572e', label: 'High solar load — prioritise shading + high-perf glazing' },
    { color: '#f3c01b', label: 'Moderate solar gain — horizontal shading recommended' },
    { color: '#1ea64a', label: 'Low solar risk — standard glazing adequate' },
  ];
  for (const { color, label } of legendItems) {
    const [r, g, b] = hexRgb(color);
    doc.setFillColor(r, g, b);
    doc.rect(M, y - 6, 8, 8, 'F');
    doc.setTextColor(60, 60, 60);
    doc.text(label, M + 12, y);
    y += 13;
  }

  // ── Shadow comparison (existing vs proposed) ─────────────────────────────
  if (analyses.shadowComparison) {
    y += 10;
    heading('Shadow comparison — existing vs proposed building (June 21)');
    line(
      'New shadow area cast by the proposed building only, at three reference times on the winter solstice.',
      10, 'normal', 14, [80, 80, 80],
    );

    // Colour swatches matching the map (dark grey = existing, amber = proposed)
    const GREY = [58, 58, 58];   // #3a3a3a — existing shadow colour
    const AMBER = [245, 158, 11]; // #f59e0b — proposed shadow colour

    // Column legend swatches in header row
    const col = [M, M + 90, M + 220, M + 350];
    const rowH = 20;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(80, 80, 80);
    doc.text('Time', col[0], y);

    // "Existing" header with dark grey swatch
    doc.setFillColor(...GREY);
    doc.rect(col[1], y - 7, 8, 8, 'F');
    doc.setTextColor(80, 80, 80);
    doc.text('Existing (m²)', col[1] + 11, y);

    // "Proposed" header with amber swatch
    doc.setFillColor(...AMBER);
    doc.rect(col[2], y - 7, 8, 8, 'F');
    doc.text('Proposed only (m²)', col[2] + 11, y);

    doc.text('Additional shadow', col[3], y);
    y += rowH;
    doc.setDrawColor(200); doc.line(M, y - 6, 547, y - 6);

    doc.setFont('helvetica', 'normal');
    for (const row of analyses.shadowComparison) {
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      doc.text(row.label, col[0], y);

      // Existing area in dark grey
      doc.setTextColor(...GREY);
      doc.text(row.existingArea.toLocaleString(), col[1] + 11, y);

      // Proposed area in amber
      doc.setTextColor(...AMBER);
      doc.text(row.newArea > 0 ? row.newArea.toLocaleString() : '—', col[2] + 11, y);

      // Change in amber if positive
      if (row.newArea > 0) {
        doc.setTextColor(...AMBER);
        doc.text(`+${row.newArea.toLocaleString()} m²`, col[3], y);
      } else {
        doc.setTextColor(160, 160, 160);
        doc.text('—', col[3], y);
      }
      y += rowH;
    }

    // Legend strip
    y += 6;
    doc.setFontSize(8);
    doc.setFillColor(...AMBER);
    doc.rect(M, y - 6, 8, 8, 'F');
    doc.setTextColor(80, 80, 80);
    doc.text('Amber — new shadow area from proposed building only (as shown on map)', M + 12, y);
    y += 13;
    doc.setFillColor(...GREY);
    doc.rect(M, y - 6, 8, 8, 'F');
    doc.text('Dark grey — existing building shadows (as shown on map)', M + 12, y);
    y += 16;
    rule();
  }

  // Footer disclaimer
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(
    doc.splitTextToSize(
      'Indicative analysis only. Heights from OpenStreetMap; wind from Open-Meteo monthly ' +
        'averages; solar/ventilation are heuristic. Not a substitute for engineering assessment.',
      515,
    ),
    M,
    800,
  );

  const safe = (props.address || 'building').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  doc.save(`surry-hills-report-${safe}.pdf`);
}
