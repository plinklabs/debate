import { useId, useState } from 'react';
import { Button } from '../components/ui/Button';
import { Checkbox } from '../components/ui/Checkbox';
import { Field, Select } from '../components/ui/Field';
import { InlineConfirm } from '../components/ui/InlineConfirm';
import { useFocusAfterRender } from '../components/ui/useFocusAfterRender';
import { useI18n } from '../i18n';
import {
  LIMITS,
  RUBRIC_SCOPES,
  SIDES,
  STEP_TYPES,
  formatTotalSeconds,
  isStepType,
  rubricMaxTotal,
  scaleLevels,
  stepSeconds,
  stepSide,
  type RubricCriterion,
  type RubricScale,
  type Step,
  type TeamSize,
} from '../model/config';
import {
  NEW_PREP_SECONDS,
  addCriterion,
  addStep,
  customRubric,
  moveCriterion,
  moveStep,
  removeCriterion,
  removeStep,
  setCriterionLabel,
  setCriterionLevel,
  setCriterionWeight,
  setFormat,
  setPrepTime,
  setRubric,
  setRubricScale,
  setRubricScope,
  setSideLabel,
  setStepLabel,
  setStepSeconds,
  setStepSide,
  setStepType,
  setTeamSize,
} from '../model/edit';
import { DEFAULT_PRESET, PRESETS, findPreset, standardRubric } from '../model/presets';
import { hasResults, recordedStepIds, scoredCriterionIds, type Session } from '../model/session';
import { toInteger, type ConfigEditor } from './configEditor';
import { DraftField } from './DraftField';
import { ItemActions, actionIds } from './ItemActions';
import styles from './setup.module.css';

const BOUNDS: readonly (keyof TeamSize)[] = ['min', 'max'];
const SCALE_BOUNDS: readonly (keyof RubricScale)[] = ['min', 'max'];

interface Props {
  readonly editor: ConfigEditor;
  readonly session: Session;
}

/**
 * The format: a preset to start from, the side labels, the team size, the
 * prep-time bank, the steps and the jury's rubric. When a debate already has
 * results, the editor stays shut until the teacher confirms they want to
 * change it anyway.
 */
export function FormatPanel({ editor, session }: Props) {
  const { t, formatDuration, formatNumber } = useI18n();
  const prefix = useId();
  const focusLater = useFocusAfterRender();
  const [unlocked, setUnlocked] = useState(false);
  const { config } = editor;
  const { format } = config;

  const withResults = session.debates.filter(hasResults).length;
  const locked = withResults > 0 && !unlocked;

  const add = () => {
    const before = new Set(format.steps.map((step) => step.id));
    const added = addStep(config, recordedStepIds(session));
    const step = added.format.steps.find((candidate) => !before.has(candidate.id));
    if (step !== undefined) focusLater(`${prefix}-${step.id}-type`);
    editor.apply(added);
  };

  return (
    <section className={styles.panel} aria-labelledby={`${prefix}-heading`}>
      <h2 id={`${prefix}-heading`} className={styles.heading}>
        {t('setup.tab.format')}
      </h2>
      <p className={styles.intro}>{t('format.intro')}</p>

      <dl className={styles.specs}>
        <div>
          <dt>{t('format.total')}</dt>
          <dd>{formatDuration(formatTotalSeconds(format), 'long')}</dd>
        </div>
        <div>
          <dt>{t('format.stepCount')}</dt>
          <dd>{formatNumber(format.steps.length)}</dd>
        </div>
      </dl>

      {locked && (
        <div className={styles.notice} role="note">
          <p>{t('format.locked', { count: withResults })}</p>
          <Button onClick={() => setUnlocked(true)}>{t('format.unlock')}</Button>
        </div>
      )}

      <fieldset className={styles.bare} disabled={locked}>
        <PresetPicker editor={editor} idPrefix={prefix} />

        <fieldset className={styles.group}>
          <legend className={styles.groupTitle}>{t('format.sides')}</legend>
          <div className={styles.pair}>
            {SIDES.map((side) => (
              <DraftField
                key={side}
                id={`${prefix}-side-${side}`}
                label={t(`format.side.${side}`)}
                value={format.sides[side]}
                maxLength={LIMITS.sideLabelLength}
                apply={(raw) => editor.apply(setSideLabel(config, side, raw))}
              />
            ))}
          </div>
        </fieldset>

        <fieldset className={styles.group}>
          <legend className={styles.groupTitle}>{t('format.teamSize')}</legend>
          <div className={styles.pair}>
            {BOUNDS.map((bound) => (
              <DraftField
                key={bound}
                id={`${prefix}-team-${bound}`}
                kind="number"
                label={t(`format.teamSize.${bound}`)}
                value={String(format.teamSize[bound])}
                min={LIMITS.teamSize.min}
                max={LIMITS.teamSize.max}
                apply={(raw) => editor.apply(setTeamSize(config, bound, toInteger(raw)))}
              />
            ))}
          </div>
        </fieldset>

        <PrepTimeGroup editor={editor} idPrefix={prefix} />

        <div className={styles.group}>
          <h3 className={styles.groupTitle}>{t('format.steps')}</h3>
          <ol className={styles.list}>
            {format.steps.map((step, index) => (
              <StepItem
                key={step.id}
                step={step}
                index={index}
                editor={editor}
                idPrefix={prefix}
                onFocusLater={focusLater}
              />
            ))}
          </ol>
          <div className={styles.addRow}>
            <Button onClick={add} disabled={!editor.allows(addStep(config))}>
              {t('format.addStep')}
            </Button>
          </div>
        </div>

        <RubricGroup
          editor={editor}
          session={session}
          idPrefix={prefix}
          onFocusLater={focusLater}
        />
      </fieldset>
    </section>
  );
}

