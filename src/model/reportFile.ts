// The report as a save file (#7). A report embeds the whole app state, the
// setup and the session, as JSON in a script element that does not run:
//
//   <script type="application/json" id="debate-session">{"version":1,…}</script>
//
// Opening the report in the app reads it back, so a teacher can go on with
// the debates or correct them on another computer.
//
// Names, topics and labels are typed by people, so the JSON is written so
// that no text in it can end the script element: every `<`, `>` and `&` is a
// \u escape, which JSON reads back as the same character. Reading back checks
// everything like any other input from outside: the setup with `parseConfig`
// (the same checks as a link or a setup file), the session like what is
// stored in the browser (`readSession`).

import type { AppState } from './reducer';
import { STORAGE_VERSION, readSession, serializeState } from './storage';
import { parseConfig, type ConfigIssue } from './validate';

/** The id of the script element that holds the saved state. */
export const SAVED_STATE_ID = 'debate-session';

/**
 * Most bytes a report file may have. A report of a full school year stays
 * far below it; a larger file is not a report this app made.
 */
export const MAX_REPORT_BYTES = 8 * 1024 * 1024;

export type SavedResult =
  | { readonly ok: true; readonly state: AppState }
  | { readonly ok: false; readonly issues: readonly ConfigIssue[] };

const NOT_A_REPORT: SavedResult = { ok: false, issues: [{ code: 'not-a-report', path: [] }] };
const TOO_LARGE: SavedResult = { ok: false, issues: [{ code: 'too-large', path: [] }] };

/**
 * JSON as the text of a script element: `<`, `>` and `&` (and the two
 * characters that end a line in JavaScript) as \u escapes. Outside strings,
 * JSON has none of these, so the result is the same JSON.
 */
export function jsonForScript(json: string): string {
  return json.replace(
    /[<>&\u2028\u2029]/g,
    (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`,
  );
}

/** The script element that carries the state, with every timer paused at `now`. */
export function savedStateScript(state: AppState, now: number): string {
  return `<script type="application/json" id="${SAVED_STATE_ID}">${jsonForScript(serializeState(state, now))}</script>`;
}

// The first script element with the id, whatever its other attributes. Its
// text cannot hold `</script` (see `jsonForScript`), so it ends at the first one.
const SCRIPT = new RegExp(
  `<script\\b[^>]*\\bid\\s*=\\s*["']?${SAVED_STATE_ID}["']?[^>]*>([\\s\\S]*?)</script\\s*>`,
  'i',
);

/** The state saved in the text of a report, checked. */
export function readReportText(html: string): SavedResult {
  const found = SCRIPT.exec(html);
  if (found === null) return NOT_A_REPORT;
  let data: unknown;
  try {
    data = JSON.parse(found[1]);
  } catch {
    return NOT_A_REPORT;
  }
  return parseSavedState(data);
}

/** The state saved in a report file (a `File` from a file input), checked. */
export async function readReportFile(file: Blob): Promise<SavedResult> {
  if (file.size > MAX_REPORT_BYTES) return TOO_LARGE;
  let text: string;
  try {
    text = await file.text();
  } catch {
    return NOT_A_REPORT;
  }
  return readReportText(text);
}

/**
 * A saved state as decoded from JSON: `{ version, config, session }`, as
 * `serializeState` writes it. The setup must pass `parseConfig`, and its
 * issues come back as they are, with paths from the setup's root; the session
 * is read like a stored one, so what does not fit is dropped.
 */
export function parseSavedState(data: unknown): SavedResult {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return NOT_A_REPORT;
  const { version, config, session } = data as Record<string, unknown>;
  if (typeof version === 'number' && Number.isInteger(version) && version > STORAGE_VERSION) {
    return {
      ok: false,
      issues: [{ code: 'newer-version', path: [], found: version, supported: STORAGE_VERSION }],
    };
  }
  if (version !== STORAGE_VERSION || config === undefined) return NOT_A_REPORT;
  const parsed = parseConfig(config);
  if (!parsed.ok) return parsed;
  return { ok: true, state: { config: parsed.config, session: readSession(session) } };
}
