// Keeps the app state in this browser between page loads (localStorage, under
// a versioned key). Every timer is paused before the state is written, so a
// reload brings the timers back paused at their elapsed time.
//
// Reading back is defensive: whatever does not have the expected shape falls
// back to a default instead of crashing the app in front of the class. The
// stored setup goes through the same validation as a link or a file.

import { LIMITS, isValidId, type DebateConfig, type Side } from './config';
import { freeze, initialState, type AppState } from './reducer';
import {
  MAX_NAME_LENGTH,
  type Debate,
  type FreeRoundRecord,
  type Session,
  type StepRecord,
  type Teams,
} from './session';
import type { Timer } from './timer';
import { parseConfig } from './validate';
import { clampVotes, type Votes } from './votes';

export const STORAGE_KEY = 'plinklabs:debate:v1';

const STORAGE_VERSION = 1;

/** The part of the Web Storage API this needs; `window.localStorage` fits. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function serializeState(state: AppState, now: number): string {
  const { config, session } = freeze(state, now);
  return JSON.stringify({ version: STORAGE_VERSION, config, session });
}

/**
 * The state in `raw`, or `null` when there is nothing usable. A stored setup
 * that no longer validates is replaced by `fallbackConfig`; the session is
 * kept, so names and results are not lost.
 */
export function deserializeState(
  raw: string | null,
  fallbackConfig: DebateConfig,
): AppState | null {
  if (raw === null) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isObject(data) || data.version !== STORAGE_VERSION) return null;
  const parsed = parseConfig(data.config);
  return {
    config: parsed.ok ? parsed.config : fallbackConfig,
    session: readSession(data.session),
  };
}

/**
 * The stored state, or a fresh one with `fallbackConfig`. `store` is a
 * function because merely reading `window.localStorage` throws when storage is
 * blocked; pass `() => window.localStorage`.
 */
export function loadState(store: () => KeyValueStore, fallbackConfig: DebateConfig): AppState {
  try {
    const stored = deserializeState(store().getItem(STORAGE_KEY), fallbackConfig);
    return stored ?? initialState(fallbackConfig);
  } catch {
    return initialState(fallbackConfig);
  }
}

/**
 * Store the state with every timer paused at `now`. Returns `false` when
 * storage is blocked or full (a private window, say): the app then keeps
 * working in memory.
 */
export function saveState(store: () => KeyValueStore, state: AppState, now: number): boolean {
  try {
    store().setItem(STORAGE_KEY, serializeState(state, now));
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Readers
// ---------------------------------------------------------------------------

type Json = Record<string, unknown>;

function isObject(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function objectOr(value: unknown): Json {
  return isObject(value) ? value : {};
}

function listOr(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function count(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
}

function readSide(value: unknown): Side | null {
  return value === 'pro' || value === 'con' ? value : null;
}

function readSlot(value: unknown): number | null {
  return typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0 &&
    value < LIMITS.teamSize.max
    ? value
    : null;
}

function isSlot(value: number | null): value is number {
  return value !== null;
}

/** Always paused: a stored `since` belongs to another page load. */
function pausedTimer(value: unknown): Timer {
  return { accMs: count(objectOr(value).accMs), since: null };
}

function readVotes(value: unknown): Votes {
  const votes = objectOr(value);
  return { pro: clampVotes(count(votes.pro)), con: clampVotes(count(votes.con)) };
}

function readSession(value: unknown): Session {
  const data = objectOr(value);
  const debates: Debate[] = [];
  for (const item of listOr(data.debates)) {
    const debate = readDebate(item);
    if (debate !== null && !debates.some((other) => other.id === debate.id)) debates.push(debate);
  }
  const current = debates.find((debate) => debate.id === data.current)?.id ?? null;
  return { debates, current };
}

function readDebate(value: unknown): Debate | null {
  if (!isObject(value) || !isValidId(value.id) || !isValidId(value.topicId)) return null;
  return {
    id: value.id,
    topicId: value.topicId,
    teams: readTeams(value.teams),
    step: count(value.step),
    records: readRecords(value.records),
    done: value.done === true,
  };
}

function readTeams(value: unknown): Teams {
  const teams = objectOr(value);
  const names = (list: unknown) =>
    listOr(list)
      .slice(0, LIMITS.teamSize.max)
      .map((name) => (typeof name === 'string' ? name.slice(0, MAX_NAME_LENGTH) : ''));
  return { pro: names(teams.pro), con: names(teams.con) };
}

function readRecords(value: unknown): Record<string, StepRecord> {
  const records: Record<string, StepRecord> = {};
  for (const [id, raw] of Object.entries(objectOr(value))) {
    const record = isValidId(id) ? readRecord(raw) : null;
    if (record !== null) records[id] = record;
  }
  return records;
}

function readRecord(value: unknown): StepRecord | null {
  if (!isObject(value)) return null;
  const type = value.type;
  switch (type) {
    case 'speech': {
      const slots = listOr(value.speakers).map(readSlot).filter(isSlot);
      const speakers = slots.filter((slot, index) => slots.indexOf(slot) === index);
      const current = readSlot(value.current);
      return {
        type,
        timer: pausedTimer(value.timer),
        speakers,
        current: current !== null && speakers.includes(current) ? current : null,
      };
    }
    case 'consultation':
      return { type, timer: pausedTimer(value.timer) };
    case 'free-round':
      return readFreeRound(value);
    case 'vote-before':
    case 'vote-after':
      return { type, votes: readVotes(value.votes) };
    default:
      return null;
  }
}

function readFreeRound(value: Json): FreeRoundRecord {
  const clocks = objectOr(value.clocks);
  const teamTurns = objectOr(value.teamTurns);
  const speakerTurns = objectOr(value.speakerTurns);
  const current = objectOr(value.current);
  const currentSide = readSide(current.side);
  const currentSlot = readSlot(current.slot);
  const turns = (list: unknown) => listOr(list).slice(0, LIMITS.teamSize.max).map(count);
  return {
    type: 'free-round',
    clocks: { pro: pausedTimer(clocks.pro), con: pausedTimer(clocks.con) },
    active: null,
    lastSide: readSide(value.lastSide),
    current:
      currentSide !== null && currentSlot !== null
        ? { side: currentSide, slot: currentSlot }
        : null,
    teamTurns: { pro: count(teamTurns.pro), con: count(teamTurns.con) },
    speakerTurns: { pro: turns(speakerTurns.pro), con: turns(speakerTurns.con) },
  };
}
