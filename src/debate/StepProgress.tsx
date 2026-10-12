import { useI18n } from '../i18n';
import { stepSide, type Format } from '../model/config';
import styles from './debate.module.css';
import { stepName } from './stepText';

interface Props {
  readonly format: Format;
  /** Index of the current step. */
  readonly current: number;
  readonly onGo: (index: number) => void;
}

/**
 * Every step of the format in a row, numbered, the current one marked. A step
 * can be picked to go to it. On a phone only the numbers show; the full name
 * of a step is in its button's name.
 */
export function StepProgress({ format, current, onGo }: Props) {
  const { t } = useI18n();
  return (
    <nav aria-label={t('debate.steps')}>
      <ol className={styles.steps}>
        {format.steps.map((step, index) => {
          const side = stepSide(step);
          const name = stepName(step, t);
          const where = index < current ? styles.past : index === current ? styles.current : '';
          return (
            <li key={step.id} className={where}>
              <button
                type="button"
                className={styles.stepButton}
                aria-current={index === current ? 'step' : undefined}
                aria-label={t('debate.stepName', {
                  number: index + 1,
                  name,
                  side: side === null ? null : format.sides[side],
                })}
                onClick={() => onGo(index)}
              >
                <span className={styles.stepNumber}>
                  {String(index + 1).padStart(2, '0')}
                  {side !== null && <span className={styles.stepSide}> {format.sides[side]}</span>}
                </span>
                <span className={styles.stepLabel}>{name}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
