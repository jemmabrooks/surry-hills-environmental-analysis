// Single-page shadow analysis PDF using jsPDF vector graphics (no html2canvas).
import { jsPDF } from 'jspdf';
import { outerRing } from './geometry';
import {
  computeShadowMoments,
  computeCompliance,
  analyseFacades,
  generateRecommendations,
} from './shadowReport';

const A4W = 595, A4H = 842;
const ML = 36, MR = 36, MT = 36;
const CW = A4W - ML - MR; // 523pt content width

// ─── coordinate transform helpers ────────────────────────────────────────────

// Build a function that maps [lng, lat] → [pdfX, pdfY] within a cell,
// using a pre-computed data bounding box and scale.
function makeCellTransform(dataExt, cellX, cellY, cellW, cellH, pad = 8) {
  const { minLng, maxLng, minLat, maxLat } = dataExt;
  const dLng = maxLng - minLng || 1e-5;
  const dLat  = maxLat  - minLat  || 1e-5;
  const scale = Math.min((cellW - 2 * pad) / dLng, (cellH - 2 * pad) / dLat);
  const innerW = dLng * scale;
  const innerH = dLat  * scale;
  // Centre the content in the cell
  const ox = cellX + pad + ((cellW - 2 * pad) - innerW) / 2;
  const oy = cellY + pad + ((cellH - 2 * pad) - innerH) / 2;
  return ([lng, lat]) => [ox + (lng - minLng) * scale, oy + (maxLat - lat) * scale];
}

// Collect all [lng, lat] coords from a list of GeoJSON rings (skip nulls)
function gatherCoords(...rings) {
  return rings.flat().filter(Boolean);
}

function dataExtents(coords) {
  if (!coords.length) return { minLng: 0, maxLng: 1, minLat: 0, maxLat: 1 };
  const lngs = coords.map(c => c[0]);
  const lats  = coords.map(c => c[1]);
  return {
    minLng: Math.min(...lngs), maxLng: Math.max(...lngs),
    minLat:  Math.min(...lats),  maxLat:  Math.max(...lats),
  };
}

// ─── jsPDF polygon draw helpers ───────────────────────────────────────────────

// Draw a filled polygon from [lng,lat] ring using a transform function.
function fillPoly(doc, ring, tr, r, g, b) {
  if (!ring || ring.length < 3) return;
  const pts = ring.map(tr);
  const rel = pts.slice(1).map((p, i) => [p[0] - pts[i][0], p[1] - pts[i][1]]);
  doc.setFillColor(r, g, b);
  doc.lines(rel, pts[0][0], pts[0][1], [1, 1], 'F', true);
}

// Draw a stroked polygon outline.
function strokePoly(doc, ring, tr, r, g, b, lw = 0.6) {
  if (!ring || ring.length < 3) return;
  const pts = ring.map(tr);
  const rel = pts.slice(1).map((p, i) => [p[0] - pts[i][0], p[1] - pts[i][1]]);
  doc.setDrawColor(r, g, b);
  doc.setLineWidth(lw);
  doc.lines(rel, pts[0][0], pts[0][1], [1, 1], 'D', true);
}

// Draw filled + stroked polygon.
function fillStrokePoly(doc, ring, tr, fr, fg, fb, sr, sg, sb, lw = 0.5) {
  if (!ring || ring.length < 3) return;
  const pts = ring.map(tr);
  const rel = pts.slice(1).map((p, i) => [p[0] - pts[i][0], p[1] - pts[i][1]]);
  doc.setFillColor(fr, fg, fb);
  doc.setDrawColor(sr, sg, sb);
  doc.setLineWidth(lw);
  doc.lines(rel, pts[0][0], pts[0][1], [1, 1], 'FD', true);
}

// ─── individual diagram cell ──────────────────────────────────────────────────

