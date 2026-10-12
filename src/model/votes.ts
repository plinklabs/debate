// The audience vote: hands for and against the topic, before and after the
// debate. Session data, never part of a config.

import type { Side } from './config';

/** Hands per side: `pro` agrees with the topic, `con` does not. */
export type Votes = Readonly<Record<Side, number>>;

export const NO_VOTES: Votes = { pro: 0, con: 0 };

export const MAX_VOTES = 999;

/** A count as typed in: a whole number from 0 to `MAX_VOTES`. */
export function clampVotes(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(MAX_VOTES, Math.max(0, Math.round(value)));
}

export interface Shift {
  /** Hands for after minus hands for before. */
  readonly absolute: number;
  /** Share for after minus share for before, in percentage points. */
  readonly pp: number | null;
  /** Share for the topic, from 0 to 1, or `null` when nobody voted. */
  readonly shareBefore: number | null;
  readonly shareAfter: number | null;
}

function shareFor(votes: Votes): number | null {
  const total = votes.pro + votes.con;
  return total > 0 ? votes.pro / total : null;
}

/**
 * The criterion is the shift, not the count. Percentage points stay comparable
 * when the number of voters changes between the two votes; with nobody voting
 * in one of them there is no share, and so no shift in percentage points.
 */
export function voteShift(before: Votes, after: Votes): Shift {
  const shareBefore = shareFor(before);
  const shareAfter = shareFor(after);
  return {
    absolute: after.pro - before.pro,
    pp: shareBefore !== null && shareAfter !== null ? (shareAfter - shareBefore) * 100 : null,
    shareBefore,
    shareAfter,
  };
}
