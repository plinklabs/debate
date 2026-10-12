import { useI18n } from '../i18n';
import type { SpeechStep } from '../model/config';
import { clocksOf, membersOf, recordFor } from '../model/session';
import { Countdown } from './Countdown';
import styles from './debate.module.css';
import type { PanelProps } from './panels';

/**
 * A speech: the clock, and the names of the speaking team. A tap on a name
 * gives that student the floor, records that they spoke, and starts the clock
 * if it stands still.
 */
export function SpeechPanel({ step, debate, now, dispatch }: PanelProps<SpeechStep>) {
  const { t } = useI18n();
  const record = recordFor(debate, step);
  const [clock] = clocksOf(debate, step);
  const members = membersOf(debate.teams, step.side);
  // A name cleared since it was tapped is no longer known.
  const nameOf = (slot: number) => members.find((member) => member.slot === slot)?.name ?? '?';

  return (
    <div className={styles.split}>
      <Countdown clock={clock} now={now} label={t('debate.clock')} />
      <div className={styles.floor}>
        <p className={styles.floorLine}>
          {record.current === null
            ? t('debate.tapSpeaker')
            : t('debate.floor', { name: nameOf(record.current) })}
        </p>
        <ul className={styles.names}>
          {members.map((member) => (
            <li key={member.slot}>
              <button
                type="button"
                className={styles.name}
                aria-pressed={record.current === member.slot}
                onClick={() =>
                  dispatch({
                    type: 'tap-speaker',
                    side: step.side,
                    slot: member.slot,
                    now: performance.now(),
                  })
                }
              >
                {member.name}
              </button>
            </li>
          ))}
        </ul>
        {record.speakers.length > 0 && (
          <div className={styles.spoke}>
            <p className={styles.spokeLabel}>{t('debate.speakers')}</p>
            <ul className={styles.spokeList}>
              {record.speakers.map((slot) => (
                <li key={slot} className={styles.spokeName}>
                  {nameOf(slot)}
                  <button
                    type="button"
                    className={styles.inkButton}
                    aria-label={t('debate.removeSpeaker', { name: nameOf(slot) })}
                    onClick={() => dispatch({ type: 'remove-speaker', slot })}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
