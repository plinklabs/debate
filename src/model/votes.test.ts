// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { clampVotes, voteShift } from './votes';

describe('voteShift', () => {
  it('measures the shift towards the topic in percentage points', () => {
    const shift = voteShift({ pro: 10, con: 15 }, { pro: 18, con: 7 });
    expect(shift.absolute).toBe(8);
    expect(shift.shareBefore).toBeCloseTo(0.4);
    expect(shift.shareAfter).toBeCloseTo(0.72);
    expect(shift.pp).toBeCloseTo(32);
  });

  it('stays fair when fewer people vote the second time', () => {
    // Fewer hands for the topic, but a larger share: the shift is towards it.
    const shift = voteShift({ pro: 10, con: 10 }, { pro: 6, con: 4 });
    expect(shift.absolute).toBe(-4);
    expect(shift.pp).toBeCloseTo(10);
  });

  it('has no shift in percentage points when nobody voted in one of the votes', () => {
    expect(voteShift({ pro: 0, con: 0 }, { pro: 5, con: 2 })).toEqual({
      absolute: 5,
      pp: null,
      shareBefore: null,
      shareAfter: 5 / 7,
    });
    expect(voteShift({ pro: 3, con: 1 }, { pro: 0, con: 0 }).pp).toBeNull();
  });
});

describe('clampVotes', () => {
  it.each([
    [-3, 0],
    [2.6, 3],
    [5000, 999],
    [Number.NaN, 0],
    [Number.POSITIVE_INFINITY, 0],
  ])('turns %d into %d', (input, expected) => {
    expect(clampVotes(input)).toBe(expected);
  });
});
