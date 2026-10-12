import { useEffect, useId, useRef } from 'react';
import { Button } from '../components/ui/Button';
import { useI18n } from '../i18n';
import { SIDES } from '../model/config';
import type { AppState } from '../model/reducer';
import { debateStatus, hasResults, membersOf } from '../model/session';
import setup from '../setup/setup.module.css';
import type { IncomingReport } from '../share/incoming';
import share from '../share/share.module.css';
import { Contents, Problems } from '../share/SharedSetupScreen';
import styles from './report.module.css';

interface Props {
  readonly incoming: IncomingReport;
  /** The app as it is now: what the report would replace. */
  readonly state: AppState;
  readonly onLoad: (state: AppState) => void;
  /** Leave the app as it was. */
  readonly onClose: () => void;
}

/**
 * A report file opened in the app (#7), shown before it replaces what is
 * here: its debates, with their topics and names, its setup, and what
 * loading it would replace. Or, when it cannot be loaded, what is wrong.
 */
export function ReportPreviewScreen({ incoming, state, onLoad, onClose }: Props) {
  const { t } = useI18n();
  const heading = useRef<HTMLHeadingElement>(null);
  const { source, result } = incoming;

  // Start reading at the heading, and again once the report has been read.
  useEffect(() => {
    heading.current?.focus();
  }, [result]);

  const title =
    result === null
      ? t('loadReport.reading')
      : result.ok
        ? t('loadReport.title')
        : t('preview.invalid.file');
  const { debates } = state.session;

  return (
    <main className={setup.shell}>
      <div className={setup.masthead}>
        <p className={setup.eyebrow}>{t('loadReport.eyebrow')}</p>
        <h1 ref={heading} tabIndex={-1} className={`${setup.title} ${share.title}`}>
          {title}
        </h1>
        {result?.ok === true && (
          <p className={setup.lede}>{t('loadReport.fromFile', { name: source.name })}</p>
        )}
        {result?.ok === false && <p className={setup.lede}>{t('loadReport.invalid.intro')}</p>}
      </div>

      {result === null && (
        <div className={share.actions}>
          <Button onClick={onClose}>{t('action.cancel')}</Button>
        </div>
      )}

      {result?.ok === false && (
        <>
          <Problems issues={result.issues} />
          <div className={share.actions}>
            <Button variant="secondary" onClick={onClose}>
              {t('preview.close')}
            </Button>
          </div>
        </>
      )}

      {result?.ok === true && (
        <>
          <Debates loaded={result.state} />
          <Contents config={result.state.config} />
          <div className={`${setup.notice} ${share.impact}`} role="note">
            <p>
              {t('loadReport.replaces', {
                debates: debates.length,
                results: debates.filter(hasResults).length,
              })}
            </p>
          </div>
          <div className={share.actions}>
            <Button variant="primary" onClick={() => onLoad(result.state)}>
              {t('loadReport.load')}
            </Button>
            <Button onClick={onClose}>{t('action.cancel')}</Button>
          </div>
        </>
      )}
    </main>
  );
}

/** The debates in the report: number, status, topic and names. */
function Debates({ loaded }: { readonly loaded: AppState }) {
  const { t } = useI18n();
  const headingId = useId();
  const { config, session } = loaded;
  return (
    <section className={styles.section} aria-labelledby={headingId}>
      <h2 id={headingId} className={setup.heading}>
        {t('loadReport.debates')}
      </h2>
      {session.debates.length === 0 ? (
        <p className={setup.empty}>{t('loadReport.noDebates')}</p>
      ) : (
        <ol className={styles.debates}>
          {session.debates.map((debate, index) => {
            const topic = config.topics.find((candidate) => candidate.id === debate.topicId);
            const names = SIDES.map((side) => {
              const members = membersOf(debate.teams, side).map((member) => member.name);
              return `${config.format.sides[side]}: ${members.join(', ')}`;
            });
            return (
              <li key={debate.id} className={styles.debate}>
                <span className={styles.debateLabel}>
                  {t('debates.label', { number: index + 1 })}
                </span>
                <span className={setup.chip}>
                  {t(`debates.status.${debateStatus(config.format, debate)}`)}
                </span>
                <span className={topic === undefined ? styles.topicGone : styles.topic}>
                  {topic?.text ?? t('debates.topicGone')}
                </span>
                <span className={styles.names}>{names.join(' · ')}</span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
