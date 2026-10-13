import { useId, type Dispatch } from 'react';
import { TabList, TabPanel, type TabItem } from '../components/ui/Tabs';
import { useI18n } from '../i18n';
import type { Action, AppState } from '../model/reducer';
import { SharePanel } from '../share/SharePanel';
import { useConfigEditor } from './configEditor';
import { DebatesPanel } from './DebatesPanel';
import { FormatPanel } from './FormatPanel';
import { TopicsPanel } from './TopicsPanel';
import styles from './setup.module.css';

/** The areas of the setup, one tab each. */
export type SetupTab = 'topics' | 'format' | 'debates' | 'share';

interface Props {
  readonly state: AppState;
  readonly dispatch: Dispatch<Action>;
  readonly tab: SetupTab;
  readonly onTabChange: (tab: SetupTab) => void;
  /** A debate whose Start button gets the focus: the one the teacher just left. */
  readonly focusDebate: string | null;
  /** The debate the teacher just finished, if any. */
  readonly finishedDebate: string | null;
  /** A setup file the teacher opened under Share, to show before it is used. */
  readonly onOpenFile: (file: File) => void;
  /** A report file the teacher opened under the debates, to show before it is loaded. */
  readonly onOpenReport: (file: File) => void;
}

/**
 * Everything before the debate: topics, the format, the debates with their
 * teams, and the setup shared as a link or a file.
 */
export function SetupScreen({
  state,
  dispatch,
  tab,
  onTabChange,
  focusDebate,
  finishedDebate,
  onOpenFile,
  onOpenReport,
}: Props) {
  const { t } = useI18n();
  const prefix = useId();
  const editor = useConfigEditor(state.config, dispatch);

  const tabs: readonly TabItem<SetupTab>[] = [
    { value: 'topics', label: t('setup.tab.topics') },
    { value: 'format', label: t('setup.tab.format') },
    { value: 'debates', label: t('setup.tab.debates') },
    { value: 'share', label: t('setup.tab.share') },
  ];

  return (
    <main className={styles.shell}>
      <div className={styles.masthead}>
        <p className={styles.eyebrow}>{t('setup.eyebrow')}</p>
        {/* Focusable for the app to start reading here, e.g. after a shared setup was used. */}
        <h1 tabIndex={-1} className={styles.title}>
          {t('app.name')} <span className={styles.endorse}>{t('app.endorsement')}</span>
        </h1>
        <p className={styles.lede}>{t('setup.lede')}</p>
      </div>

      <TabList
        label={t('setup.areas')}
        idPrefix={prefix}
        tabs={tabs}
        value={tab}
        onChange={onTabChange}
      />
      <TabPanel idPrefix={prefix} value={tab}>
        {tab === 'topics' && <TopicsPanel editor={editor} session={state.session} />}
        {tab === 'format' && <FormatPanel editor={editor} session={state.session} />}
        {tab === 'debates' && (
          <DebatesPanel
            state={state}
            dispatch={dispatch}
            focusDebate={focusDebate}
            finishedDebate={finishedDebate}
            onOpenReport={onOpenReport}
          />
        )}
        {tab === 'share' && <SharePanel config={state.config} onOpenFile={onOpenFile} />}
      </TabPanel>
    </main>
  );
}
