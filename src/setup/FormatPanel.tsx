import { useId, useState } from 'react';
import { Button } from '../components/ui/Button';
import { Field, Select } from '../components/ui/Field';
import { InlineConfirm } from '../components/ui/InlineConfirm';
import { useFocusAfterRender } from '../components/ui/useFocusAfterRender';
import { useI18n } from '../i18n';
import {
  LIMITS,
  SIDES,
  STEP_TYPES,
  formatTotalSeconds,
  isStepType,
  stepSeconds,
  type Step,
  type TeamSize,
} from '../model/config';
import {
  addStep,
  moveStep,
  removeStep,
  setFormat,
  setSideLabel,
  setStepLabel,
  setStepSeconds,
  setStepSide,
  setStepType,
  setTeamSize,
} from '../model/edit';
import { DEFAULT_PRESET, PRESETS, findPreset } from '../model/presets';
import { hasResults, recordedStepIds, type Session } from '../model/session';
import { toInteger, type ConfigEditor } from './configEditor';
import { DraftField } from './DraftField';
import { ItemActions, actionIds } from './ItemActions';
import styles from './setup.module.css';

const BOUNDS: readonly (keyof TeamSize)[] = ['min', 'max'];

interface Props {
  readonly editor: ConfigEditor;
  readonly session: Session;
}

/**
 * The format: a preset to start from, the side labels, the team size and the
 * steps. When a debate already has results, the editor stays shut until the
 * teacher confirms they want to change it anyway.
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
                  // At most one vote before and one vote after, in that order.
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

          {step.type === 'speech' && (
            <Field id={`${base}-side`} label={t('format.step.side')} className={styles.cellSide}>
              <Select
                id={`${base}-side`}
                value={step.side}
                onChange={(event) => {
                  const side = SIDES.find((candidate) => candidate === event.target.value);
                  if (side !== undefined) editor.apply(setStepSide(config, step.id, side));
                }}
              >
                {SIDES.map((side) => (
                  <option key={side} value={side}>
                    {sides[side]}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          {seconds === null ? (
            <p className={styles.stepNote}>{t('format.step.vote')}</p>
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
