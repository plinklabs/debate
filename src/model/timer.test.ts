// @vitest-environment node
// The model runs without a DOM: these tests run in plain Node.
import { describe, expect, it } from 'vitest';
import {
  IDLE_TIMER,
  countdown,
  elapsedMs,
  formatClock,
  isRunning,
  pauseTimer,
  startTimer,
  timingOf,
} from './timer';

describe('timer', () => {
  it('measures elapsed time from timestamps across running stretches', () => {
    let timer = startTimer(IDLE_TIMER, 1000);
    expect(isRunning(timer)).toBe(true);
    expect(elapsedMs(timer, 4000)).toBe(3000);

    timer = pauseTimer(timer, 4000);
    expect(isRunning(timer)).toBe(false);
    expect(elapsedMs(timer, 99_000)).toBe(3000);

    timer = startTimer(timer, 10_000);
    expect(elapsedMs(timer, 12_500)).toBe(5500);
  });

  it('ignores a start while running and a pause while paused', () => {
    const running = startTimer(IDLE_TIMER, 1000);
    expect(startTimer(running, 5000)).toBe(running);
    expect(pauseTimer(IDLE_TIMER, 5000)).toBe(IDLE_TIMER);
  });

  it('never counts backwards when the clock reads earlier than the start', () => {
    expect(elapsedMs(startTimer(IDLE_TIMER, 1000), 500)).toBe(0);
  });
});

describe('countdown', () => {
  it('rounds up while time is left, so 0:00 shows exactly at time up', () => {
    expect(countdown(60, 0)).toEqual({ over: false, seconds: 60 });
    expect(countdown(60, 100)).toEqual({ over: false, seconds: 60 });
    expect(countdown(60, 59_001)).toEqual({ over: false, seconds: 1 });
    expect(countdown(60, 60_000)).toEqual({ over: true, seconds: 0 });
  });

  it('counts the overtime in whole seconds', () => {
    expect(countdown(60, 72_900)).toEqual({ over: true, seconds: 12 });
  });

  it('formats as m:ss', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(90)).toBe('1:30');
    expect(formatClock(605.7)).toBe('10:05');
    expect(formatClock(-3)).toBe('0:00');
  });
});

describe('timingOf', () => {
  it('records rest when a team stops early and overtime when it runs over', () => {
    expect(timingOf(60, 55_000)).toEqual({ planned: 60, used: 55, rest: 5, overtime: 0 });
    expect(timingOf(90, 100_400)).toEqual({ planned: 90, used: 100, rest: 0, overtime: 10 });
    expect(timingOf(30, 30_000)).toEqual({ planned: 30, used: 30, rest: 0, overtime: 0 });
  });

  it('keeps used = planned − rest + overtime after rounding', () => {
    for (const elapsed of [0, 499, 500, 29_501, 30_499, 30_500, 61_234]) {
      const t = timingOf(30, elapsed);
      expect(t.used).toBe(t.planned - t.rest + t.overtime);
    }
  });
});
