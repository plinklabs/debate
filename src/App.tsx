import { useEffect, useReducer, useState } from 'react';
import { AppHeader } from './components/AppHeader';
import { DebateScreen } from './debate/DebateScreen';
import { useI18n } from './i18n';
import type { Locale } from './model/locale';
import { defaultConfig } from './model/presets';
import { currentDebate, reducer, type AppState } from './model/reducer';
import { loadState, saveState } from './model/storage';
import { SetupScreen, type SetupTab } from './setup/SetupScreen';

const browserStorage = () => window.localStorage;

/** The stored state, or the default setup built in the UI language. */
function startState(locale: Locale): AppState {
  return loadState(browserStorage, defaultConfig(locale));
}

/**
 * The app: the header, and the setup or the open debate. Which screen shows
 * follows the app state: a debate that is open (`session.current`) has the
 * screen, so a reload comes back to it. The URL hash is not used for this; it
 * is kept for a shared setup (#5).
 */
export function App() {
  const { locale } = useI18n();
  const [state, dispatch] = useReducer(reducer, locale, startState);
  const [tab, setTab] = useState<SetupTab>(() =>
    state.session.debates.length > 0 ? 'debates' : 'topics',
  );
  const [leftDebate, setLeftDebate] = useState<string | null>(null);

  // Everything is kept in this browser as it changes; the setup keeps the
  // labels it was made with, whatever the UI language becomes.
  useEffect(() => {
    saveState(browserStorage, state, performance.now());
  }, [state]);

  const open = currentDebate(state);

  return (
    <>
      <AppHeader />
      {open === null ? (
        <SetupScreen
          state={state}
          dispatch={dispatch}
          tab={tab}
          onTabChange={(next) => {
            // The way back from a debate is taken: the focus stays on the tabs now.
            setLeftDebate(null);
            setTab(next);
          }}
          focusDebate={leftDebate}
        />
      ) : (
        <DebateScreen
          state={state}
          open={open}
          onBack={() => {
            setTab('debates');
            setLeftDebate(open.debate.id);
            dispatch({ type: 'close-debate', now: performance.now() });
          }}
        />
      )}
    </>
  );
}
