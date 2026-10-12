import { useEffect, useRef, useState } from 'react';
import type { StepClock } from '../model/session';
import { elapsedMs } from '../model/timer';

/** How long the signal on screen lasts when time is up, in ms. */
export const SIGNAL_MS = 3000;

/** Whether each clock seen so far was over time, by key. */
export type OverTime = ReadonlyMap<string, boolean>;

export interface ClockLook {
  readonly key: string;
  readonly over: boolean;
}

/**
 * What the clocks on screen show now, and whether one of them just ran out:
 * it was seen with time left before and is over time now. A clock seen for
 * the first time does not count (a step that is over time comes back on
 * screen, the page was reloaded), nor does one that was over time already.
 */
export function lookAt(
  seen: OverTime,
  clocks: readonly ClockLook[],
): { readonly seen: OverTime; readonly ranOut: boolean } {
  const next = new Map(seen);
  let ranOut = false;
  for (const { key, over } of clocks) {
    if (over && seen.get(key) === false) ranOut = true;
    next.set(key, over);
  }
  return { seen: next, ranOut };
}

export interface TimeUpSignal {
  /** The signal shows. */
  readonly on: boolean;
  /** How many times time ran out; a new value starts the signal again. */
  readonly count: number;
}

/**
 * Watches the clocks of the step on screen (`scope` names it) as drawn at
 * `now`. When one reaches zero, `onTimeUp` runs once and the signal shows for
 * `SIGNAL_MS`.
 */
export function useTimeUp(
  scope: string,
  clocks: readonly StepClock[],
  now: number,
  onTimeUp: () => void,
): TimeUpSignal {
  const seen = useRef<OverTime>(new Map());
  const callback = useRef(onTimeUp);
  const [signal, setSignal] = useState({ count: 0, on: false, scope });

  useEffect(() => {
    callback.current = onTimeUp;
  });

  useEffect(() => {
    const looks = clocks.map((clock) => ({
      key: `${scope}:${clock.side ?? ''}`,
      over: elapsedMs(clock.timer, now) >= clock.seconds * 1000,
    }));
    const look = lookAt(seen.current, looks);
    seen.current = look.seen;
    if (!look.ranOut) return;
    setSignal((last) => ({ count: last.count + 1, on: true, scope }));
    callback.current();
  }, [scope, clocks, now]);

  useEffect(() => {
    if (!signal.on) return;
    const id = window.setTimeout(() => setSignal((last) => ({ ...last, on: false })), SIGNAL_MS);
    return () => window.clearTimeout(id);
  }, [signal]);

  // The signal belongs to its step: moving on ends it.
  return { on: signal.on && signal.scope === scope, count: signal.count };
}