function drawDiagramCell(doc, moment, building, posFeature, cX, cY, cW, cH, tr) {
  // Cell background
  doc.setFillColor(247, 247, 247);
  doc.setDrawColor(210, 210, 210);
  doc.setLineWidth(0.3);
  doc.rect(cX, cY, cW, cH, 'FD');

  // Shadow envelope — light grey
  if (moment.shadow) {
    const sr = outerRing(moment.shadow);
    if (sr) fillPoly(doc, sr, tr, 200, 200, 205);
  }

  // POS polygon — green outline only (so shadow visibility is preserved)
  if (posFeature) {
    const pr = outerRing(posFeature);
    if (pr) strokePoly(doc, pr, tr, 34, 139, 34, 0.8);
  }

  // Building footprint — dark fill + stroke
  const fr = outerRing(building);
  if (fr) fillStrokePoly(doc, fr, tr, 70, 70, 75, 40, 40, 45, 0.4);

  // Sun altitude badge (top-left)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.5);
  doc.setTextColor(90, 90, 90);
  doc.text(`alt ${Math.round(moment.sun.altitude)}°`, cX + 3, cY + 7);

  // Time label (bottom-centre)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  const isWinter = moment.season === 'winter';
  doc.setTextColor(isWinter ? 40 : 40, isWinter ? 40 : 40, isWinter ? 40 : 40);
  doc.text(moment.label, cX + cW / 2, cY + cH - 4, { align: 'center' });
}

// ─── main export ─────────────────────────────────────────────────────────────

