import { useState } from 'react';
import { Eyebrow } from '../ui/Card';
import { PillToggle } from '../ui/Button';
import { footprintArea, storeysOf } from '../../lib/geometry';
import { SolarPanel } from './SolarPanel';
import { VentilationPanel } from './VentilationPanel';
import { GlazingPanel } from './GlazingPanel';
import { ReportButton } from './ReportButton';
import { generateShadowReport } from '../../lib/shadowPdf';

const POS_POINT_OPTIONS = [3, 4, 5, 6];

function PosDrawingPanel({ state }) {
  const {
    posPolygon, posPoints, posDrawingMode, setPosDrawingMode,
    posTargetPoints, setPosTargetPoints,
    undoLastPosPoint, finishPosDrawing, clearPos,
  } = state;

  const hasPoints = posPoints.length > 0;
  const canClose  = posPoints.length >= 3;

  return (
    <div>
      <div className="flex items-center gap-xs mb-xs">
        <span className="inline-block w-2 h-2 rounded-sm bg-green-600 flex-shrink-0" />
        <span className="type-caption text-ink/50">PRINCIPAL PRIVATE OPEN SPACE (POS)</span>
      </div>
      <p className="type-caption text-ink/40 mb-sm">
        Draw the adjacent open space polygon to enable BCA compliance testing in the shadow report.
      </p>

      {/* Point count — only when nothing drawn yet */}
      {!hasPoints && (
        <div className="mb-sm">
          <div className="type-caption text-ink/40 mb-xs">Points</div>
          <div className="flex gap-xs">
            {POS_POINT_OPTIONS.map(n => (
              <button
                key={n}
                onClick={() => setPosTargetPoints(n)}
                className={`rounded-md px-sm py-xs type-body-sm border transition-colors ${
                  posTargetPoints === n
                    ? 'bg-green-600 text-white border-green-600'
                    : 'border-hairline text-ink/60 hover:border-green-500 hover:text-green-600'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Idle */}
      {!hasPoints && !posDrawingMode && (
        <button
          onClick={() => setPosDrawingMode(true)}
          className="w-full rounded-md border-2 border-dashed border-green-400 py-xs text-center type-body-sm text-green-600 hover:bg-green-50 transition-colors"
        >
          + Draw POS polygon
        </button>
      )}

      {/* Active */}
      {posDrawingMode && (
        <div className="space-y-xs">
          <div className="rounded-md bg-green-50 border border-green-200 px-md py-xs">
            <p className="type-body-sm text-green-700 font-medium">Click map to add points</p>
            <p className="type-caption text-green-500 mt-xxs">
              {posPoints.length === 0
                ? `Place your first of ${posTargetPoints} points`
                : `${posPoints.length} / ${posTargetPoints} points placed`}
            </p>
          </div>
          <div className="flex gap-xs">
            <button
              onClick={undoLastPosPoint}
              disabled={!hasPoints}
              className="flex-1 rounded-md border border-hairline py-xs type-body-sm text-ink/60 hover:text-ink disabled:opacity-30"
            >
              ↩ Undo
            </button>
            <button
              onClick={finishPosDrawing}
              disabled={!canClose}
              className="flex-1 rounded-md bg-green-600 text-white py-xs type-body-sm hover:bg-green-700 disabled:opacity-30"
            >
              Close shape
            </button>
          </div>
          <button onClick={clearPos} className="w-full type-caption text-ink/30 hover:text-red-500">Cancel</button>
        </div>
      )}

      {/* Drawn */}
      {hasPoints && !posDrawingMode && (
        <div className="flex items-center gap-xs">
          <span className="type-body-sm text-green-600 font-medium">POS polygon defined</span>
          <button onClick={() => setPosDrawingMode(true)} className="type-caption text-ink/40 hover:text-ink ml-auto">Redraw</button>
          <button onClick={clearPos} className="type-caption text-ink/40 hover:text-red-500">Remove</button>
        </div>
      )}
    </div>
  );
}

function ShadowReportButton({ building, posPolygon, disabled }) {
  const [generating, setGenerating] = useState(false);

  const handleClick = async () => {
    setGenerating(true);
    try {
      // Small delay so the button state renders before the synchronous PDF work
      await new Promise(r => setTimeout(r, 50));
      generateShadowReport(building, posPolygon ?? null);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={generating}
      className="w-full rounded-md bg-ink text-canvas py-sm type-body-sm font-medium hover:bg-ink/80 disabled:opacity-50 transition-colors flex items-center justify-center gap-xs"
    >
      {generating ? 'Generating…' : '↓ Shadow Analysis Report (PDF)'}
    </button>
  );
}

export function SelectedBuilding({ building, buildings, wind, windRose, analysisTab, setAnalysisTab, posState }) {
  if (!building) {
    return (
      <div>
        <Eyebrow className="mb-xs">Selected building</Eyebrow>
        <p className="type-body-sm text-ink/50">Click a building on the map to analyse it.</p>
      </div>
    );
  }

  const p = building.properties;
  const height = Math.round(p.height ?? 6);
  const areaM2 = Math.round(footprintArea(building));

  return (
    <div>
      <Eyebrow className="mb-xs">Selected building</Eyebrow>
      <h3 className="type-card-title">{p.address || 'Surry Hills building'}</h3>
      <p className="type-body-sm text-ink/60">
        Height ~{height} m ({storeysOf(p.height ?? 6)} storeys) · {areaM2.toLocaleString()} m²
      </p>

      <div className="mt-sm">
        <PillToggle
          value={analysisTab ?? ''}
          onChange={setAnalysisTab}
          options={[
            { value: 'solar', label: 'Solar' },
            { value: 'ventilation', label: 'Ventilation' },
            { value: 'glazing', label: 'Glazing' },
          ]}
        />
      </div>

      <div className="mt-md">
        {analysisTab === 'solar' && <SolarPanel building={building} buildings={buildings} />}
        {analysisTab === 'ventilation' && <VentilationPanel building={building} wind={wind} windRose={windRose} />}
        {analysisTab === 'glazing' && <GlazingPanel building={building} />}
      </div>

      <div className="mt-md">
        <ReportButton building={building} buildings={buildings} wind={wind} />
      </div>

      {posState && (
        <div className="mt-md pt-md border-t border-hairline space-y-sm">
          <PosDrawingPanel state={posState} />
          <ShadowReportButton
            building={building}
            posPolygon={posState.posPolygon}
          />
        </div>
      )}
    </div>
  );
}
