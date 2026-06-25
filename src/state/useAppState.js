// Central app state shared between map and sidebar.
import { useState, useCallback, useMemo } from 'react';

function buildProposedFromPoints(points, height) {
  if (points.length < 3) return null;
  const ring = [...points, points[0]];
  return {
    type: 'Feature',
    properties: { id: '__proposed__', height, isProposed: true },
    geometry: { type: 'Polygon', coordinates: [ring] },
  };
}

export function useAppState() {
  // Time: a calendar date (year/month/day) + hour of day (float).
  const now = new Date();
  const [year, setYear] = useState(2026);
  const [month, setMonth] = useState(now.getMonth()); // 0-11
  const [day] = useState(15); // mid-month is representative
  const [hour, setHour] = useState(12);

  // View + layers
  const [view, setView] = useState('2D'); // '2D' | '3D'
  const [layers, setLayers] = useState({ shadows: false, windRose: true, sunDiagram: true, facadeGuide: false });

  // Selection + analysis
  const [selected, setSelected] = useState(null); // building feature
  const [analysisTab, setAnalysisTab] = useState(null); // 'solar' | 'ventilation' | 'glazing' | null

  // Proposed building — drawn as a freeform polygon
  const [drawingPoints, setDrawingPoints] = useState([]); // [[lng,lat], ...]
  const [drawingMode, setDrawingMode] = useState(false);  // actively adding vertices
  const [targetPoints, setTargetPoints] = useState(4);   // auto-close after N points
  const [proposedHeight, setProposedHeight] = useState(15);

  const proposedBuilding = useMemo(() => {
    if (drawingMode || drawingPoints.length < 3) return null;
    return buildProposedFromPoints(drawingPoints, proposedHeight);
  }, [drawingMode, drawingPoints, proposedHeight]);

  // in-progress preview GeoJSON (shown while drawing)
  const drawingPreview = useMemo(() => {
    if (!drawingMode && drawingPoints.length === 0) return null;
    return drawingPoints;
  }, [drawingMode, drawingPoints]);

  const addDrawingPoint = useCallback((lngLat) => {
    setDrawingPoints((prev) => [...prev, lngLat]);
  }, []);

  const undoLastPoint = useCallback(() => {
    setDrawingPoints((prev) => prev.slice(0, -1));
  }, []);

  const finishDrawing = useCallback(() => {
    setDrawingMode(false);
  }, []);

  const clearProposed = useCallback(() => {
    setDrawingPoints([]);
    setDrawingMode(false);
  }, []);

  // POS (principal private open space) polygon — drawn by user for shadow compliance
  const [posPoints, setPosPoints] = useState([]);
  const [posDrawingMode, setPosDrawingMode] = useState(false);
  const [posTargetPoints, setPosTargetPoints] = useState(4);

  const posPolygon = useMemo(() => {
    if (posDrawingMode || posPoints.length < 3) return null;
    const ring = [...posPoints, posPoints[0]];
    return {
      type: 'Feature',
      properties: { id: '__pos__', isPOS: true },
      geometry: { type: 'Polygon', coordinates: [ring] },
    };
  }, [posDrawingMode, posPoints]);

  const posDrawingPreview = useMemo(() => {
    if (!posDrawingMode && posPoints.length === 0) return null;
    return posPoints;
  }, [posDrawingMode, posPoints]);

  const addPosPoint = useCallback((lngLat) => {
    setPosPoints((prev) => {
      const next = [...prev, lngLat];
      if (next.length >= posTargetPoints) setPosDrawingMode(false);
      return next;
    });
  }, [posTargetPoints]);

  const undoLastPosPoint = useCallback(() => setPosPoints(p => p.slice(0, -1)), []);
  const finishPosDrawing = useCallback(() => setPosDrawingMode(false), []);
  const clearPos = useCallback(() => { setPosPoints([]); setPosDrawingMode(false); }, []);

  // Wind rose month (independent of time month)
  const [windRoseMonth, setWindRoseMonth] = useState(new Date().getMonth());

  const toggleLayer = useCallback((key) => {
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const selectBuilding = useCallback((feature) => {
    setSelected(feature);
    setAnalysisTab(null);
  }, []);

  return {
    year, month, day, hour, setYear, setMonth, setHour,
    view, setView,
    layers, toggleLayer,
    selected, selectBuilding, setSelected,
    analysisTab, setAnalysisTab,
    proposedBuilding, drawingPreview,
    drawingPoints, drawingMode, setDrawingMode,
    targetPoints, setTargetPoints,
    proposedHeight, setProposedHeight,
    addDrawingPoint, undoLastPoint, finishDrawing, clearProposed,
    posPolygon, posDrawingPreview,
    posPoints, posDrawingMode, setPosDrawingMode,
    posTargetPoints, setPosTargetPoints,
    addPosPoint, undoLastPosPoint, finishPosDrawing, clearPos,
    windRoseMonth, setWindRoseMonth,
  };
}
