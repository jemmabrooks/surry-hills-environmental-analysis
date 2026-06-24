import { PillToggle } from '../ui/Button';
import { Eyebrow } from '../ui/Card';

export function ViewToggle({ view, setView }) {
  return (
    <div>
      <Eyebrow className="mb-xs">View</Eyebrow>
      <PillToggle
        value={view}
        onChange={setView}
        options={[
          { value: '2D', label: '2D' },
          { value: '3D', label: '3D' },
        ]}
      />
    </div>
  );
}
