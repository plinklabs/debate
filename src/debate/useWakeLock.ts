import { useEffect } from 'react';

/**
 * Keeps the screen on while `active` (a clock runs), with the Screen Wake Lock
 * API where the browser has it. A wake lock ends when the page is hidden, so
 * it is asked for again when the page comes back. It is let go when `active`
 * turns false or the screen closes. Where the browser refuses (battery saver,
 * no support), the screen may dim as usual.
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
    const { wakeLock } = navigator;
    let lock: WakeLockSentinel | null = null;
    let done = false;

    const request = () => {
      if (document.visibilityState !== 'visible' || (lock !== null && !lock.released)) return;
      wakeLock.request('screen').then(
        (granted) => {
          if (done) void granted.release().catch(() => {});
          else lock = granted;
        },
        () => {
          // Refused: the screen may dim.
        },
      );
    };

    request();
    document.addEventListener('visibilitychange', request);
    return () => {
      done = true;
      document.removeEventListener('visibilitychange', request);
      if (lock !== null && !lock.released) void lock.release().catch(() => {});
    };
  }, [active]);
}
