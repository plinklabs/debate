import { useEffect, useId, useRef } from 'react';
import { Button } from '../components/ui/Button';
import { useI18n, type Translate } from '../i18n';
import {
  SIDES,
  formatTotalSeconds,
  stepSeconds,
  type DebateConfig,
  type Format,
  type Step,
} from '../model/config';
import { replaceImpact, type ReplaceImpact } from '../model/impact';
import type { AppState } from '../model/reducer';
import type { ConfigIssue, IssuePath } from '../model/validate';
import setup from '../setup/setup.module.css';
import type { Incoming } from './incoming';
import styles from './share.module.css';

/** At most this many problems are listed; the rest are counted. */
const MAX_LISTED = 10;

interface Props {
  readonly incoming: Incoming;
  /** The app as it is now: what the shared setup would replace. */
  readonly state: AppState;
  readonly onUse: (config: DebateConfig) => void;
  /** Leave the setup as it was. */
  readonly onClose: () => void;
}

/**
 * A setup from a link or a file, shown before it is used: its topics and
 * format, and what it would do to the debates this browser already has. Or,
 * when it cannot be used, what is wrong with it.
 */
export function SharedSetupScreen({ incoming, state, onUse, onClose }: Props) {
  const { t } = useI18n();
  const heading = useRef<HTMLHeadingElement>(null);
  const { source, result } = incoming;

  // Start reading at the heading, and again once the setup has been read.
  useEffect(() => {
    heading.current?.focus();
  }, [result]);

  const title =
    result === null
      ? t('preview.reading')
      : result.ok
        ? t('preview.title')
        : t(source.kind === 'link' ? 'preview.invalid.link' : 'preview.invalid.file');

  return (
    <main className={setup.shell}>
      <div className={setup.masthead}>
        <p className={setup.eyebrow}>{t('preview.eyebrow')}</p>
        <h1 ref={heading} tabIndex={-1} className={`${setup.title} ${styles.title}`}>
          {title}
        </h1>
        {result?.ok === true && (
          <p className={setup.lede}>
            {source.kind === 'link'
              ? t('preview.fromLink')
              : t('preview.fromFile', { name: source.name })}
          </p>
        )}
        {result?.ok === false && <p className={setup.lede}>{t('preview.invalid.intro')}</p>}
      </div>

      {result === null && (
        <div className={styles.actions}>
          <Button onClick={onClose}>{t('action.cancel')}</Button>
        </div>
      )}

      {result?.ok === false && (
        <>
          <Problems issues={result.issues} />
          <div className={styles.actions}>
            <Button variant="secondary" onClick={onClose}>
              {t('preview.close')}
            </Button>
          </div>
        </>
      )}

      {result?.ok === true && (
        <>
          <Contents config={result.config} />
          <Impact impact={replaceImpact(state.session, state.config, result.config)} />
          <div className={styles.actions}>
            <Button variant="primary" onClick={() => onUse(result.config)}>
              {t('preview.use')}
            </Button>
            <Button onClick={onClose}>{t('action.cancel')}</Button>
          </div>
        </>
      )}
    </main>
  );
}

/** The topics and the format, as they would be used. */
export function Contents({ config }: { readonly config: DebateConfig }) {
  const { t, formatDuration, formatNumber } = useI18n();
  const prefix = useId();
  const { format, topics } = config;
  return (
    <div className={styles.contents}>
      <section className={styles.section} aria-labelledby={`${prefix}-topics`}>
        <h2 id={`${prefix}-topics`} className={setup.heading}>
          {t('setup.tab.topics')}
        </h2>
        <ol className={styles.topics}>
          {topics.map((topic) => (
            <li key={topic.id}>{topic.text}</li>
          ))}
        </ol>
      </section>

      <section className={styles.section} aria-labelledby={`${prefix}-format`}>
        <h2 id={`${prefix}-format`} className={setup.heading}>
          {t('setup.tab.format')}
        </h2>
        <dl className={`${setup.specs} ${styles.specs}`}>
          <div>
            <dt>{t('format.total')}</dt>
            <dd>{formatDuration(formatTotalSeconds(format), 'long')}</dd>
          </div>
          <div>
            <dt>{t('format.stepCount')}</dt>
            <dd>{formatNumber(format.steps.length)}</dd>
          </div>
          <div>
            <dt>{t('format.teamSize')}</dt>
            <dd>{t('preview.teamSize', format.teamSize)}</dd>
          </div>
        </dl>
        <dl className={styles.sides}>
          {SIDES.map((side) => (
            <div key={side}>
              <dt>{t(`format.side.${side}`)}</dt>
              <dd>{format.sides[side]}</dd>
            </div>
          ))}
        </dl>
        <h3 className={setup.groupTitle}>{t('format.steps')}</h3>
        <ol className={styles.steps}>
          {format.steps.map((step) => (
            <StepLine key={step.id} step={step} format={format} />
          ))}
        </ol>
      </section>
    </div>
  );
}

