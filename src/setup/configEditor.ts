// How the setup screen changes the setup. An edit (src/model/edit.ts) makes a
// candidate config; `apply` runs it through `parseConfig`, the same checks a
// link or a file goes through, and keeps it only when it passes. So the app
// never holds a setup that would not load again after a reload, or that #5
// could not share; what is wrong comes back as issues for the field to show.

import { useMemo, type Dispatch } from 'react';
import type { DebateConfig } from '../model/config';
import type { Action } from '../model/reducer';
import { parseConfig, type ConfigIssue } from '../model/validate';

export const NO_ISSUES: readonly ConfigIssue[] = [];

export interface ConfigEditor {
  /** The setup as it is now. */
  readonly config: DebateConfig;
  /** Keep `candidate` when it is a valid setup and return no issues; otherwise what is wrong. */
  readonly apply: (candidate: DebateConfig) => readonly ConfigIssue[];
  /** Whether `apply` would keep `candidate`: to disable a change that cannot be made. */
  readonly allows: (candidate: DebateConfig) => boolean;
}

export function useConfigEditor(config: DebateConfig, dispatch: Dispatch<Action>): ConfigEditor {
  return useMemo(
    () => ({
      config,
      apply(candidate) {
        if (candidate === config) return NO_ISSUES;
        const result = parseConfig(candidate);
        if (!result.ok) return result.issues;
        dispatch({ type: 'set-config', config: result.config, now: performance.now() });
        return NO_ISSUES;
      },
      allows: (candidate) => candidate !== config && parseConfig(candidate).ok,
    }),
    [config, dispatch],
  );
}

/** A whole number as typed in a number field; anything else becomes `NaN`, which validation refuses. */
export function toInteger(raw: string): number {
  return raw.trim() === '' ? Number.NaN : Number(raw);
}

/** Text from a field that wraps, without its line breaks: a topic is one line. */
export function oneLine(raw: string): string {
  return raw.replace(/\s*[\r\n]+\s*/g, ' ');
}
