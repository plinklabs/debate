/**
 * Hand the browser a file to save, as a download: text made in the page, such
 * as a setup (#5) or a report. Nothing is sent anywhere.
 */
export function saveFile(name: string, text: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  // Not at once: some browsers are still reading the file after the click.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