interface PresetPickerProps {
  readonly editor: ConfigEditor;
  readonly idPrefix: string;
}

/** Start over from a built-in format, in the current language. The topics stay. */
function PresetPicker({ editor, idPrefix }: PresetPickerProps) {
  const { t, locale } = useI18n();
  const [presetId, setPresetId] = useState(DEFAULT_PRESET.id);
  const preset = findPreset(presetId) ?? DEFAULT_PRESET;
  const id = `${idPrefix}-preset`;
  return (
    <div className={styles.presetRow}>
      <Field id={id} label={t('format.preset')} className={styles.presetField}>
        <Select id={id} value={preset.id} onChange={(event) => setPresetId(event.target.value)}>
          {PRESETS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name[locale]}
            </option>
          ))}
        </Select>
      </Field>
      <InlineConfirm
        trigger={t('format.usePreset')}
        question={t('format.usePreset.question')}
        confirm={t('format.usePreset.confirm')}
        onConfirm={() => editor.apply(setFormat(editor.config, preset.build(locale).format))}
      />
    </div>
  );
}

interface PrepTimeGroupProps {
  readonly editor: ConfigEditor;
  readonly idPrefix: string;
}

/**
 * The prep-time bank (#8): on or off, and how much each team gets. Switched
 * on, it starts at `NEW_PREP_SECONDS`.
 */
function PrepTimeGroup({ editor, idPrefix }: PrepTimeGroupProps) {
  const { t, formatDuration } = useI18n();
  const { config } = editor;
  const { prepTime } = config.format;
  const id = `${idPrefix}-prep`;
  return (
    <fieldset className={styles.group} aria-describedby={`${id}-about`}>
      <legend className={styles.groupTitle}>{t('format.prepTime')}</legend>
      <p id={`${id}-about`} className={styles.groupIntro}>
        {t('format.prepTime.hint')}
      </p>
      <div className={styles.prepRow}>
        <Checkbox
          id={`${id}-on`}
          label={t('format.prepTime.on')}
          checked={prepTime !== undefined}
          onChange={(event) =>
            editor.apply(setPrepTime(config, event.target.checked ? NEW_PREP_SECONDS : null))
          }
        />
        {prepTime !== undefined && (
          <DraftField
            id={`${id}-seconds`}
            kind="number"
            label={t('format.step.secondsPerTeam')}
            value={String(prepTime.secondsPerTeam)}
            min={LIMITS.prepSeconds.min}
            max={LIMITS.prepSeconds.max}
            hint={formatDuration(prepTime.secondsPerTeam)}
            className={styles.prepSeconds}
            apply={(raw) => editor.apply(setPrepTime(config, toInteger(raw)))}
          />
        )}
      </div>
    </fieldset>
  );
}

