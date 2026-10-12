import { act, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DebateConfig } from '../model/config';
import { GRAFFITI_PRESET } from '../model/presets';
import type { Action, AppState } from '../model/reducer';
import { recordFor } from '../model/session';
import { isRunning } from '../model/timer';
import { fakeAudio, fakeWakeLock } from '../test/browserFakes';
import { openDebate, renderDebate } from '../test/debateScreen';
import { popperWithQuestions } from '../test/playedSession';
import { SOUND_STORAGE_KEY } from './sound';

const en = GRAFFITI_PRESET.build('en');
const nl = GRAFFITI_PRESET.build('nl');

const indexOf = (id: string, config: DebateConfig = en) =>
  config.format.steps.findIndex((step) => step.id === id);

/** Debate 1, open at the step with this id. */
const openAt = (id: string, config: DebateConfig = en, ...actions: Action[]) =>
  openDebate(config, { type: 'go-to-step', step: indexOf(id, config), now: 0 }, ...actions);

/** The record of a step of debate 1. */
function recordOf(state: AppState, id: string) {
  const step = state.config.format.steps[indexOf(id, state.config)];
  return recordFor(state.session.debates[0], step);
}

function running(state: AppState, id: string): boolean {
  const record = recordOf(state, id);
  return record.type === 'speech' || record.type === 'consultation'
    ? isRunning(record.timer)
    : false;
}

const press = (key: string, target: Element = document.body, init: KeyboardEventInit = {}) =>
  fireEvent.keyDown(target, { key, ...init });
/** Time passes on the fake clock, with the screen drawn in between as a browser does. */
function later(ms: number) {
  for (let left = ms; left > 0; left -= 250) {
    act(() => {
      vi.advanceTimersByTime(Math.min(250, left));
    });
  }
}
const timer = (name = 'Time') => screen.getByRole('timer', { name });
const title = () => screen.getByRole('heading', { level: 2 });
const steps = () => within(screen.getByRole('navigation', { name: 'Steps' }));
const button = (name: string | RegExp) => screen.getByRole('button', { name });
const status = () => screen.getByRole('status');

beforeEach(() => {
  // The clocks run on the fake clock, `performance.now()` included.
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'performance', 'Date'],
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  localStorage.clear();
  Reflect.deleteProperty(navigator, 'wakeLock');
});

