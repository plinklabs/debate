import { useId } from 'react';
import { useI18n } from '../i18n';
import { otherSide, type CrossExaminationStep, type Side } from '../model/config';
import { clocksOf, membersOf, recordFor } from '../model/session';
import { Countdown } from './Countdown';
import styles from './debate.module.css';
import type { PanelProps } from './panels';

/** One side of a cross-examination as the panel shows it. */
interface Role {
  readonly side: Side;
  /** "NEGATIVE asks", or "AFFIRMATIVE answers". */
  readonly heading: string;
  /** Slots that asked or answered so far. */
  readonly slots: readonly number[];
  /** Slot that asks or answers now. */
  readonly current: number | null;
  /** The title of the list of who asked or answered. */
  readonly spoke: string;
}

/**
 * A cross-examination: the clock, which belongs to the side that asks, and
 * the names of both teams, one side asking and the other answering. A tap on
 * a name gives that student the question or the answer, records that they
 * took part, and starts the clock if it stands still.
 */
export function CrossExaminationPanel({
  step,
  debate,
  format,
  now,
  dispatch,
}: PanelProps<CrossExaminationStep>) {
  const { t } = useI18n();
  const prefix = useId();
  const record = recordFor(debate, step);
  const [clock] = clocksOf(debate, step);
  const asking = step.askingSide;
  const answering = otherSide(asking);
  // A name cleared since it was tapped is no longer known.
  const nameOf = (side: Side, slot: number) =>
    membersOf(debate.teams, side).find((member) => member.slot === slot)?.name ?? '?';

  const roles: readonly Role[] = [
    {
      side: asking,
      heading: t('debate.crossExam.asks', { who: format.sides[asking] }),
      slots: record.askers,
      current: record.asker,
      spoke: t('debate.crossExam.asked'),
    },
    {
      side: answering,
      heading: t('debate.crossExam.answers', { who: format.sides[answering] }),
      slots: record.answerers,
      current: record.answerer,
      spoke: t('debate.crossExam.answered'),
    },
  ];

  const floor = [
    record.asker === null
      ? null
      : t('debate.crossExam.asks', { who: nameOf(asking, record.asker) }),
    record.answerer === null
      ? null
      : t('debate.crossExam.answers', { who: nameOf(answering, record.answerer) }),
  ].filter((part) => part !== null);

  return (
    // The clock stays up by the title: the names of two teams run long.
    <div className={`${styles.split} ${styles.splitTop}`}>
      <Countdown clock={clock} now={now} label={t('debate.clock')} />
      <div className={styles.floor}>
        <p className={styles.floorLine}>
          {floor.length === 0 ? t('debate.crossExam.tap') : floor.join(', ')}
        </p>
        {roles.map((role) => (
          <div
            key={role.side}
            role="group"
            aria-labelledby={`${prefix}-${role.side}`}
            className={styles.role}
          >
            <p id={`${prefix}-${role.side}`} className={styles.spokeLabel}>
              {role.heading}
            </p>
            <ul className={styles.names}>
              {membersOf(debate.teams, role.side).map((member) => (
                <li key={member.slot}>
                  <button
                    type="button"
                    className={styles.name}
                    aria-pressed={role.current === member.slot}
                    onClick={() =>
                      dispatch({
                        type: 'tap-speaker',
                        side: role.side,
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
          </div>
        ))}
        {(record.askers.length > 0 || record.answerers.length > 0) && (
          <div className={styles.spokeRow}>
            {roles.map(
              (role) =>
                role.slots.length > 0 && (
                  <div key={role.side} className={styles.spoke}>
                    <p className={styles.spokeLabel}>{role.spoke}</p>
                    <ul className={styles.spokeList}>
                      {role.slots.map((slot) => (
                        <li key={slot} className={styles.spokeName}>
                          {nameOf(role.side, slot)}
                          <button
                            type="button"
                            className={styles.inkButton}
                            aria-label={t('debate.removeSpeaker', {
                              name: nameOf(role.side, slot),
                            })}
                            onClick={() =>
                              dispatch({ type: 'remove-speaker', side: role.side, slot })
                            }
                          >
                            ×
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ),
            )}
          </div>
        )}
      </div>
    </div>
  );
}