interface StepItemProps {
  readonly step: Step;
  readonly index: number;
  readonly editor: ConfigEditor;
  readonly idPrefix: string;
  readonly onFocusLater: (id: string) => void;
}

function StepItem({ step, index, editor, idPrefix, onFocusLater }: StepItemProps) {
  const { t, formatDuration } = useI18n();
  const { config } = editor;
  const { steps, sides } = config.format;
  const number = index + 1;
  const base = `${idPrefix}-${step.id}`;
  const seconds = stepSeconds(step);
  // A speech has a side, and a cross-examination the side that asks.
  const side = step.type === 'speech' || step.type === 'cross-examination' ? stepSide(step) : null;
  // A step without a label of its own goes by the name of its kind.
  const typeName = t(`stepType.${step.type}`);

  return (
    <li className={styles.item}>
      <div role="group" aria-labelledby={`${base}-name`} className={styles.itemMain}>
        <p id={`${base}-name`} className={styles.itemNumber}>
          {t('format.step', { number })}
        </p>
        <div className={styles.stepFields}>
          <Field id={`${base}-type`} label={t('format.step.type')}>
            <Select
              id={`${base}-type`}
              value={step.type}
              onChange={(event) => {
                const type = event.target.value;
                if (isStepType(type)) editor.apply(setStepType(config, step.id, type));
              }}
            >
              {STEP_TYPES.map((type) => (
                <option
                  key={type}
                  value={type}
                  // At most one vote before and one vote after, in that order;
                  // at most one jury, and only with a rubric.
                  disabled={
                    type !== step.type && !editor.allows(setStepType(config, step.id, type))
                  }
                >
                  {t(`stepType.${type}`)}
                </option>
              ))}
            </Select>
          </Field>

          <DraftField
            id={`${base}-label`}
            label={t('format.step.label')}
            value={step.label}
            placeholder={typeName}
            maxLength={LIMITS.stepLabelLength}
            apply={(raw) => editor.apply(setStepLabel(config, step.id, raw))}
          />

          {side !== null && (
            <Field
              id={`${base}-side`}
              label={
                step.type === 'cross-examination'
                  ? t('format.step.askingSide')
                  : t('format.step.side')
              }
              className={styles.cellSide}
            >
              <Select
                id={`${base}-side`}
                value={side}
                onChange={(event) => {
                  const picked = SIDES.find((candidate) => candidate === event.target.value);
                  if (picked !== undefined) editor.apply(setStepSide(config, step.id, picked));
                }}
              >
                {SIDES.map((option) => (
                  <option key={option} value={option}>
                    {sides[option]}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          {seconds === null ? (
            <p className={styles.stepNote}>
              {step.type === 'jury' ? t('format.step.jury') : t('format.step.vote')}
            </p>
          ) : (
            <DraftField
              // A field of its own per kind: a half-typed duration does not carry over.
              key={step.type}
              id={`${base}-seconds`}
              kind="number"
              label={
                step.type === 'free-round'
                  ? t('format.step.secondsPerTeam')
                  : t('format.step.seconds')
              }
              value={String(seconds)}
              min={LIMITS.stepSeconds.min}
              max={LIMITS.stepSeconds.max}
              hint={formatDuration(seconds)}
              className={styles.cellTime}
              apply={(raw) => editor.apply(setStepSeconds(config, step.id, toInteger(raw)))}
            />
          )}
        </div>
      </div>
      <ItemActions
        base={base}
        labels={{
          up: t('format.step.moveUp', { number }),
          down: t('format.step.moveDown', { number }),
          remove: t('format.step.remove', { number }),
        }}
        canMoveUp={editor.allows(moveStep(config, step.id, -1))}
        canMoveDown={editor.allows(moveStep(config, step.id, 1))}
        canRemove={editor.allows(removeStep(config, step.id))}
        onMove={(offset) => {
          onFocusLater(actionIds(base)[offset < 0 ? 'up' : 'down']);
          editor.apply(moveStep(config, step.id, offset));
        }}
        onRemove={() => {
          const next = steps[index + 1] ?? steps[index - 1];
          onFocusLater(actionIds(`${idPrefix}-${next.id}`).remove);
          editor.apply(removeStep(config, step.id));
        }}
      />
    </li>
  );
}

interface RubricGroupProps {
  readonly editor: ConfigEditor;
  readonly session: Session;
  readonly idPrefix: string;
  readonly onFocusLater: (id: string) => void;
}

/**
 * The jury's rubric (#10): none, the standard rubric or one of the teacher's
 * own; its scale, who it scores, and its criteria with their weights and what
 * each score means. It cannot go while a jury step scores on it.
 */
function RubricGroup({ editor, session, idPrefix, onFocusLater }: RubricGroupProps) {
  const { t, locale } = useI18n();
  const { config } = editor;
  const { rubric, steps } = config.format;
  const id = `${idPrefix}-rubric`;
  const reserved = scoredCriterionIds(session);

  if (rubric === undefined) {
    return (
      <fieldset className={styles.group} aria-describedby={`${id}-about`}>
        <legend className={styles.groupTitle}>{t('format.rubric')}</legend>
        <p id={`${id}-about`} className={styles.groupIntro}>
          {t('format.rubric.hint')}
        </p>
        <div className={styles.rubricStart}>
          <Button
            id={`${id}-standard`}
            onClick={() => {
              onFocusLater(`${id}-scale-min`);
              editor.apply(setRubric(config, standardRubric(locale)));
            }}
          >
            {t('format.rubric.addStandard')}
          </Button>
          <Button
            onClick={() => {
              onFocusLater(`${id}-scale-min`);
              editor.apply(
                setRubric(config, customRubric(t('format.rubric.newCriterion'), reserved)),
              );
            }}
          >
            {t('format.rubric.addCustom')}
          </Button>
        </div>
      </fieldset>
    );
  }

  const add = () => {
    const before = new Set(rubric.criteria.map((criterion) => criterion.id));
    const added = addCriterion(config, t('format.rubric.newCriterion'), reserved);
    const criterion = added.format.rubric?.criteria.find((item) => !before.has(item.id));
    if (criterion !== undefined) onFocusLater(`${id}-${criterion.id}-label`);
    editor.apply(added);
  };
  const removable = editor.allows(setRubric(config, null));
  const scoredOn = steps.some((step) => step.type === 'jury');

  return (
    <fieldset className={styles.group} aria-describedby={`${id}-about`}>
      <legend className={styles.groupTitle}>{t('format.rubric')}</legend>
      <p id={`${id}-about`} className={styles.groupIntro}>
        {t('format.rubric.hint')}
      </p>
      <div className={styles.rubricSettings}>
        {SCALE_BOUNDS.map((bound) => (
          <DraftField
            key={bound}
            id={`${id}-scale-${bound}`}
            kind="number"
            label={t(`format.rubric.scale.${bound}`)}
            value={String(rubric.scale[bound])}
            min={LIMITS.rubricScale.min}
            max={LIMITS.rubricScale.max}
            apply={(raw) => editor.apply(setRubricScale(config, bound, toInteger(raw)))}
          />
        ))}
        <Field id={`${id}-scope`} label={t('format.rubric.scope')}>
          <Select
            id={`${id}-scope`}
            value={rubric.scope}
            onChange={(event) => {
              const scope = RUBRIC_SCOPES.find((candidate) => candidate === event.target.value);
              if (scope !== undefined) editor.apply(setRubricScope(config, scope));
            }}
          >
            {RUBRIC_SCOPES.map((scope) => (
              <option key={scope} value={scope}>
                {t(`format.rubric.scope.${scope}`)}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <p className={styles.rubricTotal}>
        {t('format.rubric.maxTotal', { max: rubricMaxTotal(rubric) })}
      </p>

      <h4 className={styles.subTitle}>{t('format.rubric.criteria')}</h4>
      <ol className={styles.list}>
        {rubric.criteria.map((criterion, index) => (
          <CriterionItem
            key={criterion.id}
            criterion={criterion}
            index={index}
            editor={editor}
            idPrefix={id}
            onFocusLater={onFocusLater}
          />
        ))}
      </ol>
      <div className={styles.addRow}>
        <Button
          onClick={add}
          disabled={!editor.allows(addCriterion(config, t('format.rubric.newCriterion')))}
        >
          {t('format.rubric.addCriterion')}
        </Button>
        {removable && (
          <InlineConfirm
            trigger={t('format.rubric.remove')}
            variant="ghost"
            question={t('format.rubric.remove.question')}
            confirm={t('format.rubric.remove')}
            onConfirm={() => {
              onFocusLater(`${id}-standard`);
              editor.apply(setRubric(config, null));
            }}
          />
        )}
      </div>
      <p className={styles.rubricNote}>
        {scoredOn ? t('format.rubric.removeBlocked') : t('format.rubric.noJuryStep')}
      </p>
    </fieldset>
  );
}

interface CriterionItemProps {
  readonly criterion: RubricCriterion;
  readonly index: number;
  readonly editor: ConfigEditor;
  /** The rubric's id prefix. */
  readonly idPrefix: string;
  readonly onFocusLater: (id: string) => void;
}

/** A criterion: its name, its weight and, folded away, what each score on it means. */
function CriterionItem({ criterion, index, editor, idPrefix, onFocusLater }: CriterionItemProps) {
  const { t } = useI18n();
  const { config } = editor;
  const { rubric } = config.format;
  if (rubric === undefined) return null;
  const { criteria, scale } = rubric;
  const number = index + 1;
  const base = `${idPrefix}-${criterion.id}`;
  const levels = Array.from({ length: scaleLevels(scale) }, (_, at) => scale.min + at);

  return (
    <li className={styles.item}>
      <div role="group" aria-labelledby={`${base}-name`} className={styles.itemMain}>
        <p id={`${base}-name`} className={styles.itemNumber}>
          {t('format.rubric.criterion', { number })}
        </p>
        <div className={styles.criterionFields}>
          <DraftField
            id={`${base}-label`}
            label={t('format.rubric.criterion.label')}
            value={criterion.label}
            maxLength={LIMITS.criterionLabelLength}
            apply={(raw) => editor.apply(setCriterionLabel(config, criterion.id, raw))}
          />
          <DraftField
            id={`${base}-weight`}
            kind="number"
            label={t('format.rubric.criterion.weight')}
            value={String(criterion.weight)}
            min={LIMITS.criterionWeight.min}
            max={LIMITS.criterionWeight.max}
            apply={(raw) => editor.apply(setCriterionWeight(config, criterion.id, toInteger(raw)))}
          />
        </div>
        <details className={styles.levelsBox}>
          <summary className={styles.levelsSummary}>{t('format.rubric.criterion.levels')}</summary>
          <div className={styles.levelFields}>
            {levels.map((level) => (
              <DraftField
                key={level}
                id={`${base}-level-${level}`}
                label={t('format.rubric.level', { level })}
                value={criterion.levels[level - scale.min] ?? ''}
                maxLength={LIMITS.levelLength}
                apply={(raw) => editor.apply(setCriterionLevel(config, criterion.id, level, raw))}
              />
            ))}
          </div>
        </details>
      </div>
      <ItemActions
        base={base}
        labels={{
          up: t('format.rubric.criterion.moveUp', { number }),
          down: t('format.rubric.criterion.moveDown', { number }),
          remove: t('format.rubric.criterion.remove', { number }),
        }}
        canMoveUp={editor.allows(moveCriterion(config, criterion.id, -1))}
        canMoveDown={editor.allows(moveCriterion(config, criterion.id, 1))}
        canRemove={editor.allows(removeCriterion(config, criterion.id))}
        onMove={(offset) => {
          onFocusLater(actionIds(base)[offset < 0 ? 'up' : 'down']);
          editor.apply(moveCriterion(config, criterion.id, offset));
        }}
        onRemove={() => {
          const next = criteria[index + 1] ?? criteria[index - 1];
          onFocusLater(actionIds(`${idPrefix}-${next.id}`).remove);
          editor.apply(removeCriterion(config, criterion.id));
        }}
      />
    </li>
  );
}
