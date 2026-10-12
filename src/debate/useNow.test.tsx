import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { IDLE_TIMER, startTimer, type Timer } from '../model/timer';
import { useNow } from './useNow';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('useNow', () => {
  it('draws again when the running clock shows its next second, and not before', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
    vi.advanceTimersByTime(10_000);
    // Started 250 ms ago: the next second shows in 750 ms.
    const timer = startTimer(IDLE_TIMER, performance.now() - 250);
    const { result } = renderHook(() => useNow(timer));
    const first = result.current;

    act(() => vi.advanceTimersByTime(749));
    expect(result.current).toBe(first);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe(first + 750);
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current).toBe(first + 1750);
  });

  it('catches up at once when what is drawn has fallen behind', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
    const timer = startTimer(IDLE_TIMER, performance.now());
    const { result } = renderHook(() => useNow(timer));
    const first = result.current;

    // Five seconds go by before the page gets to draw again: one repaint was
    // due, and once drawn it is seen to be behind, so the next comes at once.
    act(() => vi.advanceTimersByTime(5000));
    expect(result.current).toBe(first + 1000);
    act(() => vi.advanceTimersByTime(0));
    expect(result.current).toBe(first + 5000);
  });

  it('stays put while no clock runs', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
    const { result, rerender } = renderHook(({ timer }) => useNow(timer), {
      initialProps: { timer: null as Timer | null },
    });
    const first = result.current;
    act(() => vi.advanceTimersByTime(5000));
    expect(result.current).toBe(first);
    rerender({ timer: null });
    expect(result.current).toBe(first);
  });

  it('draws again as soon as the page is visible again, as a background tab comes back', () => {
    const clock = vi.spyOn(performance, 'now').mockReturnValue(1000);
    const { result } = renderHook(() => useNow(null));
    expect(result.current).toBe(1000);

    clock.mockReturnValue(61_000);
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(document.visibilityState).toBe('visible');
    expect(result.current).toBe(61_000);
  });
});
