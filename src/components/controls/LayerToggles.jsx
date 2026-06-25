import { Eyebrow } from '../ui/Card';

function Toggle({ label, checked, onChange }) {
  return (
    <label className="flex cursor-pointer items-center justify-between py-xxs">
      <span className="type-body-sm">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={onChange}
        className={`relative h-6 w-11 rounded-pill transition-colors ${
          checked ? 'bg-primary' : 'bg-hairline'
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-canvas transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </label>
  );
}

export function LayerToggles({ layers, toggleLayer }) {
  return (
    <div>
      <Eyebrow className="mb-xs">Analysis layers</Eyebrow>
      <Toggle label="Shadows" checked={layers.shadows} onChange={() => toggleLayer('shadows')} />
      <Toggle label="Wind rose" checked={layers.windRose} onChange={() => toggleLayer('windRose')} />
      <Toggle label="Sun diagram" checked={layers.sunDiagram} onChange={() => toggleLayer('sunDiagram')} />
      <Toggle label="Facade guide" checked={layers.facadeGuide} onChange={() => toggleLayer('facadeGuide')} />
    </div>
  );
}
