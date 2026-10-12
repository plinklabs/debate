import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GRAFFITI_PRESET } from '../model/presets';
import { initialState, reducer } from '../model/reducer';
import { renderSetup } from '../test/setupScreen';

const config = GRAFFITI_PRESET.build('en');

const topicTexts = (state: { config: { topics: readonly { text: string }[] } }) =>
  state.config.topics.map((topic) => topic.text);

describe('the topics', () => {
  it('lists every topic of the setup as a field of its own', () => {
    renderSetup();
    expect(screen.getByRole('heading', { level: 2, name: 'Topics' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Topic 4' })).toHaveValue(config.topics[3].text);
    expect(screen.getAllByRole('textbox', { name: /^Topic \d$/ })).toHaveLength(5);
  });

  it('adds a topic, with Enter or the button, and refuses an empty one', () => {
    const { state } = renderSetup();
    const field = screen.getByRole('textbox', { name: 'New topic' });
    const add = screen.getByRole('button', { name: 'Add topic' });

    fireEvent.click(add);
    expect(field).toHaveAccessibleDescription('This cannot be empty.');
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(state().config.topics).toHaveLength(5);

    fireEvent.change(field, { target: { value: 'Museums should be free.' } });
    expect(field).not.toHaveAttribute('aria-invalid');
    fireEvent.click(add);
    expect(topicTexts(state()).at(-1)).toBe('Museums should be free.');
    expect(field).toHaveValue('');

    fireEvent.change(field, { target: { value: 'Homework is\nuseless.' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(topicTexts(state()).at(-1)).toBe('Homework is useless.');
    expect(screen.getByRole('textbox', { name: 'Topic 7' })).toHaveValue('Homework is useless.');
  });

  it('keeps an edit at once, and an emptied topic only in its field, with a message', () => {
    const { state } = renderSetup();
    const field = screen.getByRole('textbox', { name: 'Topic 2' });

    fireEvent.change(field, { target: { value: 'Street art belongs in museums.' } });
    expect(state().config.topics[1]).toEqual({ id: 't2', text: 'Street art belongs in museums.' });

    fireEvent.change(field, { target: { value: '   ' } });
    expect(field).toHaveValue('   ');
    expect(field).toHaveAccessibleDescription('This cannot be empty.');
    // The setup keeps the last valid text.
    expect(state().config.topics[1].text).toBe('Street art belongs in museums.');

    fireEvent.change(field, { target: { value: 'Street art is art.' } });
    expect(field).not.toHaveAccessibleDescription();
    expect(state().config.topics[1].text).toBe('Street art is art.');
  });

  it('moves topics up and down, but not past either end', () => {
    const { state } = renderSetup();
    const before = state();
    const up = screen.getByRole('button', { name: 'Move topic 1 up' });
    expect(up).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(up);
    expect(state()).toBe(before);

    fireEvent.click(screen.getByRole('button', { name: 'Move topic 1 down' }));
    expect(state().config.topics.map((topic) => topic.id)).toEqual(['t2', 't1', 't3', 't4', 't5']);
    expect(screen.getByRole('textbox', { name: 'Topic 2' })).toHaveValue(config.topics[0].text);
    expect(screen.getByRole('button', { name: 'Move topic 5 down' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });

  it('removes a topic, but keeps the last one and those that debates use', () => {
    let initial = initialState(config);
    initial = reducer(initial, { type: 'add-debate', topicId: 't3' });
    initial = reducer(initial, { type: 'add-debate', topicId: 't3' });
    const { state } = renderSetup({ initial });

    const used = screen.getByRole('textbox', { name: 'Topic 3' });
    expect(used).toHaveAccessibleDescription('Used by 2 debates.');
    expect(screen.getByRole('button', { name: 'Remove topic 3' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );

    for (const number of [5, 4, 2]) {
      fireEvent.click(screen.getByRole('button', { name: `Remove topic ${number}` }));
    }
    expect(state().config.topics.map((topic) => topic.id)).toEqual(['t1', 't3']);

    fireEvent.click(screen.getByRole('button', { name: 'Remove topic 1' }));
    expect(state().config.topics.map((topic) => topic.id)).toEqual(['t3']);
    // The focus moves on to the topic that took its place.
    expect(screen.getByRole('button', { name: 'Remove topic 1' })).toHaveFocus();
    const last = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(last).toHaveLength(1);
  });

  it('is in Dutch, with the teacher’s topics as they were typed', () => {
    renderSetup({ locale: 'nl', initial: initialState(config) });
    expect(screen.getByRole('heading', { level: 2, name: 'Stellingen' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Stelling 1' })).toHaveValue(config.topics[0].text);
    expect(screen.getByRole('button', { name: 'Stelling 1 verwijderen' })).toHaveTextContent(
      'Verwijderen',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Stelling toevoegen' }));
    expect(screen.getByRole('textbox', { name: 'Nieuwe stelling' })).toHaveAccessibleDescription(
      'Dit mag niet leeg zijn.',
    );
  });
});
