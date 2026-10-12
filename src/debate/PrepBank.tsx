import { useId, type Dispatch } from 'react';
import { Ping } from '../components/ui/Ping';
import a11y from '../components/ui/a11y.module.css';
import { useI18n } from '../i18n';
import type { Format } from '../model/config';
import type { Action } from '../model/reducer';
import { prepClocks, type Debate, type StepClock } from '../model/session';
import { countdown, elapsedMs, formatCountdown, isRunning } from '../model/timer';
import styles from './debate.module.css';

interface Props {
  readonly format: Format;
  readonly debate: Debate;
  /** The moment to show the clocks at (`useNow`). */
  readonly now: number;
  readonly dispatch: Dispatch<Action>;
}

/**
 * The prep-time bank of both teams (#8), on the stage beside the title of
 * the step, so it is in sight whatever the step: what each team has left,
 * counting down while it prepares and on into overtime past its bank, and a
 * button to call prep time or stop it. Calling it pauses the step; Start goes
 * on with the step and stops the prep time. Nothing for a format without a bank.
 */
export function PrepBank({ format, debate, now, dispatch }: Props) {
  const { t } = useI18n();
  const heading = useId();
  const clocks = prepClocks(format, debate);
  if (clocks.length === 0) return null;
  const { active } = debate.prep;

  return (
    <section className={styles.prep} aria-labelledby={heading}>
      {/* The buttons say what this is; the heading is read out. */}
      <h3 id={heading} className={a11y.visuallyHidden}>
        {t('debate.prep')}
      </h3>
      {clocks.map((clock) => {
        if (clock.side === null) return null;
        const { side } = clock;
        const name = t('debate.prep.team', { side: format.sides[side] });
        return (
          <div
            key={side}
            role="group"
            aria-label={name}
            className={
              active === side ? `${styles.prepTeam} ${styles.prepActive}` : styles.prepTeam
            }
          >
            <span className={styles.prepSide}>{format.sides[side]}</span>
            <PrepClock clock={clock} now={now} label={name} />
            <button
              type="button"
              className={styles.prepButton}
              onClick={() => dispatch({ type: 'toggle-prep', side, now: performance.now() })}
            >
              {active === side ? t('debate.prep.stop') : t('debate.prep.call')}
            </button>
          </div>
        );
      })}
    </section>
  );
}

/** What a team has left of its bank, or its overtime past it, and the ping while it runs. */
function PrepClock({ clock, now, label }: { clock: StepClock; now: number; label: string }) {
  const { t } = useI18n();
  const shown = countdown(clock.seconds, elapsedMs(clock.timer, now));
  const running = isRunning(clock.timer);
  return (
    <span className={shown.over ? `${styles.prepClock} ${styles.over}` : styles.prepClock}>
      <span role="timer" aria-label={label} className={styles.prepDigits}>
        {formatCountdown(shown)}
      </span>
      {shown.over && <span className={a11y.visuallyHidden}>{t('debate.overtime')}</span>}
      <Ping
        size={18}
        onInk
        mode={running ? 'pulse' : 'static'}
        className={running ? undefined : styles.idle}
      />
    </span>
  );
}
