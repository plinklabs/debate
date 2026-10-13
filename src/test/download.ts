// Catches the files the app hands the browser to save (`saveFile`), in jsdom,
// which has no object URLs. Restore with `vi.restoreAllMocks()`.
import { vi } from 'vitest';

export interface Saved {
  readonly name: string;
  readonly blob: Blob;
}

export function catchDownload(): Saved[] {
  const saved: Saved[] = [];
  const blobs: Blob[] = [];
  vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
    blobs.push(blob as Blob);
    return `blob:saved-${blobs.length}`;
  });
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    const index = Number(this.href.replace('blob:saved-', '')) - 1;
    saved.push({ name: this.download, blob: blobs[index] });
  });
  return saved;
}
