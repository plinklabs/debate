import { useId, useState } from 'react';
import { useI18n } from '../i18n';
import { SIDES, type Format, type Side, type VoteStep } from '../model/config';
import { recordFor, votesOf, type Debate } from '../model/session';
import { MAX_VOTES, voteShift, type Votes } from '../model/votes';
import styles from './debate.module.css';
import type { PanelProps } from './panels';

/**
 * The audience vote: who agrees with the topic, counted by hand and typed in,
 * or counted up and down with the buttons. After the debate, the shift
 * between the two votes, in percentage points.
 */
export function VotePanel({ step, debate, format, dispatch }: PanelProps<VoteStep>) {
  const { t, formatNumber } = useI18n();
  const prefix = useId();
  const { votes } = recordFor(debate, step);
  const total = votes.pro + votes.con;
  const set = (side: Side, value: number) => dispatch({ type: 'set-votes', side, value });

  return (
    <>
      <p className={styles.floorLine}>{t('debate.vote.prompt')}</p>
      <div className={styles.voteLayout}>
        <div className={styles.votes}>
          {SIDES.map((side) => {
            const label = format.sides[side];
            const id = `${prefix}-${side}`;
            return (
              <div key={side} className={styles.voteBox}>
                <label htmlFor={id} className={styles.teamName}>
                  {label}
                </label>
                <div className={styles.voteRow}>
                  <button
                    type="button"
                    className={styles.inkButton}
                    aria-label={t('debate.vote.fewer', { side: label })}
                    aria-disabled={votes[side] === 0}
                    onClick={() => set(side, votes[side] - 1)}
                  >
                    −
                  </button>
                  <VoteInput
                    id={id}
                    label={t('debate.vote.count', { side: label })}
                    value={votes[side]}
                    onChange={(value) => set(side, value)}
                  />
                  <button
                    type="button"
                    className={styles.inkButton}
                    aria-label={t('debate.vote.more', { side: label })}
                    aria-disabled={votes[side] === MAX_VOTES}
                    onClick={() => set(side, votes[side] + 1)}
                  >
                    +
                  </button>
                </div>
                <p className={styles.share}>
                  {total > 0
                    ? formatNumber(votes[side] / total, {
                        style: 'percent',
                        maximumFractionDigits: 0,
                      })
                    : '—'}
                </p>
              </div>
            );
          })}
        </div>
        {step.type === 'vote-after' && <Shift format={format} debate={debate} />}
      </div>
    </>
  );
}

interface VoteInputProps {
  readonly id: string;
  readonly label: string;
  readonly value: number;
  readonly onChange: (value: number) => void;
}

/**
 * A count. Every number typed counts at once. While the field has the focus it
 * keeps what was typed, such as nothing for a moment, as long as that agrees
 * with the count: one that is out of range shows as the count it became.
 */
function VoteInput({ id, label, value, onChange }: VoteInputProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown =
    draft !== null && (draft.trim() === '' || Number(draft) === value) ? draft : String(value);
  return (
    <input
      id={id}
      type="number"
      inputMode="numeric"
      min={0}
      max={MAX_VOTES}
      step={1}
      autoComplete="off"
      aria-label={label}
      className={styles.voteInput}
      value={shown}
      onFocus={(event) => event.currentTarget.select()}
      onChange={(event) => {
        const raw = event.target.value;
        setDraft(raw);
        if (raw.trim() !== '' && Number.isFinite(Number(raw))) onChange(Number(raw));
      }}
      onBlur={() => setDraft(null)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur();
      }}
    />
  );
}

/** The two votes side by side and the shift between them. */
function Shift({ format, debate }: { readonly format: Format; readonly debate: Debate }) {
  const { t, formatNumber } = useI18n();
  const before = votesOf(format, debate, 'vote-before');
  const after = votesOf(format, debate, 'vote-after');
  // A format without a vote before has no shift to show.
  if (before === null || after === null) return null;
  const shift = voteShift(before, after);
  const { sides } = format;
  const share = (value: number | null) =>
    value === null
      ? '—'
      : `${formatNumber(value, { style: 'percent', maximumFractionDigits: 0 })} ${sides.pro}`;
  const tally = (votes: Votes, value: number | null) =>
    `${formatNumber(votes.pro)} ${sides.pro} · ${formatNumber(votes.con)} ${sides.con} · ${share(value)}`;

  return (
    <div className={styles.shift}>
      <dl className={styles.tally}>
        <div>
          <dt>{t('debate.vote.before')}</dt>
          <dd>{tally(before, shift.shareBefore)}</dd>
        </div>
        <div>
          <dt>{t('debate.vote.after')}</dt>
          <dd>{tally(after, shift.shareAfter)}</dd>
        </div>
      </dl>
      <p className={styles.shiftResult}>
        {shift.pp === null ? (
          t('debate.shift.none')
        ) : (
          <>
            {t('debate.shift', { points: shift.pp, side: sides.pro })}{' '}
            <span className={styles.shiftVotes}>
              ({t('debate.shift.votes', { count: shift.absolute })})
            </span>
          </>
        )}
      </p>
    </div>
  );
}
