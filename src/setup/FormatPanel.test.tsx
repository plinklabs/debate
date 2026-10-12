import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { setTopicText } from '../model/edit';
import { GRAFFITI_PRESET } from '../model/presets';
import { initialState, type AppState } from '../model/reducer';
import { newDebate } from '../model/session';
import { renderSetup } from '../test/setupScreen';

const english = GRAFFITI_PRESET.build('en');

const step = (number: number) => screen.getByRole('group', { name: `Step ${number}` });
const total = () => screen.getByText('Total time').nextElementSibling;

/** A session where the first debate has a vote recorded. */
function withResults(): AppState {
  const debate = newDebate('d1', 't1', english.format);
  return {
    config: english,
    session: {
      current: null,
      debates: [
        {
          ...debate,
          records: { 'vote-before': { type: 'vote-before', votes: { pro: 12, con: 9 } } },
        },
        newDebate('d2', 't2', english.format),
      ],
    },
  };
}

describe('the format', () => {
  it('shows the total time of a debate, with both clocks of the free round', () => {
    renderSetup({ tab: 'format' });
    expect(total()).toHaveTextContent('10 minutes');
    expect(screen.getByText('Steps', { selector: 'dt' }).nextElementSibling).toHaveTextContent(
      '10',
    );

    fireEvent.change(within(step(7)).getByRole('spinbutton', { name: 'Seconds per team' }), {
      target: { value: '120' },
    });
    expect(total()).toHaveTextContent('11 minutes');
    fireEvent.change(within(step(4)).getByRole('spinbutton', { name: 'Seconds' }), {
      target: { value: '75' },
    });
    expect(total()).toHaveTextContent('11 minutes 15 seconds');
    expect(within(step(4)).getByText('1 min 15 sec')).toBeInTheDocument();
  });

  it('refuses a step of zero seconds, or no number at all', () => {
    const { state } = renderSetup({ tab: 'format' });
    const seconds = within(step(2)).getByRole('spinbutton', { name: 'Seconds' });

    fireEvent.change(seconds, { target: { value: '0' } });
    expect(seconds).toHaveValue(0);
    expect(seconds).toHaveAttribute('aria-invalid', 'true');
    expect(seconds).toHaveAccessibleDescription('0 is not between 1 and 3,600.');
    expect(state().config.format.steps[1]).toMatchObject({ seconds: 60 });
    expect(total()).toHaveTextContent('10 minutes');

    fireEvent.change(seconds, { target: { value: '' } });
    expect(seconds).toHaveAccessibleDescription('This should be a whole number.');
    fireEvent.change(seconds, { target: { value: '1.5' } });
    expect(seconds).toHaveAccessibleDescription('This should be a whole number.');

    fireEvent.change(seconds, { target: { value: '45' } });
    expect(seconds).not.toHaveAttribute('aria-invalid');
    expect(seconds).toHaveAccessibleDescription('45 sec');
    expect(state().config.format.steps[1]).toMatchObject({ seconds: 45 });
  });

  it('refuses a team size out of range, or a minimum above the maximum', () => {
    const { state } = renderSetup({ tab: 'format' });
    const team = screen.getByRole('group', { name: 'Students per team' });
    const least = within(team).getByRole('spinbutton', { name: 'At least' });
    const most = within(team).getByRole('spinbutton', { name: 'At most' });

    fireEvent.change(least, { target: { value: '0' } });
    expect(least).toHaveAccessibleDescription('0 is not between 1 and 8.');
    fireEvent.change(most, { target: { value: '9' } });
    expect(most).toHaveAccessibleDescription('9 is not between 1 and 8.');
    fireEvent.change(least, { target: { value: '4' } });
    expect(least).toHaveAccessibleDescription(
      'The smallest team size (4) is larger than the largest (3).',
    );
    expect(state().config.format.teamSize).toEqual({ min: 2, max: 3 });

    fireEvent.change(most, { target: { value: '4' } });
    fireEvent.change(least, { target: { value: '3' } });
    expect(state().config.format.teamSize).toEqual({ min: 3, max: 4 });
    expect(least).not.toHaveAttribute('aria-invalid');
  });

  it('names the sides, and a speech picks its side by those names', () => {
    const { state } = renderSetup({ tab: 'format' });
    const sides = screen.getByRole('group', { name: 'Sides' });
    const pro = within(sides).getByRole('textbox', { name: 'For the topic' });

    fireEvent.change(pro, { target: { value: '' } });
    expect(pro).toHaveAccessibleDescription('This cannot be empty.');
    fireEvent.change(pro, { target: { value: 'PRO' } });
    expect(state().config.format.sides).toEqual({ pro: 'PRO', con: 'AGAINST' });

    const side = within(step(3)).getByRole('combobox', { name: 'Side' });
    expect(side).toHaveDisplayValue('AGAINST');
    expect(
      within(side)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['PRO', 'AGAINST']);
    fireEvent.change(side, { target: { value: 'pro' } });
    expect(state().config.format.steps[2]).toMatchObject({ type: 'speech', side: 'pro' });
  });

  it('changes the kind of a step, with one vote before and one vote after at most', () => {
    const { state } = renderSetup({ tab: 'format' });
    const kind = within(step(2)).getByRole('combobox', { name: 'Kind' });
    const option = (name: string) => within(kind).getByRole('option', { name });
    expect(option('Vote before')).toBeDisabled();
    expect(option('Vote after')).toBeDisabled();
    expect(option('Free round')).toBeEnabled();

    fireEvent.change(kind, { target: { value: 'consultation' } });
    expect(state().config.format.steps[1]).toEqual({
      id: 'opening-pro',
      type: 'consultation',
      label: 'Opening',
      seconds: 60,
    });
    expect(within(step(2)).queryByRole('combobox', { name: 'Side' })).not.toBeInTheDocument();

    // Once the vote before is a speech, step 2 may become the vote before.
    fireEvent.change(within(step(1)).getByRole('combobox', { name: 'Kind' }), {
      target: { value: 'speech' },
    });
    expect(option('Vote before')).toBeEnabled();
    expect(within(step(1)).getByRole('spinbutton', { name: 'Seconds' })).toHaveValue(60);
  });

  it('adds a step that goes by the name of its kind until it gets a title', () => {
    const { state } = renderSetup({ tab: 'format' });
    fireEvent.click(screen.getByRole('button', { name: 'Add step' }));

    const added = step(11);
    expect(within(added).getByRole('combobox', { name: 'Kind' })).toHaveFocus();
    expect(within(added).getByRole('combobox', { name: 'Kind' })).toHaveDisplayValue('Speech');
    const title = within(added).getByRole('textbox', { name: 'Title' });
    expect(title).toHaveValue('');
    expect(title).toHaveAttribute('placeholder', 'Speech');
    expect(state().config.format.steps.at(-1)).toEqual({
      id: 's1',
      type: 'speech',
      label: '',
      side: 'pro',
      seconds: 60,
    });

    fireEvent.change(within(added).getByRole('combobox', { name: 'Kind' }), {
      target: { value: 'free-round' },
    });
    expect(within(step(11)).getByRole('textbox', { name: 'Title' })).toHaveAttribute(
      'placeholder',
      'Free round',
    );
  });

  it('moves and removes steps, and keeps at least one', () => {
    const { state } = renderSetup({ tab: 'format' });
    fireEvent.click(screen.getByRole('button', { name: 'Move step 9 down' }));
    expect(
      state()
        .config.format.steps.slice(-2)
        .map((s) => s.id),
    ).toEqual(['vote-after', 'closing-pro']);
    expect(screen.getByRole('button', { name: 'Move step 10 down' })).toHaveFocus();

    for (let count = 10; count > 1; count -= 1) {
      fireEvent.click(screen.getByRole('button', { name: `Remove step ${count}` }));
    }
    expect(state().config.format.steps.map((s) => s.id)).toEqual(['vote-before']);
    expect(screen.getByRole('button', { name: 'Remove step 1' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });

  it('asks before the format of debates with results is changed', () => {
    renderSetup({ tab: 'format', initial: withResults() });
    expect(screen.getByRole('note')).toHaveTextContent(/^One debate already has results\./);
    expect(screen.getByRole('textbox', { name: 'For the topic' })).toBeDisabled();
    expect(within(step(2)).getByRole('spinbutton', { name: 'Seconds' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Add step' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Use this preset' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Change the format anyway' }));

    expect(screen.queryByRole('note')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'For the topic' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Add step' })).toBeEnabled();
  });

  it('does not reuse the id of a step with results for a new step', () => {
    const initial = withResults();
    const steps = initial.config.format.steps.filter((s) => s.id !== 'vote-before');
    const { state } = renderSetup({
      tab: 'format',
      initial: {
        ...initial,
        config: { ...initial.config, format: { ...initial.config.format, steps } },
        session: {
          ...initial.session,
          debates: initial.session.debates.map((debate) => ({
            ...debate,
            records: { s1: { type: 'consultation', timer: { accMs: 5000, since: null } } },
          })),
        },
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Change the format anyway' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add step' }));
    expect(state().config.format.steps.at(-1)?.id).toBe('s2');
  });

  it('starts over from a preset in the current language, after asking, and keeps the topics', () => {
    const own = setTopicText(english, 't1', 'Eigen stelling');
    const { state } = renderSetup({ tab: 'format', locale: 'nl', initial: initialState(own) });
    // Made in English: the labels stay as they were, in a Dutch UI.
    expect(screen.getByRole('textbox', { name: 'Voor de stelling' })).toHaveValue('FOR');
    expect(
      within(screen.getByRole('group', { name: 'Stap 2' })).getByRole('textbox', {
        name: 'Titel',
      }),
    ).toHaveValue('Opening');

    fireEvent.click(screen.getByRole('button', { name: 'Stap 10 verwijderen' }));
    // A half-typed side label gives way to the preset's.
    fireEvent.change(screen.getByRole('textbox', { name: 'Voor de stelling' }), {
      target: { value: '' },
    });
    expect(screen.getByRole('textbox', { name: 'Voor de stelling' })).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Dit sjabloon gebruiken' }));
    expect(screen.getByRole('group', { name: 'Dit sjabloon gebruiken' })).toHaveTextContent(
      'Dit vervangt de kanten, de teamgrootte en alle stappen.',
    );
    expect(screen.getByRole('button', { name: 'Annuleren' })).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'Debatvorm vervangen' }));

    expect(state().config.format).toEqual(GRAFFITI_PRESET.build('nl').format);
    expect(state().config.topics[0].text).toBe('Eigen stelling');
    expect(screen.getByRole('textbox', { name: 'Voor de stelling' })).toHaveValue('VOOR');
    expect(screen.getByRole('textbox', { name: 'Voor de stelling' })).not.toHaveAttribute(
      'aria-invalid',
    );
    expect(screen.getByRole('button', { name: 'Dit sjabloon gebruiken' })).toHaveFocus();
  });

  it('shows a step without a title by the name of its kind in the UI language', () => {
    const blank = {
      ...english,
      format: {
        ...english.format,
        steps: english.format.steps.map((s) => (s.id === 'consultation' ? { ...s, label: '' } : s)),
      },
    };
    renderSetup({ tab: 'format', locale: 'nl', initial: initialState(blank) });
    const title = within(screen.getByRole('group', { name: 'Stap 4' })).getByRole('textbox', {
      name: 'Titel',
    });
    expect(title).toHaveValue('');
    expect(title).toHaveAttribute('placeholder', 'Overleg');
  });
});
