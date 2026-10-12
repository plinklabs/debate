import { useEffect, useId, useRef, type Dispatch } from 'react';
import { Button } from '../components/ui/Button';
import { InlineConfirm } from '../components/ui/InlineConfirm';
import a11y from '../components/ui/a11y.module.css';
import { useI18n } from '../i18n';
import type { Action, AppState, OpenDebate } from '../model/reducer';
import { clocksOf, recordFor, runningClock } from '../model/session';
import styles from './debate.module.css';
import { StepPanel } from './StepPanel';
import { StepProgress } from './StepProgress';
import { stepName, stepWho } from './stepText';
import { useTimeUp } from './timeUp';
import { useDebateKeys } from './useDebateKeys';
import { useNow } from './useNow';
import { useSound } from './useSound';
import { useWakeLock } from './useWakeLock';

interface Props {
  readonly state: AppState;
  /** The open debate (`currentDebate(state)`). */
  readonly open: OpenDebate;
  readonly dispatch: Dispatch<Action>;
  /** Close the debate and go back to the setup. */
  readonly onBack: () => void;
  /** Finish the debate, from its last step, and go back to the setup. */
  readonly onFinish: () => void;
}

/**
 * The open debate, run in front of the class: the steps of the format, and
 * on the stage the current step with its large clock, who has the floor, and
 * the audience vote. Start, pause and step on with the buttons or the keys.
 * When a clock reaches zero, a sound plays (unless muted) and the stage
 * signals it; the screen stays awake while a clock runs.
 */
export function DebateScreen({ state, open, dispatch, onBack, onFinish }: Props) {
  const { t } = useI18n();
  const heading = useRef<HTMLHeadingElement>(null);
  const stepHeading = useId();
  const { format } = state.config;
  const { debate, step, stepIndex } = open;
  const number = state.session.debates.findIndex((candidate) => candidate.id === debate.id) + 1;
  const first = stepIndex === 0;
  const last = stepIndex === format.steps.length - 1;

  const clocks = clocksOf(debate, step);
  const running = runningClock(debate, step);
  const now = useNow(running?.timer ?? null);
  const sound = useSound();
  const signal = useTimeUp(`${debate.id}:${step.id}`, clocks, now, sound.timeUp);
  useWakeLock(running !== null);

  // A free round's clock starts with a tap on a name; after that, Start resumes it.
  const canStart =
    clocks.length > 0 && (step.type !== 'free-round' || recordFor(debate, step).lastSide !== null);

  const toggle = () => dispatch({ type: 'toggle-timer', now: performance.now() });
  const next = () => dispatch({ type: 'next-step', now: performance.now() });
  const previous = () => dispatch({ type: 'previous-step', now: performance.now() });
  useDebateKeys({ toggle, next, previous });

  // The Start button that brought the teacher here is gone: start reading at the topic.
  useEffect(() => {
    heading.current?.focus();
  }, []);

  return (
    <main>
      <div className={`${styles.inner} ${styles.head}`}>
        <div className={styles.topline}>
          <p className={styles.eyebrow}>{`// ${t('debates.label', { number })}`}</p>
          <div className={styles.tools}>
            <Button
              variant="ghost"
              role="switch"
              aria-checked={!sound.muted}
              onClick={() => sound.setMuted(!sound.muted)}
            >
              <span>
                {t('debate.sound')}
                <span aria-hidden="true">
                  {`: ${sound.muted ? t('debate.sound.off') : t('debate.sound.on')}`}
                </span>
              </span>
            </Button>
            <InlineConfirm
              trigger={t('debate.clear')}
              variant="ghost"
              question={t('debate.clear.question')}
              confirm={t('debate.clear.confirm')}
              onConfirm={() => dispatch({ type: 'clear-step' })}
            />
            <Button variant="ghost" onClick={onBack}>
              <span aria-hidden="true">←</span> {t('debate.back')}
            </Button>
          </div>
        </div>
        <h1 ref={heading} tabIndex={-1} className={styles.topic}>
          {open.topic?.text ?? t('debates.topicGone')}
        </h1>
        <StepProgress
          format={format}
          current={stepIndex}
          onGo={(index) => dispatch({ type: 'go-to-step', step: index, now: performance.now() })}
        />
      </div>

      <section className={styles.stage} aria-labelledby={stepHeading}>
        <div className={`${styles.inner} ${styles.stageInner}`}>
          <p className={styles.stageEyebrow}>
            {`${t('debate.stepOf', { number: stepIndex + 1, total: format.steps.length })} · ${stepWho(step, format, t)}`}
          </p>
          <h2 id={stepHeading} className={styles.stepTitle}>
            {stepName(step, t)}
          </h2>
          <StepPanel step={step} debate={debate} format={format} now={now} dispatch={dispatch} />
        </div>
        {signal.on && <div key={signal.count} className={styles.signal} aria-hidden="true" />}
      </section>
      <p role="status" className={a11y.visuallyHidden}>
        {signal.on ? t('debate.timeUp') : ''}
      </p>

      <div className={styles.controls}>
        <div className={`${styles.inner} ${styles.controlsInner}`}>
          <div className={styles.buttons}>
            <Button
              aria-disabled={first}
              aria-keyshortcuts="ArrowLeft PageUp"
              onClick={() => {
                if (!first) previous();
              }}
            >
              <span aria-hidden="true">←</span>
              <span className={styles.buttonLabel}>{t('debate.previous')}</span>
            </Button>
            {clocks.length > 0 && (
              <Button
                variant="primary"
                className={styles.toggle}
                aria-disabled={!canStart}
                aria-keyshortcuts="Space"
                onClick={() => {
                  if (canStart) toggle();
                }}
              >
                {running === null ? t('debate.start') : t('debate.pause')}
              </Button>
            )}
            <Button
              variant={clocks.length > 0 ? 'secondary' : 'primary'}
              aria-keyshortcuts={last ? undefined : 'ArrowRight PageDown'}
              onClick={last ? onFinish : next}
            >
              {last ? (
                t('debate.finish')
              ) : (
                <>
                  <span className={styles.buttonLabel}>{t('debate.next')}</span>
                  <span aria-hidden="true">→</span>
                </>
              )}
            </Button>
          </div>
          <p className={styles.keys}>{t('debate.keys')}</p>
        </div>
      </div>
    </main>
  );
}
