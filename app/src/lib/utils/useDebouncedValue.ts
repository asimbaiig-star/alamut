// Debounce a fast-changing value (typically a search input) so downstream
// effects/filters don't run on every keystroke.
import { useEffect, useState } from 'react';

export function useDebouncedValue<T>(value: T, delay = 220): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}