function StepLine({ step, format }: { readonly step: Step; readonly format: Format }) {
  const { t, formatDuration } = useI18n();
  const kind = t(`stepType.${step.type}`);
  const seconds = stepSeconds(step);
  const details = [
    // A step without a title of its own goes by its kind; one with a title shows both.
    step.label.trim() === '' || step.label === kind ? null : kind,
    step.type === 'speech' ? format.sides[step.side] : null,
    seconds === null
      ? null
      : step.type === 'free-round'
        ? t('preview.perTeam', { duration: formatDuration(seconds) })
        : formatDuration(seconds),
  ].filter((detail) => detail !== null);
  return (
    <li className={styles.step}>
      <span className={styles.stepName}>{step.label.trim() === '' ? kind : step.label}</span>
      {details.length > 0 && <span className={styles.stepDetails}>{details.join(' · ')}</span>}
    </li>
  );
}

/** What using the setup does to the debates already here; nothing when it changes none. */
function Impact({ impact }: { readonly impact: ReplaceImpact }) {
  const { t } = useI18n();
  // A new format only matters to debates that have results to read differently.
  const format = impact.formatChanges && impact.withResults > 0;
  if (impact.topicChanges.length === 0 && !format) return null;
  return (
    <div className={`${setup.notice} ${styles.impact}`} role="note">
      <p>{t('preview.impact', { debates: impact.debates, results: impact.withResults })}</p>
      <ul className={styles.impactList}>
        {impact.topicChanges.map(({ number, topic }) => (
          <li key={number}>
            {topic === null
              ? t('preview.impact.topicGone', { number })
              : t('preview.impact.topic', { number, topic: topic.text })}
          </li>
        ))}
        {format && <li>{t('preview.impact.format')}</li>}
      </ul>
    </div>
  );
}

/** What is wrong, where it is known: "Topic 3: This cannot be empty." */
export function Problems({ issues }: { readonly issues: readonly ConfigIssue[] }) {
  const { t, describeIssue } = useI18n();
  const lines = new Map<string, { place: string | null; text: string }>();
  for (const issue of issues) {
    const place = issuePlace(t, issue.path);
    const text = describeIssue(issue);
    lines.set(`${place ?? ''}\n${text}`, { place, text });
  }
  const listed = [...lines].slice(0, MAX_LISTED);
  const more = lines.size - listed.length;
  return (
    <div className={styles.problems} role="alert">
      <ul className={styles.problemList}>
        {listed.map(([key, { place, text }]) => (
          <li key={key}>
            {place !== null && <span className={styles.place}>{`${place}:`}</span>} {text}
          </li>
        ))}
      </ul>
      {more > 0 && <p className={styles.more}>{t('preview.invalid.more', { count: more })}</p>}
    </div>
  );
}

/** Where in a setup a problem is, in the words of the setup screen; `null` for the whole. */
function issuePlace(t: Translate, path: IssuePath): string | null {
  const [area, part, item] = path;
  if (area === 'version') return t('preview.place.version');
  if (area === 'topics') {
    return typeof part === 'number'
      ? t('topics.label', { number: part + 1 })
      : t('setup.tab.topics');
  }
  if (area !== 'format') return null;
  switch (part) {
    case 'steps':
      return typeof item === 'number' ? t('format.step', { number: item + 1 }) : t('format.steps');
    case 'sides':
      return item === 'pro' || item === 'con' ? t(`format.side.${item}`) : t('format.sides');
    case 'teamSize':
      return t('format.teamSize');
    default:
      return t('setup.tab.format');
  }
}
