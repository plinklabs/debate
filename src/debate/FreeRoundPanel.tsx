import { useId } from 'react';
import { useI18n } from '../i18n';
import { SIDES, type FreeRoundStep } from '../model/config';
import { clocksOf, freeRoundTurns, membersOf, recordFor } from '../model/session';
import { Countdown } from './Countdown';
import styles from './debate.module.css';
import type { PanelProps } from './panels';

/**
 * The free round: a chess clock with a clock per team. A tap on a name gives
 * that student the floor and runs their team's clock; the other clock stops.
 * Each student's turns are counted, and can be corrected.
 */
export function FreeRoundPanel({ step, debate, format, now, dispatch }: PanelProps<FreeRoundStep>) {
  const { t } = useI18n();
  const prefix = useId();
  const round = recordFor(debate, step);
  const clocks = clocksOf(debate, step);
  const { current } = round;
  const speaker =
    current === null
      ? undefined
      : membersOf(debate.teams, current.side).find((member) => member.slot === current.slot);

  return (
    <>
      <p className={styles.floorLine}>
        {speaker === undefined
          ? t('debate.tapFreeRound')
          : t('debate.floor', { name: speaker.name })}
      </p>
      <div className={styles.chess}>
        {SIDES.map((side) => {
          const clock = clocks.find((candidate) => candidate.side === side) ?? clocks[0];
          const headingId = `${prefix}-${side}`;
          return (
            <section
              key={side}
              className={round.active === side ? `${styles.team} ${styles.active}` : styles.team}
              aria-labelledby={headingId}
            >
              <div className={styles.teamHead}>
                <h3 id={headingId} className={styles.teamName}>
                  {format.sides[side]}
                </h3>
                <p className={styles.teamMeta}>
                  {t('debate.turns', { count: round.teamTurns[side] })}
                </p>
              </div>
              <div className={styles.teamBody}>
                <Countdown clock={clock} now={now} label={format.sides[side]} size="medium" />
                <ul className={styles.turns}>
                  {membersOf(debate.teams, side).map((member) => {
                    const turns = freeRoundTurns(round, side, member.slot);
                    return (
                      <li key={member.slot} className={styles.turn}>
                        <button
                          type="button"
                          className={styles.name}
                          aria-pressed={current?.side === side && current.slot === member.slot}
                          onClick={() =>
                            dispatch({
                              type: 'tap-speaker',
                              side,
                              slot: member.slot,
                              now: performance.now(),
                            })
                          }
                        >
                          {member.name}
                        </button>
                        <span className={styles.turnCount}>{`${turns}×`}</span>
                        <button
                          type="button"
                          className={styles.inkButton}
                          aria-label={t('debate.fewerTurns', { name: member.name })}
                          aria-disabled={turns === 0}
                          onClick={() =>
                            turns > 0 &&
                            dispatch({
                              type: 'adjust-free-turns',
                              side,
                              slot: member.slot,
                              delta: -1,
                            })
                          }
                        >
                          −
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
