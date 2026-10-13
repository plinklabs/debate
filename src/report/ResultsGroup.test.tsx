import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GRAFFITI_PRESET } from '../model/presets';
import { freeze, initialState } from '../model/reducer';
import { readReportText } from '../model/reportFile';
import { catchDownload } from '../test/download';
import { playedSession } from '../test/playedSession';
import { renderSetup } from '../test/setupScreen';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const results = () => screen.getByRole('region', { name: 'Results' });

/** The bytes of a saved file, BOM included (`Blob.text()` drops it). */
async function bytes(blob: Blob): Promise<number[]> {
  return [...new Uint8Array(await blob.arrayBuffer())];
}

describe('the results on the debates tab', () => {
  it('only offers to open a report while no debate has results', () => {
    renderSetup({ tab: 'debates' });
    const group = results();
    expect(group).toHaveTextContent('No results yet.');
    expect(
      within(group)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['Open a report']);
  });

  it('offers the report and the CSV once a debate has results', () => {
    renderSetup({ tab: 'debates', initial: playedSession() });
    expect(
      within(results())
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['Download report (HTML)', 'Download CSV', 'Open a report']);
    expect(results()).toHaveTextContent('The report holds every debate with results');
  });

  it('says which debate was just finished', () => {
    renderSetup({ tab: 'debates', initial: playedSession(), finishedDebate: 'd1' });
    expect(within(results()).getByText('Debate 1 is finished.')).toBeInTheDocument();
  });

  it('downloads the report of every debate with results, as a dated .html file', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 12, 15, 30));
    const saved = catchDownload();
    const state = playedSession();
    renderSetup({ tab: 'debates', initial: state });

    fireEvent.click(screen.getByRole('button', { name: 'Download report (HTML)' }));

    expect(saved).toHaveLength(1);
    expect(saved[0].name).toBe('debate-2026-10-12.html');
    expect(saved[0].blob.type).toBe('text/html;charset=utf-8');
    const html = await saved[0].blob.text();
    expect(html).toContain('<title>Debate report — October 12, 2026</title>');
    expect(html).toContain('Debate 2');
    // The report is the save file too.
    expect(readReportText(html)).toEqual({ ok: true, state: freeze(state, 0) });
  });

  it('downloads the CSV, with its BOM, in the UI language', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 12, 15, 30));
    const saved = catchDownload();
    renderSetup({
      tab: 'debates',
      locale: 'nl',
      initial: playedSession(GRAFFITI_PRESET.build('nl')),
    });

    fireEvent.click(screen.getByRole('button', { name: 'CSV downloaden' }));

    expect(saved[0].name).toBe('debat-2026-10-12.csv');
    expect(saved[0].blob.type).toBe('text/csv;charset=utf-8');
    expect((await bytes(saved[0].blob)).slice(0, 3)).toEqual([0xef, 0xbb, 0xbf]);
    const text = await saved[0].blob.text();
    expect(text.startsWith('Debat;Stelling;Kant;Leerling;')).toBe(true);
    expect(text).toContain(';14,2;ja\r\n');
  });

  it('hands a picked report file on, to show before it is loaded', () => {
    const onOpenReport = vi.fn<(file: File) => void>();
    const { container } = renderSetup({
      tab: 'debates',
      initial: initialState(GRAFFITI_PRESET.build('en')),
      onOpenReport,
    });
    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    if (input === null) throw new Error('No file input');
    expect(input).toHaveAttribute('accept', '.html,.htm,text/html');
    const click = vi.spyOn(input, 'click').mockImplementation(() => {});
    fireEvent.click(screen.getByRole('button', { name: 'Open a report' }));
    expect(click).toHaveBeenCalledOnce();

    const file = new File(['<html></html>'], 'debate-2026-10-12.html', { type: 'text/html' });
    fireEvent.change(input, { target: { files: [file] } });
    expect(onOpenReport).toHaveBeenCalledWith(file);
  });
});
