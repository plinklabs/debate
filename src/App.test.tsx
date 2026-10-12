import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from './App';
import { GRAFFITI_PRESET } from './model/presets';
import { initialState, reducer, type Action } from './model/reducer';
import { STORAGE_KEY, saveState } from './model/storage';
import { renderWithI18n } from './test/i18n';

afterEach(() => {
  localStorage.clear();
});

/** A stored session with one debate and two complete teams. */
function storeReadyDebate(locale: 'en' | 'nl' = 'en') {
  const actions: Action[] = [
    { type: 'add-debate', topicId: 't3' },
    { type: 'set-name', debateId: 'd1', side: 'pro', slot: 0, name: 'Ann' },
    { type: 'set-name', debateId: 'd1', side: 'pro', slot: 1, name: 'Bert' },
    { type: 'set-name', debateId: 'd1', side: 'con', slot: 0, name: 'Dirk' },
    { type: 'set-name', debateId: 'd1', side: 'con', slot: 1, name: 'Eva' },
  ];
  const state = actions.reduce(reducer, initialState(GRAFFITI_PRESET.build(locale)));
  saveState(() => localStorage, state, 0);
}

function stored() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
}

describe('App', () => {
  it('opens on the setup, with the app name as the page heading', () => {
    renderWithI18n(<App />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Debate — by Plink Labs');
    expect(screen.getByRole('tablist', { name: 'Parts of the setup' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Topics' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'Topics',
      'Format',
      'Debates and teams',
    ]);
  });

  it('renders in Dutch, and builds the default setup in the UI language', () => {
    renderWithI18n(<App />, { locale: 'nl' });

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Debat — door Plink Labs');
    expect(screen.getByText('// Opzet')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Taal' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Debatvorm' }));
    expect(screen.getByRole('textbox', { name: 'Voor de stelling' })).toHaveValue('VOOR');
    expect(stored().config).toEqual(GRAFFITI_PRESET.build('nl'));
  });

  it('switches language from the header and leaves the setup’s own labels alone', () => {
    renderWithI18n(<App />);
    fireEvent.click(screen.getByRole('tab', { name: 'Format' }));
    const english = screen.getByRole('button', { name: 'English' });
    const dutch = screen.getByRole('button', { name: 'Nederlands' });
    expect(screen.getByRole('banner')).toContainElement(dutch);
    expect(english).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(dutch);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Debat — door Plink Labs');
    expect(screen.getByRole('tab', { name: 'Debatvorm' })).toHaveAttribute('aria-selected', 'true');
    // Teacher content: the labels it was made with, in English.
    expect(screen.getByRole('textbox', { name: 'Voor de stelling' })).toHaveValue('FOR');
    const step = screen.getByRole('group', { name: 'Stap 4' });
    expect(within(step).getByRole('textbox', { name: 'Titel' })).toHaveValue('Short consultation');
    expect(within(step).getByRole('combobox', { name: 'Soort' })).toHaveDisplayValue('Overleg');
    expect(stored().config).toEqual(GRAFFITI_PRESET.build('en'));
    expect(english).toHaveAttribute('aria-pressed', 'false');
    expect(dutch).toHaveAttribute('aria-pressed', 'true');
    expect(english).toHaveAttribute('lang', 'en');
    expect(dutch).toHaveTextContent('NL');

    fireEvent.click(english);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Debate — by Plink Labs');
  });

  it('keeps every change in this browser and picks up where it was after a reload', () => {
    const first = renderWithI18n(<App />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Topic 1' }), {
      target: { value: 'Homework should be banned.' },
    });
    fireEvent.click(screen.getByRole('tab', { name: 'Debates and teams' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add debate' }));
    fireEvent.change(screen.getAllByRole('textbox', { name: 'Name 1' })[0], {
      target: { value: 'Ann' },
    });
    expect(stored().config.topics[0].text).toBe('Homework should be banned.');
    first.unmount();

    renderWithI18n(<App />);
    // With debates, the setup opens on them.
    expect(screen.getByRole('tab', { name: 'Debates and teams' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    const debate = screen.getByRole('article', { name: 'Debate 1' });
    expect(within(debate).getByText('Homework should be banned.')).toBeInTheDocument();
    expect(within(debate).getAllByRole('textbox', { name: 'Name 1' })[0]).toHaveValue('Ann');
  });

  it('starts a debate on its own screen, keeps it open after a reload, and goes back', () => {
    storeReadyDebate();
    const first = renderWithI18n(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));

    const topic = GRAFFITI_PRESET.build('en').topics[2].text;
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(topic);
    expect(screen.getByRole('heading', { level: 1 })).toHaveFocus();
    expect(screen.getByText('// Debate 1')).toBeInTheDocument();
    expect(screen.getByText('Ann, Bert')).toBeInTheDocument();
    expect(screen.getByText('Dirk, Eva')).toBeInTheDocument();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(stored().session.current).toBe('d1');
    first.unmount();

    renderWithI18n(<App />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(topic);
    fireEvent.click(screen.getByRole('button', { name: /Back to the setup/ }));

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Debate — by Plink Labs');
    expect(screen.getByRole('tab', { name: 'Debates and teams' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Start' })).toHaveFocus();
    expect(stored().session.current).toBeNull();

    // Later visits to the debates tab leave the focus on the tabs.
    const tab = (name: string) => screen.getByRole('tab', { name });
    tab('Debates and teams').focus();
    fireEvent.keyDown(tab('Debates and teams'), { key: 'ArrowLeft' });
    fireEvent.keyDown(tab('Format'), { key: 'ArrowRight' });
    expect(tab('Debates and teams')).toHaveAttribute('aria-selected', 'true');
    expect(tab('Debates and teams')).toHaveFocus();
  });
});
