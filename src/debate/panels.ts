import type { Dispatch } from 'react';
import type { Format, Step } from '../model/config';
import type { Action } from '../model/reducer';
import type { Debate } from '../model/session';

/** What the panel of a step gets: the step, the open debate and a way to change it. */
export interface PanelProps<S extends Step> {
  readonly step: S;
  readonly debate: Debate;
  readonly format: Format;
  /** The moment to show clocks at (`useNow`). */
  readonly now: number;
  readonly dispatch: Dispatch<Action>;
}
