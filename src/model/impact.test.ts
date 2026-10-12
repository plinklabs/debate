// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { DebateConfig } from './config';
import { setSideLabel, setStepSeconds, setTopicText, removeTopic } from './edit';
import { replaceImpact } from './impact';
import { GRAFFITI_PRESET } from './presets';
import { emptySession, newDebate, type Session } from './session';

const current = GRAFFITI_PRESET.build('en');

/** Debate 1 on t1 with a vote counted; debate 2 on t2 without results; debate 3 on a topic already gone. */
function session(): Session {
  return {
    current: null,
    debates: [
      {
        ...newDebate('d1', 't1', current.format),
        records: { 'vote-before': { type: 'vote-before', votes: { pro: 12, con: 9 } } },
      },
      newDebate('d2', 't2', current.format),
      newDebate('d3', 't9', current.format),
    ],
  };
}

describe('replaceImpact', () => {
  it('finds nothing to say about the same setup', () => {
    const same: DebateConfig = JSON.parse(JSON.stringify(current));
    expect(replaceImpact(session(), current, same)).toEqual({
      debates: 3,
      withResults: 1,
      topicChanges: [],
      formatChanges: false,
    });
  });

  it('finds nothing to change without debates', () => {
    const other = GRAFFITI_PRESET.build('nl');
    expect(replaceImpact(emptySession(), current, setTopicText(other, 't1', 'X'))).toMatchObject({
      debates: 0,
      withResults: 0,
      topicChanges: [],
    });
  });

  it('names each debate whose statement changes, or goes', () => {
    const next = removeTopic(setTopicText(current, 't1', 'Homework should be banned.'), 't2');
    expect(replaceImpact(session(), current, next).topicChanges).toEqual([
      { number: 1, topic: { id: 't1', text: 'Homework should be banned.' } },
      { number: 2, topic: null },
    ]);
  });

  it('names a debate that gets a statement again under the id it refers to', () => {
    const next = { ...current, topics: [...current.topics, { id: 't9', text: 'Back again.' }] };
    expect(replaceImpact(session(), current, next).topicChanges).toEqual([
      { number: 3, topic: { id: 't9', text: 'Back again.' } },
    ]);
  });

  it('sees any change to the format: sides, team size, steps', () => {
    const changes: DebateConfig[] = [
      setSideLabel(current, 'pro', 'PRO'),
      { ...current, format: { ...current.format, teamSize: { min: 1, max: 3 } } },
      setStepSeconds(current, 'opening-pro', 75),
      { ...current, format: { ...current.format, steps: current.format.steps.slice(1) } },
    ];
    for (const next of changes) {
      expect(replaceImpact(session(), current, next).formatChanges).toBe(true);
    }
    // The topics alone are not the format.
    expect(replaceImpact(session(), current, setTopicText(current, 't3', 'X')).formatChanges).toBe(
      false,
    );
  });
});
