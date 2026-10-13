import type { CSSProperties } from 'react';
import { Ping } from '../components/ui/Ping';
import { useI18n } from '../i18n';
import type { StepClock } from '../model/session';
import { countdown, elapsedMs, formatClock, formatCountdown, isRunning } from '../model/timer';
import styles from './debate.module.css';

interface Props {
  readonly clock: StepClock;
  /** The moment to show the clock at (`useNow`). */
  readonly now: number;
  /** What the clock is, for a screen reader: "Time", or a team in a free round. */
  readonly label: string;
  /** `large`: the one clock of a step; `medium`: a team's clock in a free round. */
  readonly size?: 'large' | 'medium';
}

/**
 * A clock counting down to 0:00 and on into the overtime (`+0:12`), in digits
 * that can be read from the back of the room. Under it: paused or over time,
 * and the time planned. The ping pulses while the clock runs.
 */
export function Countdown({ clock, now, label, size = 'large' }: Props) {
  const { t } = useI18n();
  const elapsed = elapsedMs(clock.timer, now);
  const shown = countdown(clock.seconds, elapsed);
  const running = isRunning(clock.timer);
  const state = shown.over
    ? t('debate.overtime')
    : !running && elapsed > 0
      ? t('debate.paused')
      : null;
  const planned = formatClock(clock.seconds);
  const note = [state, t('debate.of', { time: planned })].filter(Boolean).join(' · ');
  const digits = formatCountdown(shown);
  // The characters the digits are sized for, so that they fit their column
  // (debate.module.css): those of the time shown, or of the time planned if
  // that is longer, so a quarter of an hour keeps its size below 10:00.
  const chars = Math.max(digits.length, planned.length);

  return (
    <div
      className={[styles.countdown, styles[size], shown.over && styles.over]
        .filter(Boolean)
        .join(' ')}
    >
      <p
        role="timer"
        aria-label={label}
        className={styles.digits}
        style={{ '--chars': chars } as CSSProperties}
      >
        {digits}
      </p>
      <p className={styles.clockNote}>
        <span>{note}</span>
        <Ping
          size={22}
          onInk
          mode={running ? 'pulse' : 'static'}
          className={running ? undefined : styles.idle}
        />
      </p>
    </div>
  );
}