describe('the debate screen', () => {
  it('shows the topic, every step with the current one marked, and the step on the stage', () => {
    renderDebate();

    const topic = screen.getByRole('heading', { level: 1 });
    expect(topic).toHaveTextContent(en.topics[0].text);
    expect(topic).toHaveFocus();
    expect(screen.getByText('// Debate 1')).toBeInTheDocument();

    expect(steps().getAllByRole('button')).toHaveLength(10);
    expect(steps().getByRole('button', { name: 'Step 1: Vote before' })).toHaveAttribute(
      'aria-current',
      'step',
    );
    expect(steps().getByRole('button', { name: 'Step 2: Opening (FOR)' })).not.toHaveAttribute(
      'aria-current',
    );
    expect(screen.getByRole('region', { name: 'Vote before' })).toContainElement(title());
    expect(screen.getByText('Step 1 of 10 · The audience')).toBeInTheDocument();

    // A vote has no clock to start; there is no step before the first.
    expect(screen.queryByRole('button', { name: 'Start' })).not.toBeInTheDocument();
    expect(button('Previous step')).toHaveAttribute('aria-disabled', 'true');

    fireEvent.click(steps().getByRole('button', { name: 'Step 4: Short consultation' }));
    expect(title()).toHaveTextContent('Short consultation');
    expect(screen.getByText('Step 4 of 10 · Both teams')).toBeInTheDocument();
    expect(screen.getByText('Both teams prepare.')).toBeInTheDocument();
    expect(timer()).toHaveTextContent('1:00');
  });

  it('names a step without a title after its kind, in the language of the screen', () => {
    const untitled: DebateConfig = {
      ...nl,
      format: {
        ...nl.format,
        steps: nl.format.steps.map((step) =>
          step.id === 'opening-pro' ? { ...step, label: '' } : step,
        ),
      },
    };
    renderDebate({ locale: 'nl', initial: openAt('opening-pro', untitled) });

    expect(title()).toHaveTextContent('Spreekbeurt');
    expect(screen.getByText('Stap 2 van 10 · VOOR')).toBeInTheDocument();
    const nav = within(screen.getByRole('navigation', { name: 'Stappen' }));
    expect(nav.getByRole('button', { name: 'Stap 2: Spreekbeurt (VOOR)' })).toHaveAttribute(
      'aria-current',
      'step',
    );
    expect(screen.getByRole('timer', { name: 'Tijd' })).toHaveTextContent('1:00');
    expect(screen.getByText('Tik op wie spreekt.')).toBeInTheDocument();
  });

  it('starts and pauses with Space, steps with the arrow and page keys, and pauses a clock it leaves', () => {
    const { state } = renderDebate({ initial: openAt('opening-pro') });
    expect(timer()).toHaveTextContent('1:00');
    expect(screen.getByText('of 1:00')).toBeInTheDocument();

    press(' ');
    expect(button('Pause')).toBeInTheDocument();
    later(20_000);
    expect(timer()).toHaveTextContent('0:40');

    press(' ');
    expect(button('Start')).toBeInTheDocument();
    later(5_000);
    expect(timer()).toHaveTextContent('0:40');
    expect(screen.getByText('Paused · of 1:00')).toBeInTheDocument();

    press(' ');
    later(1_000);
    expect(timer()).toHaveTextContent('0:39');

    // Held down, a key does not repeat; with a modifier it is not ours.
    press('ArrowRight', document.body, { repeat: true });
    press('ArrowRight', document.body, { ctrlKey: true });
    expect(title()).toHaveTextContent('Opening');
    expect(screen.getByText('Step 2 of 10 · FOR')).toBeInTheDocument();

    press('ArrowRight');
    expect(screen.getByText('Step 3 of 10 · AGAINST')).toBeInTheDocument();
    expect(running(state(), 'opening-pro')).toBe(false);

    press('PageUp');
    expect(screen.getByText('Step 2 of 10 · FOR')).toBeInTheDocument();
    expect(timer()).toHaveTextContent('0:39');
    expect(button('Start')).toBeInTheDocument();
    later(10_000);
    expect(timer()).toHaveTextContent('0:39');

    press('PageDown');
    expect(screen.getByText('Step 3 of 10 · AGAINST')).toBeInTheDocument();
    press('ArrowLeft');
    expect(screen.getByText('Step 2 of 10 · FOR')).toBeInTheDocument();

    // The buttons do the same.
    fireEvent.click(button('Start'));
    expect(running(state(), 'opening-pro')).toBe(true);
    fireEvent.click(button('Next step'));
    expect(screen.getByText('Step 3 of 10 · AGAINST')).toBeInTheDocument();
    expect(running(state(), 'opening-pro')).toBe(false);
    fireEvent.click(button('Previous step'));
    expect(screen.getByText('Step 2 of 10 · FOR')).toBeInTheDocument();
  });

  it('takes Space from a focused button, so one press is one start', () => {
    const { state } = renderDebate({ initial: openAt('opening-pro') });
    const back = button(/Back to the setup/);
    back.focus();

    expect(press(' ', back)).toBe(false); // default prevented: the button is not pressed
    expect(fireEvent.keyUp(back, { key: ' ' })).toBe(false);
    expect(running(state(), 'opening-pro')).toBe(true);
  });

  it('leaves the keys alone while a count is typed', () => {
    const { state } = renderDebate();
    const count = screen.getByRole('spinbutton', { name: 'Votes FOR' });
    count.focus();
    fireEvent.change(count, { target: { value: '12' } });

    expect(press('ArrowRight', count)).toBe(true);
    expect(press(' ', count)).toBe(true);
    expect(press('PageDown', count)).toBe(true);
    expect(title()).toHaveTextContent('Vote before');
    expect(recordOf(state(), 'vote-before')).toMatchObject({ votes: { pro: 12, con: 0 } });

    press('ArrowRight');
    expect(title()).toHaveTextContent('Opening');
  });

  it('counts into the overtime and signals once when time is up, with a sound', () => {
    const audio = fakeAudio();
    renderDebate({ initial: openAt('opening-pro') });

    press(' '); // a key press lets the page play sound
    later(59_000);
    expect(timer()).toHaveTextContent('0:01');
    expect(status()).toHaveTextContent('');
    expect(audio.tones()).toBe(0);

    later(1_000);
    expect(timer()).toHaveTextContent('0:00');
    expect(status()).toHaveTextContent('Time is up.');
    expect(screen.getByText('Overtime · of 1:00')).toBeInTheDocument();
    const signalled = audio.tones();
    expect(signalled).toBeGreaterThan(0);

    later(12_000);
    expect(timer()).toHaveTextContent('+0:12');
    // The signal on screen has ended, and the sound did not play again.
    expect(status()).toHaveTextContent('');
    expect(audio.tones()).toBe(signalled);

    // A step that is over time already does not signal when it comes back.
    press('ArrowRight');
    press('ArrowLeft');
    press(' ');
    later(5_000);
    expect(timer()).toHaveTextContent('+0:17');
    expect(status()).toHaveTextContent('');
    expect(audio.tones()).toBe(signalled);
  });

  it('signals without sound when muted, and keeps that choice in this browser only', () => {
    const audio = fakeAudio();
    const initial = openAt('consultation');
    const { state } = renderDebate({ initial });
    const sound = screen.getByRole('switch', { name: 'Sound' });
    expect(sound).toHaveAttribute('aria-checked', 'true');

    fireEvent.click(sound);
    expect(sound).toHaveAttribute('aria-checked', 'false');
    expect(localStorage.getItem(SOUND_STORAGE_KEY)).toBe('off');
    expect(state().config).toBe(initial.config);

    press(' ');
    later(60_000);
    expect(status()).toHaveTextContent('Time is up.');
    expect(audio.tones()).toBe(0);

    // Back on: it plays once, to hear how loud it is.
    fireEvent.click(sound);
    expect(sound).toHaveAttribute('aria-checked', 'true');
    expect(localStorage.getItem(SOUND_STORAGE_KEY)).toBe('on');
    expect(audio.tones()).toBeGreaterThan(0);
  });

  it('starts muted when muted before', () => {
    localStorage.setItem(SOUND_STORAGE_KEY, 'off');
    renderDebate();
    expect(screen.getByRole('switch', { name: 'Sound' })).toHaveAttribute('aria-checked', 'false');
  });

  it('gives the floor to the student tapped, and records who spoke', () => {
    const { state } = renderDebate({ initial: openAt('opening-pro') });
    expect(screen.getByText('Tap the student who speaks.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Dirk' })).not.toBeInTheDocument();

    fireEvent.click(button('Ann'));
    expect(button('Ann')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Ann has the floor')).toBeInTheDocument();
    // The clock starts with the first speaker.
    expect(button('Pause')).toBeInTheDocument();

    fireEvent.click(button('Bert'));
    expect(button('Bert')).toHaveAttribute('aria-pressed', 'true');
    expect(button('Ann')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('Spoke this turn')).toBeInTheDocument();
    expect(recordOf(state(), 'opening-pro')).toMatchObject({ speakers: [0, 1], current: 1 });

    fireEvent.click(button('Remove Bert from the speakers'));
    expect(screen.getByText('Ann has the floor')).toBeInTheDocument();
    expect(recordOf(state(), 'opening-pro')).toMatchObject({ speakers: [0], current: 0 });
  });

  it('runs a chess clock in the free round: a tap on a name switches the clock', () => {
    const { state } = renderDebate({ initial: openAt('free-round') });
    expect(screen.getByText('Tap a name: that team’s clock runs.')).toBeInTheDocument();
    expect(button('Start')).toHaveAttribute('aria-disabled', 'true');
    press(' ');
    expect(timer('FOR')).toHaveTextContent('1:30');
    later(3_000);
    expect(timer('FOR')).toHaveTextContent('1:30');

    fireEvent.click(button('Ann'));
    later(5_000);
    expect(timer('FOR')).toHaveTextContent('1:25');
    expect(timer('AGAINST')).toHaveTextContent('1:30');

    fireEvent.click(button('Dirk'));
    later(10_000);
    expect(timer('FOR')).toHaveTextContent('1:25');
    expect(timer('AGAINST')).toHaveTextContent('1:20');
    expect(screen.getByText('Dirk has the floor')).toBeInTheDocument();
    const forTeam = within(screen.getByRole('region', { name: 'FOR' }));
    const against = within(screen.getByRole('region', { name: 'AGAINST' }));
    expect(forTeam.getByText('1 turn')).toBeInTheDocument();
    expect(against.getByText('1 turn')).toBeInTheDocument();
    expect(forTeam.getByText('Paused · of 1:30')).toBeInTheDocument();

    // Space pauses, and resumes the clock of the team that had the floor.
    press(' ');
    later(4_000);
    expect(timer('AGAINST')).toHaveTextContent('1:20');
    press(' ');
    later(4_000);
    expect(timer('AGAINST')).toHaveTextContent('1:16');
    expect(timer('FOR')).toHaveTextContent('1:25');

    // Ann has the floor again: a second turn for her and for her team.
    fireEvent.click(button('Ann'));
    expect(forTeam.getByText('2 turns')).toBeInTheDocument();
    expect(forTeam.getByText('2×')).toBeInTheDocument();
    expect(button('One turn fewer for Ann')).toHaveAttribute('aria-disabled', 'false');
    fireEvent.click(button('One turn fewer for Ann'));
    fireEvent.click(button('One turn fewer for Ann'));
    fireEvent.click(button('One turn fewer for Ann'));
    // Ann and Bert both at none now.
    expect(forTeam.getAllByText('0×')).toHaveLength(2);
    expect(button('One turn fewer for Ann')).toHaveAttribute('aria-disabled', 'true');
    const round = recordOf(state(), 'free-round');
    expect(round).toMatchObject({ speakerTurns: { pro: [0], con: [1] }, active: 'pro' });
  });

  it('counts the votes and shows the shift in percentage points', () => {
    const finished = vi.fn();
    const { state } = renderDebate({ onFinish: finished });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Votes FOR' }), {
      target: { value: '10' },
    });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Votes AGAINST' }), {
      target: { value: '14' },
    });
    fireEvent.click(button('One vote more for AGAINST'));
    expect(screen.getByRole('spinbutton', { name: 'Votes AGAINST' })).toHaveValue(15);
    expect(screen.getByText('40%')).toBeInTheDocument();
    expect(screen.getByText('60%')).toBeInTheDocument();

    fireEvent.click(steps().getByRole('button', { name: 'Step 10: Vote after' }));
    expect(
      screen.getByText('No shift yet: each vote needs at least one hand.'),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Votes FOR' }), {
      target: { value: '13' },
    });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Votes AGAINST' }), {
      target: { value: '11' },
    });

    expect(screen.getByText('10 FOR · 15 AGAINST · 40% FOR')).toBeInTheDocument();
    expect(screen.getByText('13 FOR · 11 AGAINST · 54% FOR')).toBeInTheDocument();
    expect(screen.getByText(/^Shift towards FOR: \+14\.2 percentage points/)).toHaveTextContent(
      'Shift towards FOR: +14.2 percentage points (+3 votes)',
    );

    // The last step: Finish instead of Next.
    expect(screen.queryByRole('button', { name: /Next step/ })).not.toBeInTheDocument();
    fireEvent.click(button('Finish debate'));
    expect(finished).toHaveBeenCalledTimes(1);
    expect(state().session.debates[0].done).toBe(true);
  });

  it('writes the shift as Dutch does', () => {
    const initial = openDebate(
      nl,
      { type: 'set-votes', side: 'pro', value: 10 },
      { type: 'set-votes', side: 'con', value: 15 },
      { type: 'go-to-step', step: indexOf('vote-after', nl), now: 0 },
      { type: 'set-votes', side: 'pro', value: 13 },
      { type: 'set-votes', side: 'con', value: 11 },
    );
    renderDebate({ locale: 'nl', initial });
    expect(screen.getByText(/^Verschuiving naar VOOR/)).toHaveTextContent(
      'Verschuiving naar VOOR: +14,2 procentpunten (+3 stemmen)',
    );
    expect(screen.getByText('Wie is het eens met de stelling? Tel de handen.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Debat afsluiten' })).toBeInTheDocument();
  });

  it('keeps the screen awake while a clock runs', async () => {
    const lock = fakeWakeLock();
    renderDebate({ initial: openAt('opening-pro') });
    const settle = () => act(async () => {});
    await settle();
    expect(lock.request).not.toHaveBeenCalled();

    press(' ');
    await settle();
    expect(lock.held()).toBe(1);
    press(' ');
    await settle();
    expect(lock.held()).toBe(0);

    press(' ');
    await settle();
    expect(lock.held()).toBe(1);
    press('ArrowRight'); // leaving the step pauses its clock
    await settle();
    expect(lock.held()).toBe(0);
  });

  it('clears the current step after asking', () => {
    const { state } = renderDebate({ initial: openAt('opening-pro') });
    fireEvent.click(button('Ann'));
    later(3_000);
    expect(timer()).toHaveTextContent('0:57');

    fireEvent.click(button('Clear step'));
    fireEvent.click(button('Clear'));
    expect(timer()).toHaveTextContent('1:00');
    expect(screen.getByText('Tap the student who speaks.')).toBeInTheDocument();
    expect(state().session.debates[0].records).not.toHaveProperty('opening-pro');
  });

  it('goes back to the setup', () => {
    const back = vi.fn();
    renderDebate({ onBack: back });
    fireEvent.click(button(/Back to the setup/));
    expect(back).toHaveBeenCalledTimes(1);
  });
});

