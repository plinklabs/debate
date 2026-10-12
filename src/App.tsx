import { useEffect, useReducer, useRef, useState } from 'react';
import { AppHeader } from './components/AppHeader';
import { DebateScreen } from './debate/DebateScreen';
import { useI18n } from './i18n';
import type { DebateConfig } from './model/config';
import type { Locale } from './model/locale';
import { defaultConfig } from './model/presets';
import { currentDebate, reducer, type AppState } from './model/reducer';
import { loadState, saveState } from './model/storage';
import { useConfigEditor } from './setup/configEditor';
import { SetupScreen, type SetupTab } from './setup/SetupScreen';
import { useIncomingSetup } from './share/incoming';
import { SharedSetupScreen } from './share/SharedSetupScreen';

const browserStorage = () => window.localStorage;

/** The stored state, or the default setup built in the UI language. */
function startState(locale: Locale): AppState {
  return loadState(browserStorage, defaultConfig(locale));
}

/**
 * The app: the header, and the setup or the open debate. Which screen shows
 * follows the app state: a debate that is open (`session.current`) has the
 * screen, so a reload comes back to it. The URL hash is not used for this; it
 * carries a shared setup (`#c=…`, #5), which is shown before anything else
 * until the teacher uses it or not.
 */
export function App() {
  const { locale } = useI18n();
  const [state, dispatch] = useReducer(reducer, locale, startState);
  const editor = useConfigEditor(state.config, dispatch);
  const { incoming, openFile, close } = useIncomingSetup();
  const [tab, setTab] = useState<SetupTab>(() =>
    state.session.debates.length > 0 ? 'debates' : 'topics',
  );
  const [leftDebate, setLeftDebate] = useState<string | null>(null);

  // Everything is kept in this browser as it changes; the setup keeps the
  // labels it was made with, whatever the UI language becomes.
  useEffect(() => {
    saveState(browserStorage, state, performance.now());
  }, [state]);

  // Once a shared setup is used or not, reading starts at the top of the
  // screen that comes back (the debate screen sees to its own).
  const previewing = incoming !== null;
  const wasPreviewing = useRef(previewing);
  useEffect(() => {
    if (wasPreviewing.current && !previewing) {
      document.querySelector<HTMLElement>('main h1[tabindex]')?.focus();
    }
    wasPreviewing.current = previewing;
  }, [previewing]);

  const applyShared = (config: DebateConfig) => {
    // The setup screen shows what arrived, starting with the topics.
    dispatch({ type: 'close-debate', now: performance.now() });
    editor.apply(config);
    setTab('topics');
    setLeftDebate(null);
    close();
  };

  const open = currentDebate(state);

  return (
    <>
      <AppHeader />
      {incoming !== null ? (
        <SharedSetupScreen incoming={incoming} state={state} onUse={applyShared} onClose={close} />
      ) : open === null ? (
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
          onOpenFile={openFile}
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