export function generateShadowReport(building, posFeature) {
  const moments       = computeShadowMoments(building);
  const compliance    = computeCompliance(building, posFeature);
  const facadeAnalysis = analyseFacades(building, moments);
  const recs          = generateRecommendations(building, compliance, moments, facadeAnalysis);

  const doc  = new jsPDF({ unit: 'pt', format: 'a4' });
  const props = building.properties || {};
  let y = MT;

  // ── Header ─────────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(0, 0, 0);
  doc.text('Shadow Analysis Report', ML, y + 13);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text(props.address || 'Surry Hills building', ML, y + 27);

  const dateStr = new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });
  doc.setFontSize(8);
  doc.setTextColor(140, 140, 140);
  doc.text(`Generated ${dateStr}`, A4W - MR, y + 27, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(140, 140, 140);
  const h = props.height ?? 6;
  doc.text(
    `Building height ~${Math.round(h)} m  ·  Surry Hills NSW  ·  lat 33.89°S`,
    ML, y + 39,
  );

  y += 48;
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.line(ML, y, A4W - MR, y);
  y += 10;

  // ── Section label ──────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  doc.text('SHADOW ENVELOPES  ·  WINTER (21 JUN) AND SUMMER (21 DEC) SOLSTICE  ·  9AM  /  SOLAR NOON  /  3PM', ML, y + 8);
  y += 18;

  // ── Compute unified data extents for all 6 diagrams ──────────────────────
  const buildingRing = outerRing(building) || [];
  const shadowRings  = moments.map(m => m.shadow ? outerRing(m.shadow) : []).filter(Boolean);
  const posRing      = posFeature ? (outerRing(posFeature) || []) : [];
  const allCoords    = gatherCoords(buildingRing, ...shadowRings, posRing);
  const ext          = dataExtents(allCoords);

  // ── Diagram grid: 2 rows × 3 cols ─────────────────────────────────────────
  const COL_GAP = 6, ROW_GAP = 8, LABEL_H = 13;
  const CELL_W = (CW - 2 * COL_GAP) / 3;
  const CELL_H = 148;

  // Row 1: Winter
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(40, 60, 140);
  doc.text('▸  WINTER SOLSTICE  ·  21 JUNE', ML, y + 9);
  y += LABEL_H;

  for (let col = 0; col < 3; col++) {
    const cX = ML + col * (CELL_W + COL_GAP);
    const cY = y;
    const tr = makeCellTransform(ext, cX, cY, CELL_W, CELL_H);
    drawDiagramCell(doc, moments[col], building, posFeature, cX, cY, CELL_W, CELL_H, tr);
  }
  y += CELL_H + ROW_GAP;

  // Row 2: Summer
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(160, 50, 30);
  doc.text('▸  SUMMER SOLSTICE  ·  21 DECEMBER', ML, y + 9);
  y += LABEL_H;

  for (let col = 0; col < 3; col++) {
    const cX = ML + col * (CELL_W + COL_GAP);
    const cY = y;
    const tr = makeCellTransform(ext, cX, cY, CELL_W, CELL_H);
    drawDiagramCell(doc, moments[col + 3], building, posFeature, cX, cY, CELL_W, CELL_H, tr);
  }
  y += CELL_H + 10;

  // ── Legend ─────────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(80, 80, 80);
  let lx = ML;
  // Shadow swatch
  doc.setFillColor(200, 200, 205);
  doc.rect(lx, y, 9, 6, 'F');
  doc.text('Shadow envelope', lx + 12, y + 5);
  lx += 85;
  // Building swatch
  doc.setFillColor(70, 70, 75);
  doc.rect(lx, y, 9, 6, 'F');
  doc.text('Building footprint', lx + 12, y + 5);
  lx += 90;
  // POS swatch
  if (posFeature) {
    doc.setDrawColor(34, 139, 34);
    doc.setLineWidth(0.8);
    doc.rect(lx, y, 9, 6, 'D');
    doc.text('Principal private open space (POS)', lx + 12, y + 5);
  }
  y += 14;

  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.line(ML, y, A4W - MR, y);
  y += 10;

  // ── Compliance ─────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  doc.text('BCA OVERSHADOWING COMPLIANCE  ·  PRINCIPAL PRIVATE OPEN SPACE', ML, y + 8);
  y += 18;

  if (compliance) {
    const BADGE_W = 60, BADGE_H = 20;
    const [br, bg, bb] = compliance.pass ? [34, 139, 34] : [192, 44, 44];
    doc.setFillColor(br, bg, bb);
    doc.roundedRect(ML, y, BADGE_W, BADGE_H, 3, 3, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text(compliance.pass ? 'PASS' : 'FAIL', ML + BADGE_W / 2, y + 13, { align: 'center' });

    const tx = ML + BADGE_W + 10;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(0, 0, 0);
    doc.text(`${compliance.posPercent}% of POS area receives ≥3 hours of direct sun`, tx, y + 8);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(80, 80, 80);
    doc.text(`on winter solstice (21 Jun)  ·  requirement: ≥50%  ·  window: 9am–3pm`, tx, y + 18);
    doc.setFontSize(6.5);
    doc.setTextColor(130, 130, 130);
    doc.text(
      `Method: shadow sampled every 30 min (${compliance.total} POS grid pts at 2m resolution)`,
      tx, y + 27,
    );
    y += BADGE_H + 16;
  } else {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(130, 130, 130);
    doc.text(
      'No POS polygon defined — draw a POS area in the sidebar to enable compliance testing.',
      ML, y + 10,
    );
    y += 22;
  }

  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.line(ML, y, A4W - MR, y);
  y += 10;

  // ── Recommendations ────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  doc.text('DESIGN RECOMMENDATIONS', ML, y + 8);
  y += 18;

  for (const rec of recs) {
    // Bullet
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(0, 0, 0);
    doc.text('•', ML + 1, y);
    // Body text
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const wrapped = doc.splitTextToSize(rec, CW - 14);
    doc.text(wrapped, ML + 11, y);
    y += wrapped.length * 10.5 + 5;
  }

  // ── Footer ─────────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(6.5);
  doc.setTextColor(160, 160, 160);
  const footer =
    'Indicative analysis only. Shadow geometry uses OpenStreetMap building heights and SunCalc solar ' +
    'positions for Sydney (lat −33.89°S, lng 151.21°E). Compliance check samples shadow coverage at ' +
    '30-min intervals at 2 m grid resolution. Not a substitute for a licensed BCA / NCC assessment ' +
    'or planning consultant report.';
  doc.text(doc.splitTextToSize(footer, CW), ML, A4H - 26);

  const safe = (props.address || 'building').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  doc.save(`shadow-report-${safe}.pdf`);
}
