import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GRAFFITI_PRESET } from '../model/presets';
import { initialState, type AppState } from '../model/reducer';
import type { SavedResult } from '../model/reportFile';
import type { IncomingReport } from '../share/incoming';
import { renderWithI18n } from '../test/i18n';
import { playedSession } from '../test/playedSession';
import { ReportPreviewScreen } from './ReportPreviewScreen';

const english = GRAFFITI_PRESET.build('en');

function show(
  result: SavedResult | null,
  { state = initialState(english), locale = 'en' }: { state?: AppState; locale?: 'en' | 'nl' } = {},
) {
  const onLoad = vi.fn<(state: AppState) => void>();
  const onClose = vi.fn<() => void>();
  const incoming: IncomingReport = {
    source: { kind: 'report', name: 'debate-2026-10-12.html' },
    result,
  };
  renderWithI18n(
    <ReportPreviewScreen incoming={incoming} state={state} onLoad={onLoad} onClose={onClose} />,
    { locale },
  );
  return { onLoad, onClose };
}

const heading = () => screen.getByRole('heading', { level: 1 });

describe('a report opened in the app', () => {
  it('says it is being read, and can be left meanwhile', () => {
    const { onClose } = show(null);
    expect(heading()).toHaveTextContent('Reading the report…');
    expect(heading()).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('shows its debates, with topic, status and names, and its setup', () => {
    const loaded = playedSession();
    show({ ok: true, state: loaded });

    expect(heading()).toHaveTextContent('Load this report?');
    expect(heading()).toHaveFocus();
    expect(
      screen.getByText(
        'This report comes from the file “debate-2026-10-12.html”. Nothing changes until you choose to load it.',
      ),
    ).toBeInTheDocument();
    const debates = within(screen.getByRole('region', { name: 'Debates in the report' }));
    const items = debates.getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent('Debate 1');
    expect(items[0]).toHaveTextContent('Finished');
    expect(items[0]).toHaveTextContent(english.topics[0].text);
    expect(items[0]).toHaveTextContent('FOR: Ann, Bert · AGAINST: Dirk, Eva');
    expect(items[1]).toHaveTextContent('Started');
    expect(items[2]).toHaveTextContent('Ready');
    // The setup it brings, as a shared setup shows it.
    expect(screen.getByRole('region', { name: 'Topics' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Format' })).toBeInTheDocument();
  });

  it('says what loading it replaces', () => {
    show({ ok: true, state: playedSession() });
    expect(screen.getByRole('note')).toHaveTextContent(
      'Loading it replaces the setup in this browser.',
    );
  });

  it('warns that the debates here and their results go', () => {
    show({ ok: true, state: playedSession() }, { state: playedSession() });
    expect(screen.getByRole('note')).toHaveTextContent(
      'Loading it replaces the setup and the 3 debates in this browser, 2 of them with results. Download a report of those first to keep them.',
    );
  });

  it('loads the state it holds when asked', () => {
    const loaded = playedSession();
    const { onLoad, onClose } = show({ ok: true, state: loaded });
    fireEvent.click(screen.getByRole('button', { name: 'Load report' }));
    expect(onLoad).toHaveBeenCalledWith(loaded);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('says what is wrong with a file that is not a report', () => {
    const { onLoad, onClose } = show({
      ok: false,
      issues: [{ code: 'not-a-report', path: [] }],
    });
    expect(heading()).toHaveTextContent('This file cannot be used');
    expect(screen.getByText('It does not hold a report that this app can read.')).toBeVisible();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'This is not a report made by this app: it holds no debates to load.',
    );
    expect(screen.queryByRole('button', { name: 'Load report' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Continue to the app' }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(onLoad).not.toHaveBeenCalled();
  });

  it('says where the setup inside is wrong', () => {
    show({
      ok: false,
      issues: [{ code: 'empty', path: ['topics', 2, 'text'] }],
    });
    expect(screen.getByRole('alert')).toHaveTextContent('Topic 3: This cannot be empty.');
  });

  it('is in Dutch too', () => {
    show({ ok: true, state: playedSession() }, { locale: 'nl', state: playedSession() });
    expect(heading()).toHaveTextContent('Dit verslag laden?');
    expect(screen.getByRole('button', { name: 'Verslag laden' })).toBeInTheDocument();
    expect(screen.getByRole('note')).toHaveTextContent(
      'Laden vervangt de opzet en de 3 debatten in deze browser, waarvan 2 met resultaten.',
    );
  });
});
