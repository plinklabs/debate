import { useEffect, useReducer, useRef, useState } from 'react';
import { AppHeader } from './components/AppHeader';
import { DebateScreen } from './debate/DebateScreen';
import { useI18n } from './i18n';
import type { DebateConfig } from './model/config';
import type { Locale } from './model/locale';
import { defaultConfig } from './model/presets';
import { anyRunning, currentDebate, reducer, type AppState } from './model/reducer';
import { loadState, saveState } from './model/storage';
import { UpdateNotice } from './offline/UpdateNotice';
import { ReportPreviewScreen } from './report/ReportPreviewScreen';
import { useConfigEditor } from './setup/configEditor';
import { SetupScreen, type SetupTab } from './setup/SetupScreen';
import { isReport, useIncomingSetup } from './share/incoming';
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
 * carries a shared setup (`#c=…`, #5). That, a setup file, or a report file
 * opened to go on with its debates (#7), is shown before anything else until
 * the teacher uses it or not. Under the header, a notice offers a new version
 * once one is ready (#9).
 */
export function App() {
  const { locale } = useI18n();
  const [state, dispatch] = useReducer(reducer, locale, startState);
  const editor = useConfigEditor(state.config, dispatch);
  const { incoming, openFile, openReport, close } = useIncomingSetup();
  const [tab, setTab] = useState<SetupTab>(() =>
    state.session.debates.length > 0 ? 'debates' : 'topics',
  );
  const [leftDebate, setLeftDebate] = useState<string | null>(null);
  // The debate just finished: the debates tab offers its report.
  const [finishedDebate, setFinishedDebate] = useState<string | null>(null);

  // Everything is kept in this browser as it changes; the setup keeps the
  // labels it was made with, whatever the UI language becomes.
  const latest = useRef(state);
  useEffect(() => {
    latest.current = state;
    saveState(browserStorage, state, performance.now());
  }, [state]);

  // A running clock changes the time, not the state, so while one runs the
  // state is also kept every second, and when the page is hidden or left: a
  // reload brings the clocks back paused at the time they had. Only then;
  // otherwise what is stored is up to date already.
  const running = anyRunning(state);
  useEffect(() => {
    if (!running) return;
    const save = () => saveState(browserStorage, latest.current, performance.now());
    const onHidden = () => {
      if (document.visibilityState === 'hidden') save();
    };
    window.addEventListener('pagehide', save);
    document.addEventListener('visibilitychange', onHidden);
    const id = window.setInterval(save, 1000);
    return () => {
      window.removeEventListener('pagehide', save);
      document.removeEventListener('visibilitychange', onHidden);
      window.clearInterval(id);
    };
  }, [running]);

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
    setFinishedDebate(null);
    close();
  };

  // A report replaces everything; the debates tab shows what it brought.
  const loadReport = (loaded: AppState) => {
    dispatch({ type: 'load-state', state: loaded });
    setTab('debates');
    setLeftDebate(null);
    setFinishedDebate(null);
    close();
  };

  // Back on the debates, on the Start button of the debate just left.
  const leave = (debateId: string, type: 'close-debate' | 'finish-debate') => {
    setTab('debates');
    setLeftDebate(debateId);
    setFinishedDebate(type === 'finish-debate' ? debateId : null);
    dispatch({ type, now: performance.now() });
  };

  const open = currentDebate(state);

  return (
    <>
      <AppHeader />
      <UpdateNotice />
      {incoming !== null ? (
        isReport(incoming) ? (
          <ReportPreviewScreen
            incoming={incoming}
            state={state}
            onLoad={loadReport}
            onClose={close}
          />
        ) : (
          <SharedSetupScreen
            incoming={incoming}
            state={state}
            onUse={applyShared}
            onClose={close}
          />
        )
      ) : open === null ? (
        <SetupScreen
          state={state}
          dispatch={dispatch}
          tab={tab}
          onTabChange={(next) => {
            // The way back from a debate is taken: the focus stays on the tabs now.
            setLeftDebate(null);
            setFinishedDebate(null);
            setTab(next);
          }}
          focusDebate={leftDebate}
          finishedDebate={finishedDebate}
          onOpenFile={openFile}
          onOpenReport={openReport}
        />
      ) : (
        <DebateScreen
          state={state}
          open={open}
          dispatch={dispatch}
          onBack={() => leave(open.debate.id, 'close-debate')}
          onFinish={() => leave(open.debate.id, 'finish-debate')}
        />
      )}
    </>
  );
}
