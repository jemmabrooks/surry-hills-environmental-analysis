import { SearchBox } from './controls/SearchBox';
import { ViewToggle } from './controls/ViewToggle';
import { TimeControls } from './controls/TimeControls';
import { LayerToggles } from './controls/LayerToggles';
import { SelectedBuilding } from './analysis/SelectedBuilding';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

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

const POINT_OPTIONS = [3, 4, 5, 6, 7, 8];

function ProposedBuildingPanel({ state }) {
  const {
    proposedBuilding, drawingPoints, drawingMode, setDrawingMode,
    targetPoints, setTargetPoints,
    proposedHeight, setProposedHeight,
    addDrawingPoint, undoLastPoint, finishDrawing, clearProposed,
    layers, toggleLayer,
  } = state;

  const hasPoints = drawingPoints.length > 0;
  const canClose = drawingPoints.length >= 3;

  return (
    <div>
      <div className="type-caption mb-sm text-ink/50">PROPOSED BUILDING</div>

      {/* Point count selector — always visible when not actively drawing a placed shape */}
      {!hasPoints && (
        <div className="mb-sm">
          <div className="type-caption text-ink/50 mb-xs">Number of points</div>
          <div className="flex gap-xs flex-wrap">
            {POINT_OPTIONS.map((n) => (
              <button
                key={n}
                onClick={() => setTargetPoints(n)}
                className={`rounded-md px-sm py-xs type-body-sm border transition-colors ${
                  targetPoints === n
                    ? 'bg-red-500 text-white border-red-500'
                    : 'border-hairline text-ink/60 hover:border-red-400 hover:text-red-500'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      )}

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
                ? `Place your first of ${targetPoints} points`
                : `${drawingPoints.length} / ${targetPoints} points placed`}
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
        </div>
      )}
    </div>
  );
}

function WindRoseMonthPanel({ state }) {
  if (!state.selected) return null;
  return (
    <div>
      <div className="type-caption mb-xs text-ink/50">WIND ROSE</div>
      <p className="type-body-sm text-ink/60">
        Showing {MONTHS[state.month]} prevailing wind frequency &amp; direction.
        Change month via the Time controls above.
      </p>
    </div>
  );
}

export function Sidebar({ open, setOpen, state, buildings, wind, windRose, onSearchResult }) {
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
          {state.selected && <><Divider /><WindRoseMonthPanel state={state} /></>}
          <Divider />
          <SelectedBuilding
            building={state.selected}
            buildings={buildings}
            wind={wind}
            windRose={windRose}
            analysisTab={state.analysisTab}
            setAnalysisTab={state.setAnalysisTab}
            posState={state.selected ? state : null}
          />
        </div>
      </aside>
    </>
  );
}
