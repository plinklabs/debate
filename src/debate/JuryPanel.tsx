import { useId, type Dispatch } from 'react';
import { InlineConfirm } from '../components/ui/InlineConfirm';
import a11y from '../components/ui/a11y.module.css';
import { useI18n, type Translate } from '../i18n';
import {
  rubricMaxTotal,
  type Format,
  type JuryStep,
  type Rubric,
  type RubricCriterion,
} from '../model/config';
import {
  MAX_JURORS,
  averageSheet,
  juryOf,
  scoreTargets,
  sheetOf,
  targetKey,
  type ScoreTarget,
} from '../model/jury';
import type { Action } from '../model/reducer';
import { MAX_NAME_LENGTH, membersOf, type Debate, type Juror } from '../model/session';
import styles from './debate.module.css';
import type { PanelProps } from './panels';

/**
 * The jury step (#10): a score sheet on the format's rubric, per team or per
 * student, a score per criterion and the weighted total. Jurors fill it in one
 * after another on this device: add a juror, switch between them, give one a
 * name or take one off. With more than one juror, the totals of each and
 * their average follow.
 */
export function JuryPanel({ debate, format, dispatch }: PanelProps<JuryStep>) {
  const { t } = useI18n();
  const prefix = useId();
  const { rubric } = format;
  if (rubric === undefined) return <p className={styles.floorLine}>{t('jury.noRubric')}</p>;

  const jury = juryOf(debate);
  const index = Math.max(
    0,
    jury.jurors.findIndex((juror) => juror.id === jury.current),
  );
  const juror = jury.jurors[index];
  const name = jurorName(t, juror, index);
  const targets = scoreTargets(rubric, debate.teams);

  return (
    <div className={styles.jury}>
      <p className={styles.floorLine}>
        {rubric.scope === 'team' ? t('jury.prompt.team') : t('jury.prompt.student')}
      </p>
      <Jurors
        jurors={jury.jurors}
        current={juror}
        name={name}
        idPrefix={prefix}
        dispatch={dispatch}
      />
      <section aria-label={t('jury.sheet', { juror: name })} className={styles.sheets}>
        {targets.map((target) => (
          <TargetSheet
            // A sheet of its own per juror: nothing half-chosen carries over.
            key={`${juror.id}:${targetKey(target)}`}
            rubric={rubric}
            juror={juror}
            target={target}
            name={targetName(t, format, debate, target)}
            idPrefix={`${prefix}-${targetKey(target)}`}
            dispatch={dispatch}
          />
        ))}
      </section>
      {jury.jurors.length > 1 && (
        <Overview rubric={rubric} format={format} debate={debate} jurors={jury.jurors} />
      )}
    </div>
  );
}

/** A juror's name as typed, or their number on the jury. */
function jurorName(t: Translate, juror: Juror, index: number): string {
  const name = juror.name.trim();
  return name === '' ? t('jury.juror', { number: index + 1 }) : name;
}

/** A team by its side's label; a student by name, with their side. */
function targetName(t: Translate, format: Format, debate: Debate, target: ScoreTarget): string {
  const side = format.sides[target.side];
  if (target.slot === null) return side;
  const member = membersOf(debate.teams, target.side).find(
    (candidate) => candidate.slot === target.slot,
  );
  return t('jury.student', { name: member?.name ?? '?', side });
}

interface JurorsProps {
  readonly jurors: readonly Juror[];
  readonly current: Juror;
  /** What the current juror is called. */
  readonly name: string;
  readonly idPrefix: string;
  readonly dispatch: Dispatch<Action>;
}

/** The jurors, one of them open; another one; and the name of the open one, or taking them off. */
function Jurors({ jurors, current, name, idPrefix, dispatch }: JurorsProps) {
  const { t } = useI18n();
  const nameId = `${idPrefix}-juror-name`;
  const full = jurors.length >= MAX_JURORS;
  return (
    <div className={styles.jurors}>
      <div role="group" aria-label={t('jury.jurors')} className={styles.jurorList}>
        {jurors.map((juror, index) => (
          <button
            key={juror.id}
            type="button"
            className={styles.name}
            aria-pressed={juror.id === current.id}
            onClick={() => dispatch({ type: 'select-juror', jurorId: juror.id })}
          >
            {jurorName(t, juror, index)}
          </button>
        ))}
        <button
          type="button"
          className={styles.addJuror}
          aria-disabled={full}
          onClick={() => {
            if (!full) dispatch({ type: 'add-juror' });
          }}
        >
          <span aria-hidden="true">+ </span>
          {t('jury.add')}
        </button>
      </div>
      <div className={styles.jurorTools}>
        <div className={styles.jurorField}>
          <label htmlFor={nameId} className={styles.jurorLabel}>
            {t('jury.name')}
          </label>
          <input
            // The field follows the open juror.
            key={current.id}
            id={nameId}
            type="text"
            autoComplete="off"
            maxLength={MAX_NAME_LENGTH}
            className={styles.jurorName}
            value={current.name}
            onChange={(event) =>
              dispatch({ type: 'set-juror-name', jurorId: current.id, name: event.target.value })
            }
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur();
            }}
          />
        </div>
        {jurors.length > 1 && (
          <InlineConfirm
            key={current.id}
            trigger={t('jury.remove', { juror: name })}
            variant="ghost"
            triggerClassName={styles.inkGhost}
            question={t('jury.remove.question', { juror: name })}
            confirm={t('jury.remove.confirm')}
            onConfirm={() => dispatch({ type: 'remove-juror', jurorId: current.id })}
          />
        )}
      </div>
    </div>
  );
}

