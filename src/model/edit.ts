// Changes to a setup, one at a time, as the setup screen makes them. Each
// function returns a new config and leaves the one it was given alone.
//
// They do not check the result: an edit may well produce a setup that is not
// valid (an empty topic, a step of 0 seconds, a second vote before). The
// screen runs `parseConfig` on what comes back and keeps it only when it
// passes, so the app never holds, stores or shares a setup that would not load
// again, and the reasons come from the same checks a link or a file goes
// through.

import {
  nextId,
  stepSeconds,
  stepSide,
  type DebateConfig,
  type Format,
  type Side,
  type Step,
  type StepType,
  type TeamSize,
} from './config';

/** Seconds of a new timed step, and of a step that becomes timed. */
export const NEW_STEP_SECONDS = 60;

/** The item with this id moved `offset` places; the list itself when that is not possible. */
function moveItem<T extends { readonly id: string }>(
  items: readonly T[],
  id: string,
  offset: number,
): readonly T[] {
  const from = items.findIndex((item) => item.id === id);
  const to = from + offset;
  if (from < 0 || offset === 0 || to < 0 || to >= items.length) return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

// ---------------------------------------------------------------------------
// Topics
// ---------------------------------------------------------------------------

/**
 * A new topic at the end of the list. `reserved` are ids it must not take
 * although no topic has them now: those that debates still refer to, so a
 * debate on a removed topic does not end up on the new one.
 */
export function addTopic(
  config: DebateConfig,
  text: string,
  reserved: Iterable<string> = [],
): DebateConfig {
  const id = nextId('t', [...config.topics.map((topic) => topic.id), ...reserved]);
  return { ...config, topics: [...config.topics, { id, text }] };
}

export function setTopicText(config: DebateConfig, id: string, text: string): DebateConfig {
  return {
    ...config,
    topics: config.topics.map((topic) => (topic.id === id ? { ...topic, text } : topic)),
  };
}

export function removeTopic(config: DebateConfig, id: string): DebateConfig {
  return { ...config, topics: config.topics.filter((topic) => topic.id !== id) };
}

/** Move a topic up (`-1`) or down (`1`) the list. */
export function moveTopic(config: DebateConfig, id: string, offset: number): DebateConfig {
  const topics = moveItem(config.topics, id, offset);
  return topics === config.topics ? config : { ...config, topics };
}

// ---------------------------------------------------------------------------
// Format
// ---------------------------------------------------------------------------

/** Another format, such as a preset's; the topics stay. */
export function setFormat(config: DebateConfig, format: Format): DebateConfig {
  return { ...config, format };
}

export function setSideLabel(config: DebateConfig, side: Side, label: string): DebateConfig {
  const { format } = config;
  return { ...config, format: { ...format, sides: { ...format.sides, [side]: label } } };
}

export function setTeamSize(
  config: DebateConfig,
  bound: keyof TeamSize,
  value: number,
): DebateConfig {
  const { format } = config;
  return { ...config, format: { ...format, teamSize: { ...format.teamSize, [bound]: value } } };
}

function withSteps(config: DebateConfig, steps: readonly Step[]): DebateConfig {
  return { ...config, format: { ...config.format, steps } };
}

function updateStep(config: DebateConfig, id: string, update: (step: Step) => Step): DebateConfig {
  return withSteps(
    config,
    config.format.steps.map((step) => (step.id === id ? update(step) : step)),
  );
}

/**
 * A new speech at the end, with no label of its own. `reserved` are ids it
 * must not take although no step has them now: those with results in a
 * session, which would otherwise show up as the new step's results.
 */
export function addStep(config: DebateConfig, reserved: Iterable<string> = []): DebateConfig {
  const id = nextId('s', [...config.format.steps.map((step) => step.id), ...reserved]);
  const step: Step = { id, type: 'speech', label: '', side: 'pro', seconds: NEW_STEP_SECONDS };
  return withSteps(config, [...config.format.steps, step]);
}

export function removeStep(config: DebateConfig, id: string): DebateConfig {
  return withSteps(
    config,
    config.format.steps.filter((step) => step.id !== id),
  );
}

/** Move a step earlier (`-1`) or later (`1`) in the debate. */
export function moveStep(config: DebateConfig, id: string, offset: number): DebateConfig {
  const steps = moveItem(config.format.steps, id, offset);
  return steps === config.format.steps ? config : withSteps(config, steps);
}

/**
 * The step as another type. It keeps its id and label, and its side and
 * duration where the new type has them; a step that becomes timed gets
 * `NEW_STEP_SECONDS`, a speech that had no side speaks for `pro`.
 */
export function withStepType(step: Step, type: StepType): Step {
  const { id, label } = step;
  const seconds = stepSeconds(step) ?? NEW_STEP_SECONDS;
  switch (type) {
    case 'speech':
      return { id, label, type, side: stepSide(step) ?? 'pro', seconds };
    case 'consultation':
    case 'free-round':
      return { id, label, type, seconds };
    case 'vote-before':
    case 'vote-after':
      return { id, label, type };
  }
}

export function setStepType(config: DebateConfig, id: string, type: StepType): DebateConfig {
  return updateStep(config, id, (step) => (step.type === type ? step : withStepType(step, type)));
}

export function setStepLabel(config: DebateConfig, id: string, label: string): DebateConfig {
  return updateStep(config, id, (step) => ({ ...step, label }));
}

/** The side of a speech; other steps have none. */
export function setStepSide(config: DebateConfig, id: string, side: Side): DebateConfig {
  return updateStep(config, id, (step) => (step.type === 'speech' ? { ...step, side } : step));
}

/** The duration of a timed step (per clock for a free round); a vote has none. */
export function setStepSeconds(config: DebateConfig, id: string, seconds: number): DebateConfig {
  return updateStep(config, id, (step): Step => {
    switch (step.type) {
      case 'speech':
        return { ...step, seconds };
      case 'consultation':
        return { ...step, seconds };
      case 'free-round':
        return { ...step, seconds };
      case 'vote-before':
      case 'vote-after':
        return step;
    }
  });
}
