import { SearchBox } from './controls/SearchBox';
import { ViewToggle } from './controls/ViewToggle';
import { TimeControls } from './controls/TimeControls';
import { LayerToggles } from './controls/LayerToggles';
import { SelectedBuilding } from './analysis/SelectedBuilding';

function Divider() {
  return <hr className="my-md border-0 border-t border-hairline" />;
}

function Slider({ label, value, min, max, step, unit, onChange, accent = 'accent-ink' }) {
  return (
    <div>
      <div className="flex justify-between type-caption text-ink/50 mb-xs">
        <span>{label}</span>
        <span className="font-mono">{value}{unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className={`w-full ${accent}`} />
      <div className="flex justify-between type-caption text-ink/30 mt-xs">
        <span>{min}{unit}</span><span>{max}{unit}</span>
      </div>
    </div>
  );
}

const POS_POINT_OPTIONS = [3, 4, 5, 6];

function PosDrawingPanel({ state }) {
  const {
    posPolygon, posPoints, posDrawingMode, setPosDrawingMode,
    posTargetPoints, setPosTargetPoints,
    undoLastPosPoint, finishPosDrawing, clearPos,
  } = state;

  const hasPoints = posPoints.length > 0;
  const canClose = posPoints.length >= 3;

  return (
    <div className="mt-md pt-md border-t border-hairline">
      <div className="flex items-center gap-xs mb-xs">
        <span className="inline-block w-2 h-2 rounded-sm bg-green-600 flex-shrink-0" />
        <span className="type-caption text-ink/50">PRINCIPAL PRIVATE OPEN SPACE (POS)</span>
      </div>
      <p className="type-caption text-ink/40 mb-sm">
        Draw the adjacent open space polygon to enable BCA compliance testing in the shadow report.
      </p>

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

      {!hasPoints && !posDrawingMode && (
        <button
          onClick={() => setPosDrawingMode(true)}
          className="w-full rounded-md border-2 border-dashed border-green-400 py-xs text-center type-body-sm text-green-600 hover:bg-green-50 transition-colors"
        >
          + Draw POS polygon
        </button>
      )}

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

function ProposedBuildingPanel({ state }) {
  const {
    proposedBuilding, drawingPoints, drawingMode, setDrawingMode,
    proposedHeight, setProposedHeight,
    undoLastPoint, finishDrawing, clearProposed,
    layers, toggleLayer,
  } = state;

  const hasPoints = drawingPoints.length > 0;
  const canClose = drawingPoints.length >= 3;

  return (
    <div>
      <div className="type-caption mb-sm text-ink/50">PROPOSED BUILDING</div>

      {/* Idle — nothing drawn yet */}
      {!hasPoints && !drawingMode && (
        <button
          onClick={() => setDrawingMode(true)}
          className="w-full rounded-md border-2 border-dashed border-red-400 py-sm text-center type-body-sm text-red-500 hover:bg-red-50 transition-colors"
        >
          + Draw building footprint
        </button>
      )}

      {/* Active drawing */}
      {drawingMode && (
        <div className="space-y-xs">
          <div className="rounded-md bg-red-50 border border-red-200 px-md py-sm">
            <p className="type-body-sm text-red-600 font-medium">Click map to add points</p>
            <p className="type-caption text-red-400 mt-xxs">
              {drawingPoints.length === 0
                ? 'Click to place your first point'
                : `${drawingPoints.length} point${drawingPoints.length === 1 ? '' : 's'} placed — double-click or close to finish`}
            </p>
          </div>
          <div className="flex gap-xs">
            <button
              onClick={undoLastPoint}
              disabled={!hasPoints}
              className="flex-1 rounded-md border border-hairline py-xs type-body-sm text-ink/60 hover:text-ink disabled:opacity-30 transition-colors"
            >
              ↩ Undo
            </button>
            <button
              onClick={finishDrawing}
              disabled={!canClose}
              className="flex-1 rounded-md bg-red-500 text-white py-xs type-body-sm hover:bg-red-600 disabled:opacity-30 transition-colors"
            >
              Close shape
            </button>
          </div>
          <button
            onClick={clearProposed}
            className="w-full type-caption text-ink/30 hover:text-red-500 transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Shape drawn, not in drawing mode */}
      {hasPoints && !drawingMode && (
        <div className="space-y-sm">
          <div className="flex items-center gap-xs">
            <span className="inline-block w-3 h-3 rounded-sm bg-red-500 flex-shrink-0" />
            <span className="type-body-sm font-medium">Proposed building</span>
            <button onClick={clearProposed} className="ml-auto type-caption text-ink/40 hover:text-red-500">Remove</button>
          </div>

          <Slider
            label={`Height · ${Math.round(proposedHeight / 3)} storeys`}
            value={proposedHeight} min={3} max={150} step={3} unit=" m"
            onChange={setProposedHeight} accent="accent-red-500"
          />

          <button
            onClick={() => setDrawingMode(true)}
            className="w-full rounded-md border border-red-300 py-xs type-body-sm text-red-500 hover:bg-red-50 transition-colors"
          >
            Redraw footprint
          </button>

          {!layers.shadows && (
            <button onClick={() => toggleLayer('shadows')}
              className="w-full rounded-md bg-ink text-canvas py-xs type-body-sm hover:bg-ink/80 transition-colors">
              Enable shadows to see impact
            </button>
          )}

          <PosDrawingPanel state={state} />
        </div>
      )}
    </div>
  );
}


export function Sidebar({ open, setOpen, state, buildings, wind, windRose, proposedBuilding, onSearchResult }) {
  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        aria-label={open ? 'Collapse panel' : 'Expand panel'}
        className="absolute top-1/2 z-20 flex h-12 w-7 -translate-y-1/2 items-center justify-center rounded-l-md border border-r-0 border-hairline bg-canvas shadow-soft transition-all"
        style={{ right: open ? 'min(25vw, 100vw)' : 0, transform: 'translateY(-50%)' }}
      >
        <span className="type-body">{open ? '›' : '‹'}</span>
      </button>

      <aside
        className="absolute right-0 top-0 z-10 h-full overflow-y-auto border-l border-hairline bg-canvas/95 backdrop-blur transition-transform duration-300"
        style={{ width: 'min(25vw, 100vw)', minWidth: 320, transform: open ? 'translateX(0)' : 'translateX(100%)' }}
      >
        <div className="p-lg">
          <div className="mb-md">
            <div className="type-caption text-ink/50">Surry Hills</div>
            <h1 className="type-headline leading-tight">Environmental Analysis</h1>
          </div>

          <SearchBox onResult={onSearchResult} />
          <Divider />
          <ViewToggle view={state.view} setView={state.setView} />
          <Divider />
          <TimeControls
            year={state.year} month={state.month} day={state.day} hour={state.hour}
            setYear={state.setYear} setMonth={state.setMonth} setHour={state.setHour}
          />
          <Divider />
          <LayerToggles layers={state.layers} toggleLayer={state.toggleLayer} />
          <Divider />
          <ProposedBuildingPanel state={state} />
          <Divider />
          <SelectedBuilding
            building={state.selected}
            buildings={buildings}
            wind={wind}
            proposedBuilding={proposedBuilding}
            posState={state.selected ? state : null}
          />
        </div>
      </aside>
    </>
  );
}
