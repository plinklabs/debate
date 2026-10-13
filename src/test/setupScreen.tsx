// Renders the setup screen on the real reducer, in a fixed language, and
// keeps the latest app state where a test can read it.
import { useEffect, useReducer, useState } from 'react';
import { GRAFFITI_PRESET } from '../model/presets';
import type { Locale } from '../model/locale';
import { initialState, reducer, type AppState } from '../model/reducer';
import { SetupScreen, type SetupTab } from '../setup/SetupScreen';
import { renderWithI18n } from './i18n';

interface HarnessProps {
  readonly initial: AppState;
  readonly tab: SetupTab;
  readonly onState: (state: AppState) => void;
  readonly onOpenFile: (file: File) => void;
  readonly onOpenReport: (file: File) => void;
  readonly finishedDebate: string | null;
}

function Harness({
  initial,
  tab,
  onState,
  onOpenFile,
  onOpenReport,
  finishedDebate,
}: HarnessProps) {
  const [state, dispatch] = useReducer(reducer, initial);
  const [current, setCurrent] = useState(tab);
  useEffect(() => onState(state), [state, onState]);
  return (
    <SetupScreen
      state={state}
      dispatch={dispatch}
      tab={current}
      onTabChange={setCurrent}
      focusDebate={null}
      finishedDebate={finishedDebate}
      onOpenFile={onOpenFile}
      onOpenReport={onOpenReport}
    />
  );
}

export function renderSetup({
  tab = 'topics',
  locale = 'en',
  initial = initialState(GRAFFITI_PRESET.build(locale)),
  onOpenFile = () => {},
  onOpenReport = () => {},
  finishedDebate = null,
}: {
  tab?: SetupTab;
  locale?: Locale;
  initial?: AppState;
  onOpenFile?: (file: File) => void;
  onOpenReport?: (file: File) => void;
  finishedDebate?: string | null;
} = {}) {
  let latest = initial;
  const onState = (state: AppState) => {
    latest = state;
  };
  const view = renderWithI18n(
    <Harness
      initial={initial}
      tab={tab}
      onState={onState}
      onOpenFile={onOpenFile}
      onOpenReport={onOpenReport}
      finishedDebate={finishedDebate}
    />,
    { locale },
  );
  return { ...view, state: () => latest };
}
