import { within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithI18n } from '../test/i18n';
import { Countdown } from './Countdown';

/** A step's clock of `planned` seconds, paused after `elapsed` ms. */
function renderClock(planned: number, elapsed: number) {
  const { container, unmount } = renderWithI18n(
    <Countdown
      clock={{ side: null, seconds: planned, timer: { accMs: elapsed, since: null } }}
      now={0}
      label="Time"
    />,
  );
  const digits = within(container).getByRole('timer', { name: 'Time' });
  const shown = { text: digits.textContent, chars: digits.style.getPropertyValue('--chars') };
  unmount();
  return shown;
}

// How many characters the digits are sized for, so that they fit their column
// (#15); the layout itself is checked end to end, in e2e/debate.spec.ts.
describe('the characters a clock is sized for', () => {
  it('are those of the time shown', () => {
    expect(renderClock(60, 40_000)).toEqual({ text: '0:20', chars: '4' });
  });

  it('grow with the overtime', () => {
    expect(renderClock(60, 72_000)).toEqual({ text: '+0:12', chars: '5' });
    expect(renderClock(60, 660_000)).toEqual({ text: '+10:00', chars: '6' });
    expect(renderClock(900, 6_900_000)).toEqual({ text: '+100:00', chars: '7' });
  });

  it('are those of the time planned while that is longer, so the clock keeps its size', () => {
    expect(renderClock(900, 0)).toEqual({ text: '15:00', chars: '5' });
    expect(renderClock(900, 301_000)).toEqual({ text: '9:59', chars: '5' });
  });
});
