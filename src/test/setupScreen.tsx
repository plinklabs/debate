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
}

function Harness({ initial, tab, onState, onOpenFile }: HarnessProps) {
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
      onOpenFile={onOpenFile}
    />
  );
}

export function renderSetup({
  tab = 'topics',
  locale = 'en',
  initial = initialState(GRAFFITI_PRESET.build(locale)),
  onOpenFile = () => {},
}: {
  tab?: SetupTab;
  locale?: Locale;
  initial?: AppState;
  onOpenFile?: (file: File) => void;
} = {}) {
  let latest = initial;
  const onState = (state: AppState) => {
    latest = state;
  };
  const view = renderWithI18n(
    <Harness initial={initial} tab={tab} onState={onState} onOpenFile={onOpenFile} />,
    { locale },
  );
  return { ...view, state: () => latest };
}
