// What replacing the setup does to the debates this browser already has, so
// the app can say so before a shared setup (#5) takes the place of the
// current one. Replacing it keeps every debate, with its names and results;
// a debate refers to its topic and to the steps by id, so it then follows
// whatever the new setup has under those ids.

import type { DebateConfig, Topic } from './config';
import { hasResults, type Session } from './session';

export interface TopicChange {
  /** Position of the debate in the list, from 1. */
  readonly number: number;
  /** The debate's topic in the new setup; `null` when the new setup has none with its id. */
  readonly topic: Topic | null;
}

export interface ReplaceImpact {
  readonly debates: number;
  /** Debates with something recorded, or finished (`hasResults`). */
  readonly withResults: number;
  /** Debates whose statement reads differently in the new setup, or is not in it. */
  readonly topicChanges: readonly TopicChange[];
  /** The new setup has another format: other sides, team size or steps. */
  readonly formatChanges: boolean;
}

export function replaceImpact(
  session: Session,
  current: DebateConfig,
  next: DebateConfig,
): ReplaceImpact {
  const text = (config: DebateConfig, id: string) =>
    config.topics.find((topic) => topic.id === id)?.text;
  const topicChanges: TopicChange[] = [];
  session.debates.forEach((debate, index) => {
    if (text(current, debate.topicId) === text(next, debate.topicId)) return;
    const topic = next.topics.find((candidate) => candidate.id === debate.topicId) ?? null;
    topicChanges.push({ number: index + 1, topic });
  });
  return {
    debates: session.debates.length,
    withResults: session.debates.filter(hasResults).length,
    topicChanges,
    formatChanges: !sameData(current.format, next.format),
  };
}

/** Whether two plain values (objects, arrays, strings, numbers) hold the same data. */
function sameData(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every(
    (key) =>
      Object.hasOwn(b, key) &&
      sameData((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]),
  );
}
