// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { playedSession } from '../test/playedSession';
import { reducer } from './reducer';
import {
  MAX_REPORT_BYTES,
  SAVED_STATE_ID,
  jsonForScript,
  parseSavedState,
  readReportFile,
  readReportText,
  savedStateScript,
} from './reportFile';
import { freeze } from './reducer';
import { STORAGE_VERSION, serializeState } from './storage';

const MALICIOUS = '<img src=x onerror=alert(1)></script><script>alert(2)</script>';

/** A page around a script element, as a report file has it. */
function page(script: string): string {
  return `<!doctype html><html><body><main><p>Report</p></main>${script}</body></html>`;
}

describe('jsonForScript', () => {
  it('writes <, > and & as escapes that JSON reads back as the same text', () => {
    const json = JSON.stringify({ name: MALICIOUS, also: 'a & b > c', line: 'x\u2028y' });
    const safe = jsonForScript(json);
    expect(safe).not.toMatch(/[<>&\u2028\u2029]/);
    expect(safe).toContain('\\u003c/script\\u003e');
    expect(JSON.parse(safe)).toEqual(JSON.parse(json));
  });
});

describe('savedStateScript', () => {
  it('is one script element of JSON, which no name can end early', () => {
    const state = playedSession(undefined, { eva: MALICIOUS });
    const script = savedStateScript(state, 0);
    expect(script.startsWith(`<script type="application/json" id="${SAVED_STATE_ID}">`)).toBe(true);
    expect(script.match(/<script/g)).toHaveLength(1);
    expect(script.match(/<\/script/g)).toHaveLength(1);
    expect(script.endsWith('</script>')).toBe(true);
  });

  it('holds the state as it is stored, with every clock paused at now', () => {
    const running = reducer(
      reducer(playedSession(), { type: 'open-debate', debateId: 'd2', now: 0 }),
      {
        type: 'go-to-step',
        step: 3,
        now: 0,
      },
    );
    const state = reducer(running, { type: 'toggle-timer', now: 1_000 });
    const script = savedStateScript(state, 5_000);
    const json = script.replace(/^<script[^>]*>/, '').replace(/<\/script>$/, '');
    expect(json).toBe(jsonForScript(serializeState(state, 5_000)));
    const saved = JSON.parse(json);
    expect(saved.version).toBe(STORAGE_VERSION);
    expect(saved.session.debates[1].records.consultation.timer).toEqual({
      accMs: 4_000,
      since: null,
    });
  });
});

describe('readReportText', () => {
  it('reads back the state a report holds, the same as it was saved', () => {
    const state = playedSession(undefined, { ann: MALICIOUS, eva: 'Eva </SCRIPT >' });
    const result = readReportText(page(savedStateScript(state, 0)));
    expect(result).toEqual({ ok: true, state: freeze(state, 0) });
  });

  it('finds the element whatever the order of its attributes', () => {
    const state = playedSession();
    const json = jsonForScript(serializeState(state, 0));
    const html = page(`<SCRIPT id='${SAVED_STATE_ID}' type="application/json">${json}</script >`);
    expect(readReportText(html)).toEqual({ ok: true, state });
  });

  it('says a page without the element, or with broken data, is not a report', () => {
    const notAReport = { ok: false, issues: [{ code: 'not-a-report', path: [] }] };
    expect(readReportText('<!doctype html><title>Holiday photos</title>')).toEqual(notAReport);
    expect(
      readReportText(page(`<script type="application/json" id="${SAVED_STATE_ID}">{"ver`)),
    ).toEqual(notAReport);
    expect(
      readReportText(page(`<script type="application/json" id="${SAVED_STATE_ID}">[1]</script>`)),
    ).toEqual(notAReport);
  });

  it('checks the setup inside like any setup from outside', () => {
    const state = playedSession();
    const data = JSON.parse(serializeState(state, 0));
    data.config.topics[0].text = ' ';
    data.config.format.steps[1].seconds = 0;
    const html = page(
      `<script type="application/json" id="${SAVED_STATE_ID}">${jsonForScript(JSON.stringify(data))}</script>`,
    );
    const result = readReportText(html);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues).toEqual([
      expect.objectContaining({ code: 'out-of-range', path: ['format', 'steps', 1, 'seconds'] }),
      expect.objectContaining({ code: 'empty', path: ['topics', 0, 'text'] }),
    ]);
  });
});

describe('parseSavedState', () => {
  const saved = () => JSON.parse(serializeState(playedSession(), 0));

  it('reads the session like a stored one: paused, cut to its limits, without junk', () => {
    const data = saved();
    data.session.debates[0].records['opening-pro'].timer = { accMs: 72_000, since: 123 };
    data.session.debates[0].teams.pro[0] = 'A'.repeat(100);
    data.session.debates[0].records['not an id'] = { type: 'speech' };
    data.session.debates.push({ id: '../evil', topicId: 't1' }, 'nonsense');
    const result = parseSavedState(data);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const [debate] = result.state.session.debates;
    expect(debate.records['opening-pro']).toMatchObject({ timer: { accMs: 72_000, since: null } });
    expect(debate.teams.pro[0]).toHaveLength(40);
    expect(Object.keys(debate.records)).not.toContain('not an id');
    expect(result.state.session.debates.map((d) => d.id)).toEqual(['d1', 'd2', 'd3']);
  });

  it('says so when the report comes from a newer version of the app', () => {
    expect(parseSavedState({ ...saved(), version: STORAGE_VERSION + 1 })).toEqual({
      ok: false,
      issues: [{ code: 'newer-version', path: [], found: 2, supported: 1 }],
    });
  });

  it('refuses data without a version or a setup', () => {
    const { version: _version, ...withoutVersion } = saved();
    const { config: _config, ...withoutConfig } = saved();
    for (const data of [withoutVersion, withoutConfig, null, 'text', []]) {
      expect(parseSavedState(data)).toEqual({
        ok: false,
        issues: [{ code: 'not-a-report', path: [] }],
      });
    }
  });

  it('keeps a setup without debates', () => {
    const data = saved();
    delete data.session;
    const result = parseSavedState(data);
    expect(result.ok && result.state.session).toEqual({ debates: [], current: null });
  });
});

describe('readReportFile', () => {
  it('reads a file', async () => {
    const state = playedSession();
    const file = new Blob([page(savedStateScript(state, 0))], { type: 'text/html' });
    expect(await readReportFile(file)).toEqual({ ok: true, state });
  });

  it('refuses a file larger than a report can be, without reading it', async () => {
    const file = new Blob([new Uint8Array(MAX_REPORT_BYTES + 1)]);
    expect(await readReportFile(file)).toEqual({
      ok: false,
      issues: [{ code: 'too-large', path: [] }],
    });
  });
});
