import { act, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from './App';
import { setStepSeconds, setTopicText } from './model/edit';
import { GRAFFITI_PRESET } from './model/presets';
import { initialState, reducer, type Action } from './model/reducer';
import { configFileText, encodeConfig } from './model/share';
import { STORAGE_KEY, saveState } from './model/storage';
import { renderWithI18n } from './test/i18n';

afterEach(() => {
  localStorage.clear();
  window.history.replaceState(null, '', '/');
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
      'Share',
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

describe('a shared setup in the app', () => {
  const english = GRAFFITI_PRESET.build('en');
  const shared = setStepSeconds(
    setTopicText(english, 't1', 'Homework should be banned.'),
    'opening-pro',
    75,
  );

  /** Opens the page at a link to `config`, as a browser would. */
  async function openLinkTo(config = shared) {
    window.history.replaceState(null, '', `/#c=${await encodeConfig(config)}`);
  }

  const heading = () => screen.getByRole('heading', { level: 1 });

  function openFile(container: HTMLElement, file: File) {
    fireEvent.click(screen.getByRole('tab', { name: 'Share' }));
    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    if (input === null) throw new Error('No file input');
    fireEvent.change(input, { target: { files: [file] } });
  }

  it('shows the setup from a link first, and uses it when asked', async () => {
    await openLinkTo();
    renderWithI18n(<App />);

    // Straight away, not after the setup screen has flashed by.
    expect(heading()).toHaveTextContent('Reading the setup…');
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Use this setup?' })).toHaveFocus();
    expect(screen.getByText('Homework should be banned.')).toBeInTheDocument();
    // Nothing has changed yet.
    expect(stored().config).toEqual(english);

    fireEvent.click(screen.getByRole('button', { name: 'Use this setup' }));

    expect(heading()).toHaveTextContent('Debate — by Plink Labs');
    expect(heading()).toHaveFocus();
    expect(screen.getByRole('tab', { name: 'Topics' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('textbox', { name: 'Topic 1' })).toHaveValue(
      'Homework should be banned.',
    );
    expect(stored().config).toEqual(shared);
    // The link is gone from the address, so a reload does not ask again.
    expect(window.location.hash).toBe('');
    expect(window.location.pathname).toBe('/');
  });

  it('leaves the setup as it was when cancelled', async () => {
    await openLinkTo();
    const first = renderWithI18n(<App />);
    await screen.findByRole('heading', { name: 'Use this setup?' });

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(heading()).toHaveTextContent('Debate — by Plink Labs');
    expect(screen.getByRole('textbox', { name: 'Topic 1' })).toHaveValue(english.topics[0].text);
    expect(stored().config).toEqual(english);
    expect(window.location.hash).toBe('');
    first.unmount();

    renderWithI18n(<App />);
    expect(heading()).toHaveTextContent('Debate — by Plink Labs');
  });

  it('shows a link opened while the app is open, and lets it go on Back', async () => {
    renderWithI18n(<App />);
    expect(heading()).toHaveTextContent('Debate — by Plink Labs');

    const encoded = await encodeConfig(shared);
    act(() => {
      window.location.hash = `c=${encoded}`;
    });
    expect(await screen.findByRole('heading', { name: 'Use this setup?' })).toBeInTheDocument();

    // Back in the browser, to the address without the link.
    act(() => {
      window.location.hash = '';
    });
    expect(await screen.findByRole('tablist')).toBeInTheDocument();
    expect(stored().config).toEqual(english);
  });

  it('says what is wrong with a broken link, and goes on to the app', async () => {
    window.history.replaceState(null, '', '/#c=this-is-not-a-setup');
    renderWithI18n(<App />);

    expect(
      await screen.findByRole('heading', { name: 'This link cannot be used' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('This link is damaged or incomplete.');

    fireEvent.click(screen.getByRole('button', { name: 'Continue to the app' }));

    expect(heading()).toHaveTextContent('Debate — by Plink Labs');
    expect(window.location.hash).toBe('');
    expect(stored().config).toEqual(english);
  });

  it('closes the open debate when a shared setup is used, and keeps the names', async () => {
    storeReadyDebate();
    const first = renderWithI18n(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    expect(stored().session.current).toBe('d1');
    first.unmount();

    await openLinkTo();
    renderWithI18n(<App />);
    await screen.findByRole('heading', { name: 'Use this setup?' });
    fireEvent.click(screen.getByRole('button', { name: 'Use this setup' }));

    expect(heading()).toHaveTextContent('Debate — by Plink Labs');
    expect(stored().session.current).toBeNull();
    expect(stored().session.debates[0].teams.pro).toEqual(['Ann', 'Bert', '']);
    expect(stored().config).toEqual(shared);
  });

  it('goes back to the open debate when a shared setup is not used', async () => {
    storeReadyDebate();
    const first = renderWithI18n(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    first.unmount();

    await openLinkTo();
    renderWithI18n(<App />);
    await screen.findByRole('heading', { name: 'Use this setup?' });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(heading()).toHaveTextContent(english.topics[2].text);
    expect(heading()).toHaveFocus();
    expect(stored().session.current).toBe('d1');
  });

  it('opens a setup file from the Share tab through the same preview', async () => {
    const { container } = renderWithI18n(<App />);
    openFile(
      container,
      new File([configFileText(shared)], 'graffiti.json', { type: 'application/json' }),
    );

    expect(await screen.findByRole('heading', { name: 'Use this setup?' })).toBeInTheDocument();
    expect(
      screen.getByText(
        'This setup comes from the file “graffiti.json”. Nothing changes until you choose to use it.',
      ),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Use this setup' }));

    expect(screen.getByRole('tab', { name: 'Topics' })).toHaveAttribute('aria-selected', 'true');
    expect(stored().config).toEqual(shared);
  });

  it('says what is wrong with a file that is not a setup', async () => {
    const { container } = renderWithI18n(<App />);
    openFile(container, new File(['{"name": "Ann"}'], 'class.json'));

    expect(
      await screen.findByRole('heading', { name: 'This file cannot be used' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Version: This field is missing.');
    fireEvent.click(screen.getByRole('button', { name: 'Continue to the app' }));
    expect(screen.getByRole('tab', { name: 'Share' })).toHaveAttribute('aria-selected', 'true');
  });
});
