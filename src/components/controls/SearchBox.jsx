import { useState } from 'react';
import { geocode } from '../../data/nominatim';

export function SearchBox({ onResult }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const search = async (e) => {
    e.preventDefault();
    if (!q.trim()) return;
    setLoading(true);
    try {
      const r = await geocode(q);
      setResults(r);
      if (r.length) onResult(r[0]);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative">
      <form onSubmit={search} className="flex items-center gap-xs">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search address…"
          className="type-body-sm w-full rounded-md border border-hairline bg-canvas px-sm py-xs outline-none focus:ring-2 focus:ring-primary"
        />
        <button
          type="submit"
          aria-label="Search"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-soft"
        >
          {loading ? '…' : '🔍'}
        </button>
      </form>
      {results.length > 1 && (
        <ul className="absolute z-10 mt-xxs w-full rounded-md border border-hairline bg-canvas shadow-soft">
          {results.map((r, i) => (
            <li key={i}>
              <button
                onClick={() => { onResult(r); setResults([]); }}
                className="type-caption block w-full truncate px-sm py-xs text-left normal-case hover:bg-surface-soft"
              >
                {r.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
