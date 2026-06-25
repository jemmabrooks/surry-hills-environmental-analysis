import { useRef, useCallback, useEffect } from 'react';
import Map from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { SURRY_HILLS, VIEW_2D_PITCH, VIEW_3D_PITCH } from '../constants';
import { BoundaryLayer } from './layers/BoundaryLayer';
import { BuildingsLayer } from './layers/BuildingsLayer';
import { ShadowsLayer } from './layers/ShadowsLayer';
import { AnalysisOverlay } from './layers/AnalysisOverlay';
import { WindRoseGroundLayer } from './layers/WindRoseGroundLayer';
import { WindArrows3DLayer } from './layers/WindArrows3DLayer';
import { SunPathOverlay } from './layers/SunPathOverlay';
import { SunPath2DLayer } from './layers/SunPath2DLayer';
import { ProposedBuildingLayer } from './layers/ProposedBuildingLayer';
import { DrawingPreviewLayer } from './layers/DrawingPreviewLayer';
import { PosLayer } from './layers/PosLayer';
import { FacadeGuideLayer } from './layers/FacadeGuideLayer';
import { centroidOf } from '../lib/geometry';

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';
const INTERACTIVE = ['buildings-fill', 'buildings-3d', 'proposed-building-fill', 'proposed-building-3d'];

export function MapView({
  buildings,
  existingShadows,
  proposedShadows,
  shadowsEnabled,
  windRoseEnabled,
  sunDiagramEnabled,
  view,
  selectedId,
  onSelectBuilding,
  flyTarget,
  analysisOverlay,
  selectedBuilding,
  allWindRose,
  windRoseMonth,
  year,
  month,
  day,
  hour,
  setHour,
  proposedBuilding,
  drawingMode,
  drawingPreview,
  onAddDrawingPoint,
  onFinishDrawing,
  posPolygon,
  posDrawingMode,
  posDrawingPreview,
  onAddPosPoint,
  onFinishPosDrawing,
  facadeGuideEnabled,
  wind,
}) {
  const mapRef = useRef(null);

  const handleClick = useCallback(
    (e) => {
      if (drawingMode) {
        onAddDrawingPoint([e.lngLat.lng, e.lngLat.lat]);
        return;
      }
      if (posDrawingMode) {
        onAddPosPoint([e.lngLat.lng, e.lngLat.lat]);
        return;
      }
      const feat = e.features?.[0];
      if (feat) {
        const id = feat.properties?.id ?? feat.id;
        if (id === '__proposed__') {
          if (proposedBuilding) onSelectBuilding(proposedBuilding);
          return;
        }
        const full = buildings?.features.find((b) => String(b.properties.id) === String(id));
        if (full) onSelectBuilding(full);
      }
    },
    [buildings, onSelectBuilding, drawingMode, posDrawingMode, onAddDrawingPoint, onAddPosPoint, proposedBuilding],
  );

  const handleDblClick = useCallback(
    (e) => {
      if (drawingMode) { e.preventDefault(); onFinishDrawing(); }
      else if (posDrawingMode) { e.preventDefault(); onFinishPosDrawing(); }
    },
    [drawingMode, posDrawingMode, onFinishDrawing, onFinishPosDrawing],
  );

  useEffect(() => {
    const map = mapRef.current?.getMap?.();
    if (!map) return;
    map.easeTo({ pitch: view === '3D' ? VIEW_3D_PITCH : VIEW_2D_PITCH, duration: 600 });
  }, [view]);

  useEffect(() => {
    const map = mapRef.current?.getMap?.();
    if (!map || !flyTarget) return;
    map.flyTo({ center: flyTarget.center, zoom: flyTarget.zoom ?? 17, duration: 1200 });
  }, [flyTarget]);

  return (
    <div className="absolute inset-0">
      <Map
        ref={mapRef}
        initialViewState={{
          longitude: SURRY_HILLS.center[0],
          latitude: SURRY_HILLS.center[1],
          zoom: SURRY_HILLS.defaultZoom,
          pitch: VIEW_2D_PITCH,
          bearing: 0,
        }}
        mapStyle={MAP_STYLE}
        interactiveLayerIds={INTERACTIVE}
        onClick={handleClick}
        onDblClick={handleDblClick}
        doubleClickZoom={!drawingMode && !posDrawingMode}
        dragRotate={false}
        touchZoomRotate={false}
        style={{ width: '100%', height: '100%', cursor: (drawingMode || posDrawingMode) ? 'crosshair' : 'default' }}
      >
        <BoundaryLayer />
        {/* Shadows before buildings in JSX = added to map first = visually beneath buildings.
            No beforeId needed — JSX order controls stacking. Proposed beneath existing. */}
        <ShadowsLayer
          data={proposedShadows}
          view={view}
          sourceId="proposed-shadows"
          color="#f59e0b"
          opacity={0.85}
        />
        <ShadowsLayer data={existingShadows} view={view} />
        <BuildingsLayer data={buildings} view={view} selectedId={selectedId} />
        {windRoseEnabled && selectedBuilding && allWindRose && view === '3D' && (
          <WindArrows3DLayer
            building={selectedBuilding}
            allWindRose={allWindRose}
            month={windRoseMonth}
          />
        )}
        {windRoseEnabled && selectedBuilding && allWindRose && view === '2D' && (
          <WindRoseGroundLayer
            building={selectedBuilding}
            allWindRose={allWindRose}
            month={windRoseMonth}
          />
        )}
        <DrawingPreviewLayer points={drawingPreview} />
        <DrawingPreviewLayer points={posDrawingPreview} color="#16a34a" sourceId="pos-preview" />
        <PosLayer posPolygon={posPolygon} />
        {facadeGuideEnabled && selectedBuilding && (
          <FacadeGuideLayer building={selectedBuilding} wind={wind} buildings={buildings} />
        )}
        <ProposedBuildingLayer building={proposedBuilding} view={view} />
        {analysisOverlay && (
          <AnalysisOverlay points={analysisOverlay.points} lines={analysisOverlay.lines} />
        )}
        {sunDiagramEnabled && view === '2D' && (
          <SunPath2DLayer
            year={year}
            month={month}
            day={day}
            hour={hour}
            setHour={setHour}
            center={selectedBuilding ? centroidOf(selectedBuilding) : SURRY_HILLS.center}
          />
        )}
        {sunDiagramEnabled && view === '3D' && (
          <SunPathOverlay
            year={year}
            month={month}
            day={day}
            hour={hour}
            setHour={setHour}
            building={selectedBuilding ?? null}
          />
        )}
      </Map>
    </div>
  );
}
