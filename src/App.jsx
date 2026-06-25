import { useEffect, useMemo, useState } from 'react';
import { MapView } from './components/MapView';
import { Sidebar } from './components/Sidebar';
import { useAppState } from './state/useAppState';
import { useDebounce } from './state/useDebounce';
import { fetchBuildings } from './data/overpass';
import { fetchMonthlyWind } from './data/openMeteo';
import { getSunPosition, sydneyDate } from './lib/sun';
import { buildShadowPolygons } from './lib/shadows';
import { scoreRoofZones } from './lib/solar';
import { assessVentilation } from './lib/ventilation';
import { assessGlazing, RISK_COLOR } from './lib/glazing';
import { computeWindFlowPaths } from './lib/windFlow';
import { centroidOf } from './lib/geometry';
import { Button } from './components/ui/Button';
import { SURRY_HILLS } from './constants';

export default function App() {
  const state = useAppState();
  const [buildings, setBuildings] = useState(null);
  const [monthlyWind, setMonthlyWind] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [open, setOpen] = useState(true);
  const [flyTarget, setFlyTarget] = useState(null);

  // Load buildings once on mount.
  useEffect(() => {
    let alive = true;
    fetchBuildings()
      .then((fc) => {
        if (!alive) return;
        setBuildings(fc);
        setStatus('ready');
      })
      .catch(() => alive && setStatus('error'));
    return () => { alive = false; };
  }, []);

  // Load monthly wind once on mount (non-blocking).
  useEffect(() => {
    fetchMonthlyWind().then(setMonthlyWind).catch(() => {});
  }, []);

  const wind = monthlyWind?.monthly?.[state.month] ?? null;
  const windRose = monthlyWind?.windRose?.[state.month] ?? null;

  // Debounce the time slider so shadow recompute stays smooth.
  const debouncedHour = useDebounce(state.hour, 250);
  const sun = useMemo(
    () => getSunPosition(sydneyDate(state.year, state.month, state.day, debouncedHour)),
    [state.year, state.month, state.day, debouncedHour],
  );

  const existingShadows = useMemo(() => {
    if (!state.layers.shadows || !buildings) return null;
    return buildShadowPolygons(buildings, sun);
  }, [state.layers.shadows, buildings, sun]);

  const proposedShadows = useMemo(() => {
    if (!state.layers.shadows || !state.proposedBuilding) return null;
    return buildShadowPolygons(
      { type: 'FeatureCollection', features: [state.proposedBuilding] },
      sun,
    );
  }, [state.layers.shadows, sun, state.proposedBuilding]);

  // Per-building analysis overlay (points + flow lines) for the selected tab.
  const analysisOverlay = useMemo(() => {
    if (!state.selected || !state.analysisTab) return null;
    return buildOverlay(state.selected, buildings, wind, state.analysisTab);
  }, [state.selected, state.analysisTab, buildings, wind]);

  // Fly to building when selected.
  useEffect(() => {
    if (state.selected) {
      setFlyTarget({ center: centroidOf(state.selected), zoom: 18.5 });
    }
  }, [state.selected]);

  const onSearchResult = (r) => {
    setFlyTarget({ center: [r.lng, r.lat], zoom: 18 });
    // Select nearest building to the geocoded point.
    if (buildings) {
      let best = null;
      let bestD = Infinity;
      for (const b of buildings.features) {
        const c = centroidOf(b);
        const d = (c[0] - r.lng) ** 2 + (c[1] - r.lat) ** 2;
        if (d < bestD) { bestD = d; best = b; }
      }
      if (best && bestD < 0.0000025) state.selectBuilding(best);
    }
  };

  // Fly back out to the whole-suburb view (and drop the building selection).
  const zoomToSuburb = () => {
    state.setSelected(null);
    state.setAnalysisTab(null);
    setFlyTarget({ center: SURRY_HILLS.center, zoom: SURRY_HILLS.defaultZoom });
  };

  const selectedId = state.selected?.properties?.id ?? null;

  return (
    <div className="relative h-full w-full overflow-hidden font-sans">
      <MapView
        buildings={buildings}
        existingShadows={existingShadows}
        proposedShadows={proposedShadows}
        shadowsEnabled={state.layers.shadows}
        windRoseEnabled={state.layers.windRose}
        sunDiagramEnabled={state.layers.sunDiagram}
        view={state.view}
        selectedId={selectedId}
        onSelectBuilding={state.selectBuilding}
        flyTarget={flyTarget}
        analysisOverlay={analysisOverlay}
        selectedBuilding={state.selected}
        allWindRose={monthlyWind?.windRose ?? null}
        windRoseMonth={state.month}
        year={state.year}
        month={state.month}
        day={state.day}
        hour={state.hour}
        setHour={state.setHour}
        proposedBuilding={state.proposedBuilding}
        drawingMode={state.drawingMode}
        drawingPreview={state.drawingPreview}
        onAddDrawingPoint={state.addDrawingPoint}
        onFinishDrawing={state.finishDrawing}
        posPolygon={state.posPolygon}
        posDrawingMode={state.posDrawingMode}
        posDrawingPreview={state.posDrawingPreview}
        onAddPosPoint={state.addPosPoint}
        onFinishPosDrawing={state.finishPosDrawing}
        facadeGuideEnabled={state.layers.facadeGuide}
        wind={wind}
      />

      {state.selected && (
        <div className="absolute left-md top-md z-20 flex flex-col gap-xs">
          <Button variant="secondary" onClick={zoomToSuburb} className="shadow-soft">
            ↖ Back to suburb
          </Button>
        </div>
      )}

      <Sidebar
        open={open}
        setOpen={setOpen}
        state={state}
        buildings={buildings}
        wind={wind}
        windRose={windRose}
        proposedBuilding={state.proposedBuilding}
        onSearchResult={onSearchResult}
      />

      {status !== 'ready' && (
        <div className="pointer-events-none absolute left-1/2 top-md z-30 -translate-x-1/2 rounded-pill bg-primary px-lg py-xs text-on-primary type-body-sm">
          {status === 'loading'
            ? 'Loading Surry Hills buildings…'
            : 'Could not load building data — check your connection.'}
        </div>
      )}
    </div>
  );
}

const ROLE_COLOR = { inlet: '#1ea64a', outlet: '#2d7dd2', neutral: '#9aa0a6' };

function buildOverlay(building, buildings, wind, tab) {
  const points = { type: 'FeatureCollection', features: [] };
  const lines = { type: 'FeatureCollection', features: [] };
  const pt = (coords, color) => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: coords },
    properties: { color },
  });

  if (tab === 'solar') {
    const { zones } = scoreRoofZones(building, buildings);
    const color = { best: '#1ea64a', ok: '#f3c01b', poor: '#e4572e' };
    for (const z of zones) points.features.push(pt(z.center, color[z.rating]));
  } else if (tab === 'ventilation') {
    const { faces } = assessVentilation(building, wind?.direction ?? 0);
    const c = centroidOf(building);
    for (const f of faces) {
      points.features.push(pt(f.midpoint, ROLE_COLOR[f.role]));
      if (f.role !== 'neutral') {
        lines.features.push({
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: [c, f.midpoint] },
          properties: { color: ROLE_COLOR[f.role] },
        });
      }
    }
  } else if (tab === 'glazing') {
    const { faces } = assessGlazing(building);
    for (const f of faces) points.features.push(pt(f.midpoint, RISK_COLOR[f.risk]));
  }

  return { points, lines };
}
