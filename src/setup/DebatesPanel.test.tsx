import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Side } from '../model/config';
import { GRAFFITI_PRESET } from '../model/presets';
import { initialState, reducer, type Action, type AppState } from '../model/reducer';
import { renderSetup } from '../test/setupScreen';

const config = GRAFFITI_PRESET.build('en');

const debate = (number: number) => screen.getByRole('article', { name: `Debate ${number}` });

function nameField(number: number, side: 'FOR' | 'AGAINST', slot: number) {
  return within(within(debate(number)).getByRole('group', { name: side })).getByRole('textbox', {
    name: `Name ${slot}`,
  });
}

function type(number: number, side: 'FOR' | 'AGAINST', names: readonly string[]) {
  names.forEach((name, slot) => {
    fireEvent.change(nameField(number, side, slot + 1), { target: { value: name } });
  });
}

function withDebate(teams: Partial<Record<Side, readonly string[]>> = {}): AppState {
  const actions: Action[] = [{ type: 'add-debate', topicId: 't2' }];
  for (const [side, names] of Object.entries(teams) as [Side, readonly string[]][]) {
    names.forEach((name, slot) =>
      actions.push({ type: 'set-name', debateId: 'd1', side, slot, name }),
    );
  }
  return actions.reduce(reducer, initialState(config));
}

