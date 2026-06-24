import { useEffect, useState } from 'react';

// Returns `value` after it has stopped changing for `ms` milliseconds.
export function useDebounce(value, ms = 120) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}
