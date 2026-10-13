// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { fakeServiceWorker } from '../test/serviceWorker';
import { SKIP_WAITING, createUpdates } from './updates';

function setUp(options?: { controlled?: boolean }) {
  const reload = vi.fn();
  const updates = createUpdates(reload);
  const sw = fakeServiceWorker(options);
  const changes = vi.fn();
  updates.subscribe(changes);
  return { reload, updates, sw, changes };
}

describe('updates', () => {
  it('offers a new version once it is installed and waiting', () => {
    const { updates, sw, changes } = setUp();
    updates.watch(sw.registration, sw.container);
    expect(updates.ready()).toBe(false);

    sw.find();
    expect(updates.ready()).toBe(false);
    sw.install();
    expect(updates.ready()).toBe(true);
    expect(changes).toHaveBeenCalledTimes(1);
  });

  it('offers a version that was waiting, or installing, when the page loaded', () => {
    const waiting = setUp();
    waiting.sw.deploy();
    waiting.updates.watch(waiting.sw.registration, waiting.sw.container);
    expect(waiting.updates.ready()).toBe(true);

    const installing = setUp();
    installing.sw.find();
    installing.updates.watch(installing.sw.registration, installing.sw.container);
    expect(installing.updates.ready()).toBe(false);
    installing.sw.install();
    expect(installing.updates.ready()).toBe(true);
  });

  it('offers nothing on the first visit, where the first version takes over at once', () => {
    const { updates, sw, changes } = setUp({ controlled: false });
    updates.watch(sw.registration, sw.container);
    sw.deploy();
    sw.takeOver();
    expect(updates.ready()).toBe(false);
    expect(changes).not.toHaveBeenCalled();
  });

  it('never lets the new version take over, nor reloads, by itself', () => {
    const { updates, sw, reload } = setUp();
    updates.watch(sw.registration, sw.container);
    const worker = sw.deploy();
    expect(worker.messages).toEqual([]);

    // Another tab lets it take over: this page goes on as it was.
    sw.takeOver();
    expect(reload).not.toHaveBeenCalled();
    expect(updates.ready()).toBe(true);
  });

  it('on the click, asks the waiting version to take over, and reloads once it has', () => {
    const { updates, sw, reload } = setUp();
    updates.watch(sw.registration, sw.container);
    const worker = sw.deploy();

    updates.apply();
    updates.apply();
    expect(worker.messages).toEqual([{ type: SKIP_WAITING }]);
    expect(reload).not.toHaveBeenCalled();

    sw.takeOver();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('reloads at once on the click when another tab let the new version take over', () => {
    const { updates, sw, reload } = setUp();
    updates.watch(sw.registration, sw.container);
    const worker = sw.deploy();
    sw.takeOver();

    updates.apply();
    expect(worker.messages).toEqual([]);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('does nothing on apply while no version waits', () => {
    const { updates, sw, reload } = setUp();
    updates.apply();
    updates.watch(sw.registration, sw.container);
    updates.apply();
    expect(reload).not.toHaveBeenCalled();
  });

  it('stops following the registration when asked', () => {
    const { updates, sw } = setUp();
    const stop = updates.watch(sw.registration, sw.container);
    sw.find();
    stop();
    sw.install();
    sw.find();
    sw.install();
    expect(updates.ready()).toBe(false);
  });
});
