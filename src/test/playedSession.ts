// A session as a class leaves it, for the report tests (#7): the graffiti
// format, debate 1 played and finished, debate 2 begun, debate 3 with names
// only. Time is in seconds on a fake clock.
import type { DebateConfig } from '../model/config';
import { GRAFFITI_PRESET } from '../model/presets';
import { initialState, reducer, type Action, type AppState } from '../model/reducer';

const at = (seconds: number) => seconds * 1000;

/** Names for the four students of debate 1; the last one can be anything typed. */
export interface PlayedNames {
  readonly ann?: string;
  readonly eva?: string;
}

/**
 * Debate 1 on t1, finished: votes 10–15 before and 13–11 after; the opening
 * for 72 s (12 over) by Ann then Bert; the opening against 45 s (15 early) by
 * Dirk; the free round 8 s for (Ann, then Bert later) and 12 s against (Eva).
 * Debate 2 on t2: only the vote before, 8–0. Debate 3 on t3: names, nothing
 * recorded.
 */
export function playedSession(
  config: DebateConfig = GRAFFITI_PRESET.build('en'),
  { ann = 'Ann', eva = 'Eva' }: PlayedNames = {},
): AppState {
  const names = (debateId: string, pro: string[], con: string[]): Action[] => [
    ...pro.map((name, slot): Action => ({ type: 'set-name', debateId, side: 'pro', slot, name })),
    ...con.map((name, slot): Action => ({ type: 'set-name', debateId, side: 'con', slot, name })),
  ];
  const actions: Action[] = [
    { type: 'add-debate', topicId: 't1' },
    ...names('d1', [ann, 'Bert'], ['Dirk', eva]),
    { type: 'open-debate', debateId: 'd1', now: 0 },
    { type: 'set-votes', side: 'pro', value: 10 },
    { type: 'set-votes', side: 'con', value: 15 },
    { type: 'next-step', now: 0 },
    { type: 'tap-speaker', side: 'pro', slot: 0, now: at(0) },
    { type: 'tap-speaker', side: 'pro', slot: 1, now: at(30) },
    { type: 'next-step', now: at(72) },
    { type: 'tap-speaker', side: 'con', slot: 0, now: at(72) },
    { type: 'go-to-step', step: 6, now: at(117) },
    { type: 'tap-speaker', side: 'pro', slot: 0, now: at(120) },
    { type: 'tap-speaker', side: 'con', slot: 1, now: at(125) },
    { type: 'tap-speaker', side: 'pro', slot: 1, now: at(137) },
    { type: 'go-to-step', step: 9, now: at(140) },
    { type: 'set-votes', side: 'pro', value: 13 },
    { type: 'set-votes', side: 'con', value: 11 },
    { type: 'finish-debate', now: at(141) },
    { type: 'add-debate', topicId: 't2' },
    ...names('d2', ['Fien', 'Gert'], ['Hanne', 'Ilse']),
    { type: 'open-debate', debateId: 'd2', now: at(200) },
    { type: 'set-votes', side: 'pro', value: 8 },
    { type: 'close-debate', now: at(200) },
    { type: 'add-debate', topicId: 't3' },
    ...names('d3', ['Jan', 'Kim'], ['Lot', 'Mo']),
  ];
  return actions.reduce(reducer, initialState(config));
}