describe('the steps and prep time of #8', () => {
  // Karl Popper with a bank of 30 s and audience questions at the end, for
  // teams of two, as openDebate fills them in.
  const base = popperWithQuestions();
  const popper: DebateConfig = {
    ...base,
    format: { ...base.format, teamSize: { min: 2, max: 3 } },
  };
  const popperAt = (id: string, ...actions: Action[]) => openAt(id, popper, ...actions);
  const prep = (side: string) => within(screen.getByRole('group', { name: `Prep time ${side}` }));
  const prepClock = (side: string) => screen.getByRole('timer', { name: `Prep time ${side}` });

  it('shows who asks and who answers in a cross-examination, and records both', () => {
    const { state } = renderDebate({ initial: popperAt('cross-examination-con-1') });
    expect(title()).toHaveTextContent('Cross-examination');
    expect(
      screen.getByText('Step 2 of 11 · NEGATIVE asks, AFFIRMATIVE answers'),
    ).toBeInTheDocument();
    expect(
      steps().getByRole('button', { name: 'Step 2: Cross-examination (NEGATIVE)' }),
    ).toHaveAttribute('aria-current', 'step');
    expect(screen.getByText('Tap who asks and who answers.')).toBeInTheDocument();
    const asks = within(screen.getByRole('group', { name: 'NEGATIVE asks' }));
    const answers = within(screen.getByRole('group', { name: 'AFFIRMATIVE answers' }));
    expect(asks.getAllByRole('button').map((name) => name.textContent)).toEqual(['Dirk', 'Eva']);
    expect(answers.getAllByRole('button').map((name) => name.textContent)).toEqual(['Ann', 'Bert']);

    fireEvent.click(asks.getByRole('button', { name: 'Dirk' }));
    expect(screen.getByText('Dirk asks')).toBeInTheDocument();
    // The clock starts with the first question; it is the asking side's.
    expect(button('Pause')).toBeInTheDocument();
    fireEvent.click(answers.getByRole('button', { name: 'Bert' }));
    expect(screen.getByText('Dirk asks, Bert answers')).toBeInTheDocument();
    expect(answers.getByRole('button', { name: 'Bert' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Asked')).toBeInTheDocument();
    expect(screen.getByText('Answered')).toBeInTheDocument();
    expect(recordOf(state(), 'cross-examination-con-1')).toMatchObject({
      askers: [0],
      answerers: [1],
    });

    fireEvent.click(button('Remove Bert from the speakers'));
    expect(screen.getByText('Dirk asks')).toBeInTheDocument();
    expect(screen.queryByText('Answered')).not.toBeInTheDocument();
    expect(recordOf(state(), 'cross-examination-con-1')).toMatchObject({
      answerers: [],
      answerer: null,
    });
  });

  it('times the audience questions and counts the answers of each team', () => {
    const { state } = renderDebate({ initial: popperAt('s1') });
    expect(title()).toHaveTextContent('Audience questions');
    expect(screen.getByText('Step 11 of 11 · The audience and both teams')).toBeInTheDocument();
    expect(
      screen.getByText('The audience asks both teams. Count the answers per team, if you like.'),
    ).toBeInTheDocument();
    expect(timer()).toHaveTextContent('2:00');
    press(' ');
    later(30_000);
    expect(timer()).toHaveTextContent('1:30');

    expect(button('One answer fewer for NEGATIVE')).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(button('One answer more for AFFIRMATIVE'));
    fireEvent.click(button('One answer more for AFFIRMATIVE'));
    fireEvent.click(button('One answer more for NEGATIVE'));
    fireEvent.click(button('One answer fewer for AFFIRMATIVE'));
    const team = (side: string) => screen.getByRole('group', { name: side });
    expect(team('AFFIRMATIVE')).toHaveTextContent('1 answer');
    expect(team('NEGATIVE')).toHaveTextContent('1 answer');
    expect(recordOf(state(), 's1')).toMatchObject({ answers: { pro: 1, con: 1 } });
    // Counting does not touch the clock.
    expect(button('Pause')).toBeInTheDocument();
  });

  it('shows the prep time of both teams; calling it pauses the step, and Start ends it', () => {
    const { state } = renderDebate({ initial: popperAt('constructive-pro') });
    expect(screen.getByRole('region', { name: 'Prep time' })).toBeInTheDocument();
    expect(prepClock('AFFIRMATIVE')).toHaveTextContent('0:30');
    expect(prepClock('NEGATIVE')).toHaveTextContent('0:30');

    press(' ');
    later(5_000);
    expect(timer()).toHaveTextContent('5:55');

    fireEvent.click(prep('NEGATIVE').getByRole('button', { name: 'Call prep' }));
    expect(button('Start')).toBeInTheDocument();
    expect(prep('NEGATIVE').getByRole('button', { name: 'Stop prep' })).toBeInTheDocument();
    later(10_000);
    expect(prepClock('NEGATIVE')).toHaveTextContent('0:20');
    expect(prepClock('AFFIRMATIVE')).toHaveTextContent('0:30');
    expect(timer()).toHaveTextContent('5:55');

    // The other team calls it: the first team's stops.
    fireEvent.click(prep('AFFIRMATIVE').getByRole('button', { name: 'Call prep' }));
    later(4_000);
    expect(prepClock('NEGATIVE')).toHaveTextContent('0:20');
    expect(prepClock('AFFIRMATIVE')).toHaveTextContent('0:26');

    // Start goes on with the step, and ends the prep time.
    press(' ');
    expect(prep('AFFIRMATIVE').getByRole('button', { name: 'Call prep' })).toBeInTheDocument();
    later(3_000);
    expect(timer()).toHaveTextContent('5:52');
    expect(prepClock('AFFIRMATIVE')).toHaveTextContent('0:26');
    expect(state().session.debates[0].prep.active).toBeNull();

    // Prep time belongs to no step: it goes on to the next one.
    fireEvent.click(prep('NEGATIVE').getByRole('button', { name: 'Call prep' }));
    press('ArrowRight');
    later(5_000);
    expect(title()).toHaveTextContent('Cross-examination');
    expect(prepClock('NEGATIVE')).toHaveTextContent('0:15');
  });

  it('signals once when a bank runs out, and counts on into overtime until stopped', () => {
    const audio = fakeAudio();
    const { state } = renderDebate({ initial: popperAt('constructive-pro') });
    press('Shift'); // a key press lets the page play sound
    fireEvent.click(prep('AFFIRMATIVE').getByRole('button', { name: 'Call prep' }));
    later(29_000);
    expect(prepClock('AFFIRMATIVE')).toHaveTextContent('0:01');
    expect(status()).toHaveTextContent('');
    expect(audio.tones()).toBe(0);

    later(1_000);
    expect(prepClock('AFFIRMATIVE')).toHaveTextContent('0:00');
    expect(status()).toHaveTextContent('The prep time of AFFIRMATIVE is up.');
    const signalled = audio.tones();
    expect(signalled).toBeGreaterThan(0);

    later(12_000);
    expect(prepClock('AFFIRMATIVE')).toHaveTextContent('+0:12');
    expect(prep('AFFIRMATIVE').getByText('Overtime')).toBeInTheDocument();
    expect(status()).toHaveTextContent('');
    expect(audio.tones()).toBe(signalled);
    // Nothing stopped it: that is the teacher's call.
    expect(state().session.debates[0].prep.active).toBe('pro');
    fireEvent.click(prep('AFFIRMATIVE').getByRole('button', { name: 'Stop prep' }));
    later(5_000);
    expect(prepClock('AFFIRMATIVE')).toHaveTextContent('+0:12');
  });

  it('keeps the screen awake while prep time runs', async () => {
    const lock = fakeWakeLock();
    renderDebate({ initial: popperAt('constructive-pro') });
    const settle = () => act(async () => {});
    fireEvent.click(prep('NEGATIVE').getByRole('button', { name: 'Call prep' }));
    await settle();
    expect(lock.held()).toBe(1);
    fireEvent.click(prep('NEGATIVE').getByRole('button', { name: 'Stop prep' }));
    await settle();
    expect(lock.held()).toBe(0);
  });

  it('shows no prep time in a format without a bank', () => {
    renderDebate({ initial: openAt('opening-pro') });
    expect(screen.queryByRole('region', { name: 'Prep time' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Call prep' })).not.toBeInTheDocument();
  });

  it('is in Dutch in a Dutch screen', () => {
    renderDebate({ locale: 'nl', initial: popperAt('cross-examination-con-1') });
    expect(
      screen.getByText('Stap 2 van 11 · NEGATIVE vraagt, AFFIRMATIVE antwoordt'),
    ).toBeInTheDocument();
    expect(screen.getByText('Tik op wie vraagt en op wie antwoordt.')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Voorbereidingstijd' })).toBeInTheDocument();
    const negative = screen.getByRole('group', { name: 'Voorbereidingstijd NEGATIVE' });
    expect(within(negative).getByRole('button', { name: 'Tijd nemen' })).toBeInTheDocument();
  });
});
