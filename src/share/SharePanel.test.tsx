import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DebateConfig } from '../model/config';
import { setTopicText } from '../model/edit';
import { GRAFFITI_PRESET } from '../model/presets';
import { initialState, reducer, type Action } from '../model/reducer';
import { configFileText, decodeConfig, readLinkHash } from '../model/share';
import { unpack } from '../test/link';
import { renderSetup } from '../test/setupScreen';

const english = GRAFFITI_PRESET.build('en');

afterEach(() => {
  Reflect.deleteProperty(navigator, 'clipboard');
  vi.restoreAllMocks();
});

function setClipboard(writeText: (text: string) => Promise<void>) {
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
}

async function linkField() {
  const field = screen.getByRole<HTMLInputElement>('textbox', { name: 'Link to this setup' });
  await waitFor(() => expect(field.value).toContain('#c='));
  return field;
}

/** The setup in a link, read back the way the app reads one. */
async function configIn(link: string): Promise<DebateConfig> {
  const result = await decodeConfig(readLinkHash(new URL(link).hash) ?? '');
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.config;
}

/** Catches the file the panel hands the browser to save. */
function catchDownload() {
  const saved: { name: string; blob: Blob }[] = [];
  const blobs: Blob[] = [];
  vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
    blobs.push(blob as Blob);
    return `blob:setup-${blobs.length}`;
  });
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    const index = Number(this.href.replace('blob:setup-', '')) - 1;
    saved.push({ name: this.download, blob: blobs[index] });
  });
  return saved;
}

describe('the share panel', () => {
  it('shows a link to the setup as it is now, and keeps it up to date', async () => {
    renderSetup({ tab: 'share' });
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Share');
    const field = await linkField();
    expect(field).toHaveAttribute('readonly');
    expect(field.value).toMatch(/^http:\/\/localhost(:\d+)?\/#c=[A-Za-z0-9_-]+$/);
    expect(await configIn(field.value)).toEqual(english);
    expect(field).toHaveAccessibleDescription(
      'Whoever opens it sees the setup first, and then chooses whether to use it.',
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Topics' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Topic 1' }), {
      target: { value: 'Homework should be banned.' },
    });
    fireEvent.click(screen.getByRole('tab', { name: 'Share' }));
    const updated = await linkField();
    expect(await configIn(updated.value)).toEqual(
      setTopicText(english, 't1', 'Homework should be banned.'),
    );
  });

  it('copies the link with its one magenta button', async () => {
    const writeText = vi.fn((_text: string) => Promise.resolve());
    setClipboard(writeText);
    renderSetup({ tab: 'share' });
    const field = await linkField();
    const copy = screen.getByRole('button', { name: 'Copy link' });
    expect(copy.className).toMatch(/primary/);
    expect(document.querySelectorAll('[class*="primary"]')).toHaveLength(1);

    fireEvent.click(copy);

    expect(await screen.findByRole('status')).toHaveTextContent('Link copied.');
    expect(writeText).toHaveBeenCalledWith(field.value);
  });

  it.each([
    ['has no clipboard', () => Reflect.deleteProperty(navigator, 'clipboard')],
    ['refuses to copy', () => setClipboard(() => Promise.reject(new Error('Not allowed')))],
  ])('selects the link for copying by hand when the browser %s', async (_, prepare) => {
    prepare();
    renderSetup({ tab: 'share' });
    const field = await linkField();

    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }));

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        'This browser does not let the app copy. The link is selected: copy it with Ctrl+C, or Cmd+C on a Mac.',
      ),
    );
    expect(field).toHaveFocus();
    expect(field.selectionStart).toBe(0);
    expect(field.selectionEnd).toBe(field.value.length);
  });

  it('downloads the setup as a pretty-printed .json file', async () => {
    const saved = catchDownload();
    renderSetup({ tab: 'share' });

    fireEvent.click(screen.getByRole('button', { name: 'Download file' }));

    expect(saved).toHaveLength(1);
    expect(saved[0].name).toBe('debate-setup.json');
    expect(saved[0].blob.type).toBe('application/json');
    expect(await saved[0].blob.text()).toBe(configFileText(english));
  });

  it('names the file in the language of the UI', () => {
    const saved = catchDownload();
    renderSetup({ tab: 'share', locale: 'nl' });
    fireEvent.click(screen.getByRole('button', { name: 'Bestand downloaden' }));
    expect(saved[0].name).toBe('debatopzet.json');
  });

  it('opens a file to show before it is used', () => {
    const onOpenFile = vi.fn<(file: File) => void>();
    const { container } = renderSetup({ tab: 'share', onOpenFile });
    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    expect(input).not.toBeNull();
    expect(input).toHaveAttribute('accept', '.json,application/json');
    const pick = vi.spyOn(input!, 'click').mockImplementation(() => {});

    fireEvent.click(screen.getByRole('button', { name: 'Open a file' }));
    expect(pick).toHaveBeenCalledOnce();

    const file = new File([configFileText(english)], 'graffiti.json', {
      type: 'application/json',
    });
    fireEvent.change(input!, { target: { files: [file] } });
    expect(onOpenFile).toHaveBeenCalledWith(file);
  });

  it('never puts names or results in the link or the file', async () => {
    const names = ['Annelies', 'Bertrand', 'Dirkjan', 'Evangeline'];
    const actions: Action[] = [
      { type: 'add-debate', topicId: 't2' },
      { type: 'set-name', debateId: 'd1', side: 'pro', slot: 0, name: names[0] },
      { type: 'set-name', debateId: 'd1', side: 'pro', slot: 1, name: names[1] },
      { type: 'set-name', debateId: 'd1', side: 'con', slot: 0, name: names[2] },
      { type: 'set-name', debateId: 'd1', side: 'con', slot: 1, name: names[3] },
      { type: 'open-debate', debateId: 'd1', now: 0 },
      { type: 'set-votes', side: 'pro', value: 17 },
      { type: 'close-debate', now: 1 },
    ];
    const initial = actions.reduce(reducer, initialState(english));
    const saved = catchDownload();
    renderSetup({ tab: 'share', initial });

    const field = await linkField();
    fireEvent.click(screen.getByRole('button', { name: 'Download file' }));
    const file = await saved[0].blob.text();
    // The JSON in the link as it is, not as the app would read it back.
    const inLink = await unpack(field.value);
    for (const name of names) {
      expect(inLink).not.toContain(name);
      expect(file).not.toContain(name);
    }
    expect(inLink).not.toMatch(/debates|records|votes/);
    expect(file).not.toMatch(/debates|records|votes/);
  });
});