describe('the debates', () => {
  it('says there are none yet, and adds one on the topic chosen', () => {
    const { state } = renderSetup({ tab: 'debates' });
    expect(screen.getByText('No debates yet. Choose a topic and add one.')).toBeInTheDocument();

    fireEvent.change(screen.getByRole('combobox', { name: 'Topic' }), {
      target: { value: 't4' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add debate' }));

    expect(state().session.debates.map((d) => d.topicId)).toEqual(['t4']);
    expect(within(debate(1)).getByText(config.topics[3].text)).toBeInTheDocument();
    expect(nameField(1, 'FOR', 1)).toHaveFocus();
    // Several debates can take the same topic.
    fireEvent.click(screen.getByRole('button', { name: 'Add debate' }));
    expect(state().session.debates.map((d) => d.topicId)).toEqual(['t4', 't4']);
  });

  it('starts a debate only once both teams are complete', () => {
    const { state } = renderSetup({ tab: 'debates', initial: withDebate() });
    const start = within(debate(1)).getByRole('button', { name: 'Start' });
    expect(start).toBeDisabled();
    expect(start).toHaveAccessibleDescription('Debate 1');
    expect(within(debate(1)).getByText('Teams incomplete')).toBeInTheDocument();
    const forTeam = within(debate(1)).getByRole('group', { name: 'FOR' });
    expect(forTeam).toHaveAccessibleDescription('Needs at least 2 names');
    expect(nameField(1, 'FOR', 3)).toHaveAttribute('placeholder', 'Name 3 (optional)');

    type(1, 'FOR', ['Ann', 'Bert', 'Cas']);
    type(1, 'AGAINST', ['Dirk']);
    expect(forTeam).toHaveAccessibleDescription('Complete');
    expect(start).toBeDisabled();

    type(1, 'AGAINST', ['Dirk', 'Eva']);
    expect(within(debate(1)).getByText('Ready')).toBeInTheDocument();
    expect(start).toBeEnabled();
    expect(state().session.debates[0].teams).toEqual({
      pro: ['Ann', 'Bert', 'Cas'],
      con: ['Dirk', 'Eva', ''],
    });

    fireEvent.click(start);
    expect(state().session.current).toBe('d1');
  });

  it('makes the Start of the first debate that is ready the one magenta button', () => {
    let initial = withDebate({ pro: ['Ann', 'Bert'], con: ['Dirk', 'Eva'] });
    initial = reducer(initial, { type: 'add-debate', topicId: 't1' });
    for (const [side, slot, name] of [
      ['pro', 0, 'Fien'],
      ['pro', 1, 'Gert'],
      ['con', 0, 'Hans'],
      ['con', 1, 'Ines'],
    ] as const) {
      initial = reducer(initial, { type: 'set-name', debateId: 'd2', side, slot, name });
    }
    renderSetup({ tab: 'debates', initial });
    const starts = screen.getAllByRole('button', { name: 'Start' });
    expect(starts.map((button) => button.className.includes('primary'))).toEqual([true, false]);
  });

  it('shows names left beyond a smaller team, and lets them be cleared', () => {
    const initial = withDebate({ pro: ['Ann', 'Bert', 'Cas'], con: ['Dirk', 'Eva'] });
    const smaller = {
      ...initial,
      config: { ...config, format: { ...config.format, teamSize: { min: 2, max: 2 } } },
    };
    const { state } = renderSetup({ tab: 'debates', initial: smaller });
    const third = nameField(1, 'FOR', 3);
    expect(third).toHaveValue('Cas');
    expect(third).toHaveAttribute('aria-invalid', 'true');
    expect(within(debate(1)).getByRole('group', { name: 'FOR' })).toHaveAccessibleDescription(
      'At most 2 names',
    );
    expect(within(debate(1)).getByRole('button', { name: 'Start' })).toBeDisabled();
    // The other side shows the two slots of the format only.
    expect(
      within(within(debate(1)).getByRole('group', { name: 'AGAINST' })).getAllByRole('textbox'),
    ).toHaveLength(2);

    fireEvent.change(third, { target: { value: '' } });
    expect(state().session.debates[0].teams.pro).toEqual(['Ann', 'Bert', '']);
    expect(within(debate(1)).getByRole('button', { name: 'Start' })).toBeEnabled();
    expect(
      within(within(debate(1)).getByRole('group', { name: 'FOR' })).getAllByRole('textbox'),
    ).toHaveLength(2);
  });

  it('removes a debate after asking', () => {
    const { state } = renderSetup({ tab: 'debates', initial: withDebate({ pro: ['Ann'] }) });
    fireEvent.click(screen.getByRole('button', { name: 'Remove debate 1' }));
    const question = screen.getByRole('group', { name: 'Remove debate 1' });
    expect(question).toHaveTextContent('Remove this debate, with its names and results?');

    fireEvent.click(within(question).getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: 'Remove debate 1' })).toHaveFocus();
    expect(state().session.debates).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Remove debate 1' }));
    fireEvent.keyDown(screen.getByRole('button', { name: 'Cancel' }), { key: 'Escape' });
    expect(state().session.debates).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Remove debate 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove debate' }));
    expect(state().session.debates).toEqual([]);
    expect(screen.getByRole('combobox', { name: 'Topic' })).toHaveFocus();
  });

  it('says when a debate is about a topic that is no longer in the setup', () => {
    const initial = withDebate();
    renderSetup({
      tab: 'debates',
      initial: {
        ...initial,
        config: { ...config, topics: config.topics.filter((topic) => topic.id !== 't2') },
      },
    });
    expect(
      within(debate(1)).getByText('This topic is no longer in the setup.'),
    ).toBeInTheDocument();
  });

  it('is in Dutch, with the sides as the setup names them', () => {
    renderSetup({
      tab: 'debates',
      locale: 'nl',
      initial: withDebate({ pro: ['Ann', 'Bert'], con: ['Dirk', 'Eva'] }),
    });
    const article = screen.getByRole('article', { name: 'Debat 1' });
    expect(within(article).getByRole('group', { name: 'FOR' })).toBeInTheDocument();
    expect(within(article).getByRole('button', { name: 'Beginnen' })).toBeEnabled();
    expect(within(article).getByText('Klaar')).toBeInTheDocument();
    expect(within(article).getAllByText('Volledig')).toHaveLength(2);
    expect(within(article).getAllByRole('textbox', { name: 'Naam 3' })[0]).toHaveAttribute(
      'placeholder',
      'Naam 3 (mag leeg)',
    );
  });
});
