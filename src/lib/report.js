// Single-page PDF building report (jsPDF, client-side).
import { jsPDF } from 'jspdf';
import { footprintArea, storeysOf } from './geometry';
import { solarSummary } from './solar';

// analyses: { solar, ventilation, glazing, wind:{direction,speed} }
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
