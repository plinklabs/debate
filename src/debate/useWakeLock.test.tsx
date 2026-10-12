import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { fakeWakeLock } from '../test/browserFakes';
import { useWakeLock } from './useWakeLock';

/** Let the wake lock's promises settle. */
const settle = () => act(async () => {});

const visibilityChange = () =>
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });

afterEach(() => {
  Reflect.deleteProperty(navigator, 'wakeLock');
});

describe('useWakeLock', () => {
  it('holds a wake lock while active and lets go of it after', async () => {
    const lock = fakeWakeLock();
    const { rerender, unmount } = renderHook(({ active }) => useWakeLock(active), {
      initialProps: { active: false },
    });
    await settle();
    expect(lock.request).not.toHaveBeenCalled();

    rerender({ active: true });
    await settle();
    expect(lock.request).toHaveBeenCalledWith('screen');
    expect(lock.held()).toBe(1);

    rerender({ active: false });
    await settle();
    expect(lock.held()).toBe(0);

    rerender({ active: true });
    await settle();
    expect(lock.held()).toBe(1);
    unmount();
    await settle();
    expect(lock.held()).toBe(0);
  });

  it('asks again when the page comes back, since a hidden page loses its lock', async () => {
    const lock = fakeWakeLock();
    renderHook(() => useWakeLock(true));
    await settle();
    expect(lock.request).toHaveBeenCalledTimes(1);

    lock.hide();
    visibilityChange();
    await settle();
    expect(lock.request).toHaveBeenCalledTimes(2);
    expect(lock.held()).toBe(1);

    // Still held: no second lock.
    visibilityChange();
    await settle();
    expect(lock.request).toHaveBeenCalledTimes(2);
  });

  it('lets go of a lock granted after the clock stopped', async () => {
    const lock = fakeWakeLock();
    const { rerender } = renderHook(({ active }) => useWakeLock(active), {
      initialProps: { active: true },
    });
    // Stopped before the request was granted.
    rerender({ active: false });
    await settle();
    expect(lock.request).toHaveBeenCalledTimes(1);
    expect(lock.held()).toBe(0);
  });

  it('carries on when the browser refuses, or has no wake lock', async () => {
    const refusing = fakeWakeLock({ refuse: true });
    const { unmount } = renderHook(() => useWakeLock(true));
    await settle();
    expect(refusing.request).toHaveBeenCalledTimes(1);
    unmount();

    refusing.remove();
    expect('wakeLock' in navigator).toBe(false);
    const { result } = renderHook(() => useWakeLock(true));
    await settle();
    expect(result.current).toBeUndefined();
  });
});
