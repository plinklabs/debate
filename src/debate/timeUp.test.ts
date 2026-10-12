import { describe, expect, it } from 'vitest';
import { lookAt, type OverTime } from './timeUp';

describe('lookAt', () => {
  const none: OverTime = new Map();

  it('sees time run out when a clock seen with time left is over time now', () => {
    const before = lookAt(none, [{ key: 'd1:opening:', over: false }]);
    expect(before.ranOut).toBe(false);
    const after = lookAt(before.seen, [{ key: 'd1:opening:', over: true }]);
    expect(after.ranOut).toBe(true);
  });

  it('sees it once: a clock that stays over time does not run out again', () => {
    const first = lookAt(new Map([['k', false]]), [{ key: 'k', over: true }]);
    expect(lookAt(first.seen, [{ key: 'k', over: true }]).ranOut).toBe(false);
  });

  it('does not count a clock that is over time the first time it is seen', () => {
    // A step that is over time comes back on screen, or the page was reloaded.
    expect(lookAt(none, [{ key: 'k', over: true }]).ranOut).toBe(false);
  });

  it('counts again once the clock has time left again (the step was cleared)', () => {
    const cleared = lookAt(new Map([['k', true]]), [{ key: 'k', over: false }]);
    expect(lookAt(cleared.seen, [{ key: 'k', over: true }]).ranOut).toBe(true);
  });

  it('watches each clock of a free round on its own, and remembers clocks off screen', () => {
    const seen = new Map([
      ['free:pro', false],
      ['free:con', false],
      ['other:', false],
    ]);
    const look = lookAt(seen, [
      { key: 'free:pro', over: false },
      { key: 'free:con', over: true },
    ]);
    expect(look.ranOut).toBe(true);
    expect(look.seen.get('other:')).toBe(false);
    expect(look.seen.get('free:con')).toBe(true);
    // The map that came in is left as it was.
    expect(seen.get('free:con')).toBe(false);
  });
});
