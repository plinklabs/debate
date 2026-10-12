import { useId } from 'react';
import a11y from '../components/ui/a11y.module.css';
import { useI18n } from '../i18n';
import { SIDES, type AudienceQuestionsStep, type Side } from '../model/config';
import { clocksOf, recordFor } from '../model/session';
import { Countdown } from './Countdown';
import styles from './debate.module.css';
import type { PanelProps } from './panels';

/**
 * Questions from the audience to both teams: the clock, and, for a teacher
 * who wants to, a count of the answers each team gives, up and down with the
 * buttons as the votes are.
 */
export function AudienceQuestionsPanel({
  step,
  debate,
  format,
  now,
  dispatch,
}: PanelProps<AudienceQuestionsStep>) {
  const { t } = useI18n();
  const prefix = useId();
  const { answers } = recordFor(debate, step);
  const [clock] = clocksOf(debate, step);
  const adjust = (side: Side, delta: number) => dispatch({ type: 'adjust-answers', side, delta });

  return (
    <div className={styles.split}>
      <Countdown clock={clock} now={now} label={t('debate.clock')} />
      <div className={styles.floor}>
        <p className={styles.floorLine}>{t('debate.audience.prompt')}</p>
        <div className={styles.answers}>
          {SIDES.map((side) => {
            const label = format.sides[side];
            const id = `${prefix}-${side}`;
            return (
              <div key={side} role="group" aria-labelledby={id} className={styles.answerBox}>
                <p id={id} className={styles.teamName}>
                  {label}
                </p>
                <div className={styles.voteRow}>
                  <button
                    type="button"
                    className={styles.inkButton}
                    aria-label={t('debate.answers.fewer', { side: label })}
                    aria-disabled={answers[side] === 0}
                    onClick={() => adjust(side, -1)}
                  >
                    −
                  </button>
                  {/* The figure for the room; the words for a screen reader. */}
                  <p className={styles.answerCount} aria-live="polite">
                    <span aria-hidden="true">{answers[side]}</span>
                    <span className={a11y.visuallyHidden}>
                      {t('debate.answers', { count: answers[side] })}
                    </span>
                  </p>
                  <button
                    type="button"
                    className={styles.inkButton}
                    aria-label={t('debate.answers.more', { side: label })}
                    onClick={() => adjust(side, 1)}
                  >
                    +
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
