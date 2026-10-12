// Renders the debate screen on the real reducer, in a fixed language, and
// keeps the latest app state where a test can read it.
import { useEffect, useReducer } from 'react';
import { DebateScreen } from '../debate/DebateScreen';
import type { DebateConfig } from '../model/config';
import type { Locale } from '../model/locale';
import { GRAFFITI_PRESET } from '../model/presets';
import { currentDebate, initialState, reducer, type Action, type AppState } from '../model/reducer';
import { renderWithI18n } from './i18n';

/**
 * Debate 1 on the first topic, open at its first step: Ann and Bert for the
 * topic, Dirk and Eva against it. `actions` follow.
 */
export function openDebate(
  config: DebateConfig = GRAFFITI_PRESET.build('en'),
  ...actions: Action[]
): AppState {
  const setup: Action[] = [
    { type: 'add-debate', topicId: config.topics[0].id },
    { type: 'set-name', debateId: 'd1', side: 'pro', slot: 0, name: 'Ann' },
    { type: 'set-name', debateId: 'd1', side: 'pro', slot: 1, name: 'Bert' },
    { type: 'set-name', debateId: 'd1', side: 'con', slot: 0, name: 'Dirk' },
    { type: 'set-name', debateId: 'd1', side: 'con', slot: 1, name: 'Eva' },
    { type: 'open-debate', debateId: 'd1', now: 0 },
  ];
  return [...setup, ...actions].reduce(reducer, initialState(config));
}

interface HarnessProps {
  readonly initial: AppState;
  readonly onState: (state: AppState) => void;
  readonly onBack: () => void;
  readonly onFinish: () => void;
}

function Harness({ initial, onState, onBack, onFinish }: HarnessProps) {
  const [state, dispatch] = useReducer(reducer, initial);
  useEffect(() => onState(state), [state, onState]);
  const open = currentDebate(state);
  if (open === null) return <p>No debate is open.</p>;
  return (
    <DebateScreen
      state={state}
      open={open}
      dispatch={dispatch}
      onBack={onBack}
      onFinish={() => {
        dispatch({ type: 'finish-debate', now: performance.now() });
        onFinish();
      }}
    />
  );
}

export function renderDebate({
  locale = 'en',
  initial = openDebate(GRAFFITI_PRESET.build(locale)),
  onBack = () => {},
  onFinish = () => {},
}: {
  locale?: Locale;
  initial?: AppState;
  onBack?: () => void;
  onFinish?: () => void;
} = {}) {
  let latest = initial;
  const onState = (state: AppState) => {
    latest = state;
  };
  const view = renderWithI18n(
    <Harness initial={initial} onState={onState} onBack={onBack} onFinish={onFinish} />,
    { locale },
  );
  return { ...view, state: () => latest };
}
