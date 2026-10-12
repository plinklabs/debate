// Timer arithmetic. Every time value comes in as `now`: milliseconds on a
// monotonic clock (`performance.now()` in the browser, a plain number in the
// tests). A timer stores timestamps, never a tick count, so a throttled
// background tab or a slow projector laptop cannot make it lose time.
//
// Those timestamps only mean something within one page load. Before anything
// is stored, every running timer is paused at its elapsed time (`freeze` in
// reducer.ts); a reload restores it paused.

export interface Timer {
  /** Time accumulated in earlier running stretches. */
  readonly accMs: number;
  /** Start of the current running stretch, or `null` when paused. */
  readonly since: number | null;
}

export const IDLE_TIMER: Timer = { accMs: 0, since: null };

export function elapsedMs(timer: Timer, now: number): number {
  return timer.since === null ? timer.accMs : timer.accMs + Math.max(0, now - timer.since);
}

export function isRunning(timer: Timer): boolean {
  return timer.since !== null;
}

export function startTimer(timer: Timer, now: number): Timer {
  return timer.since === null ? { accMs: timer.accMs, since: now } : timer;
}

export function pauseTimer(timer: Timer, now: number): Timer {
  return timer.since === null ? timer : { accMs: elapsedMs(timer, now), since: null };
}

/** What a countdown shows: whole seconds left, or whole seconds over once it hits 0. */
export interface Countdown {
  readonly over: boolean;
  readonly seconds: number;
}

export function countdown(plannedSeconds: number, elapsed: number): Countdown {
  const leftMs = plannedSeconds * 1000 - elapsed;
  // Round up while counting down, so 0:00 shows exactly when time is up.
  if (leftMs > 0) return { over: false, seconds: Math.ceil(leftMs / 1000) };
  // Not `-leftMs`: at exactly 0 that is −0.
  return { over: true, seconds: Math.floor((elapsed - plannedSeconds * 1000) / 1000) };
}

/** `m:ss`, the same in every locale. */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** What gets recorded for a timed turn, in whole seconds. */
export interface Timing {
  readonly planned: number;
  readonly used: number;
  /** The team stopped early: planned − used. 0 when on or over time. */
  readonly rest: number;
  /** The team ran over: used − planned. 0 when on or under time. */
  readonly overtime: number;
}

export function timingOf(plannedSeconds: number, elapsed: number): Timing {
  // Rounded once, and rest and overtime derived from that integer, so that
  // used = planned − rest + overtime always holds in a report.
  const used = Math.round(elapsed / 1000);
  return {
    planned: plannedSeconds,
    used,
    rest: Math.max(0, plannedSeconds - used),
    overtime: Math.max(0, used - plannedSeconds),
  };
}
