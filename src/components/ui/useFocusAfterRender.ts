import { useCallback, useEffect, useRef } from 'react';

/**
 * Focus the element with an id after the next render. For when the element
 * that has the focus goes away (a removed item) or a new one appears that
 * the keyboard should land on (an added item).
 */
export function useFocusAfterRender(): (id: string) => void {
  const pending = useRef<string | null>(null);

  useEffect(() => {
    if (pending.current === null) return;
    document.getElementById(pending.current)?.focus();
    pending.current = null;
  });

  return useCallback((id: string) => {
    pending.current = id;
  }, []);
}