interface TargetSheetProps {
  readonly rubric: Rubric;
  readonly juror: Juror;
  readonly target: ScoreTarget;
  /** The team or the student, as the sheet is headed. */
  readonly name: string;
  readonly idPrefix: string;
  readonly dispatch: Dispatch<Action>;
}

/** One juror's scores for one team or student: a row of levels per criterion, and the total. */
function TargetSheet({ rubric, juror, target, name, idPrefix, dispatch }: TargetSheetProps) {
  const { t, formatNumber } = useI18n();
  const sheet = sheetOf(rubric, juror, target);
  const set = (criterionId: string, score: number | null) =>
    dispatch({ type: 'set-score', jurorId: juror.id, target, criterionId, score });
  const total = sheet.total === null ? '—' : formatNumber(sheet.total);

  return (
    <fieldset className={styles.sheet}>
      <legend className={styles.sheetName}>{name}</legend>
      <ol className={styles.criteria}>
        {rubric.criteria.map((criterion, index) => (
          <CriterionScore
            key={criterion.id}
            rubric={rubric}
            criterion={criterion}
            score={sheet.scores[index]}
            who={name}
            name={`${idPrefix}-${criterion.id}`}
            onScore={(score) => set(criterion.id, score)}
          />
        ))}
      </ol>
      <p className={styles.sheetTotal}>
        <span>{t('jury.total')}</span>
        <span className={styles.sheetTotalValue}>
          {`${total} / ${formatNumber(rubricMaxTotal(rubric))}`}
        </span>
      </p>
    </fieldset>
  );
}

interface CriterionScoreProps {
  readonly rubric: Rubric;
  readonly criterion: RubricCriterion;
  readonly score: number | null;
  /** The team or the student this score is for. */
  readonly who: string;
  /** The name of the group of radio buttons. */
  readonly name: string;
  readonly onScore: (score: number | null) => void;
}

/**
 * The levels of the scale as radio buttons, the chosen one filled, and what
 * it means when the rubric says. A score can be taken back.
 */
function CriterionScore({ rubric, criterion, score, who, name, onScore }: CriterionScoreProps) {
  const { t, formatNumber } = useI18n();
  const { min, max } = rubric.scale;
  const levels = Array.from({ length: max - min + 1 }, (_, index) => min + index);
  const described = criterion.levels.some((line) => line.trim() !== '');
  const meaning = score === null ? '' : (criterion.levels[score - min] ?? '');

  return (
    <li>
      <fieldset className={styles.criterion}>
        <legend className={styles.criterionName}>
          {criterion.label}
          {criterion.weight !== 1 && (
            <>
              {' '}
              <span className={styles.criterionWeight}>
                {`· ${t('jury.weight', { weight: criterion.weight })}`}
              </span>
            </>
          )}
        </legend>
        <div className={styles.levels}>
          {levels.map((level) => (
            <label
              key={level}
              className={styles.level}
              title={criterion.levels[level - min] || undefined}
            >
              <input
                type="radio"
                name={name}
                value={level}
                checked={score === level}
                className={styles.levelInput}
                onChange={() => onScore(level)}
              />
              <span className={styles.levelMark}>{formatNumber(level)}</span>
            </label>
          ))}
          {score !== null && (
            <button
              type="button"
              className={styles.inkButton}
              aria-label={t('jury.clearScore', { criterion: criterion.label, who })}
              onClick={() => onScore(null)}
            >
              ×
            </button>
          )}
        </div>
        {described && (
          <p className={styles.levelText} aria-live="polite">
            {meaning}
          </p>
        )}
      </fieldset>
    </li>
  );
}

interface OverviewProps {
  readonly rubric: Rubric;
  readonly format: Format;
  readonly debate: Debate;
  readonly jurors: readonly Juror[];
}

/** Each juror's total for each team or student, and their average. */
function Overview({ rubric, format, debate, jurors }: OverviewProps) {
  const { t, formatNumber } = useI18n();
  const heading = useId();
  const figure = (value: number | null) =>
    value === null ? '—' : formatNumber(value, { maximumFractionDigits: 2 });
  const targets = scoreTargets(rubric, debate.teams);
  const first = rubric.scope === 'team' ? t('report.side') : t('report.student');

  return (
    <section aria-labelledby={heading} className={styles.overview}>
      <h3 id={heading} className={styles.overviewTitle}>
        {t('jury.overview')}
      </h3>
      <div className={styles.overviewScroll}>
        <table className={styles.overviewTable}>
          <thead>
            <tr>
              <th scope="col">
                <span className={a11y.visuallyHidden}>{first}</span>
              </th>
              {jurors.map((juror, index) => (
                <th key={juror.id} scope="col">
                  {jurorName(t, juror, index)}
                </th>
              ))}
              <th scope="col">{t('jury.average')}</th>
            </tr>
          </thead>
          <tbody>
            {targets.map((target) => {
              const sheets = jurors.map((juror) => sheetOf(rubric, juror, target));
              const average = averageSheet(rubric, sheets);
              return (
                <tr key={targetKey(target)}>
                  <th scope="row">{targetName(t, format, debate, target)}</th>
                  {sheets.map((sheet, index) => (
                    <td key={jurors[index].id}>{figure(sheet.total)}</td>
                  ))}
                  <td className={styles.overviewAverage}>{figure(average.total)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
