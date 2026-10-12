import { useEffect, useState } from 'react';
import { elapsedMs, msToNextSecond, type Timer } from '../model/timer';

/**
 * The moment (`performance.now()`) to draw the clocks at. What a clock shows
 * is always worked out from its timestamps; this only decides when to draw
 * again: when the `running` timer shows its next second, and as soon as the
 * page is visible again. A background tab whose timers the browser slows down
 * shows the right time the moment it is looked at.
 */
export function useNow(running: Timer | null): number {
  const [now, setNow] = useState(() => performance.now());

  useEffect(() => {
    if (running === null) return;
    const elapsed = elapsedMs(running, performance.now());
    // What is drawn is a second or more behind (a repaint came late): at once.
    const behind = Math.floor(elapsedMs(running, now) / 1000) !== Math.floor(elapsed / 1000);
    const wait = behind ? 0 : Math.ceil(msToNextSecond(elapsed));
    const id = window.setTimeout(() => setNow(performance.now()), wait);
    return () => window.clearTimeout(id);
  }, [running, now]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') setNow(performance.now());
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  return now;
}
