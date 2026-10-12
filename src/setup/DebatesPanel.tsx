import { useEffect, useId, useRef, useState, type Dispatch, type FormEvent } from 'react';
import { Button } from '../components/ui/Button';
import { Field, Select, TextInput } from '../components/ui/Field';
import { InlineConfirm } from '../components/ui/InlineConfirm';
import a11y from '../components/ui/a11y.module.css';
import { useFocusAfterRender } from '../components/ui/useFocusAfterRender';
import { useI18n } from '../i18n';
import { SIDES, type DebateConfig, type Side } from '../model/config';
import type { Action, AppState } from '../model/reducer';
import {
  MAX_NAME_LENGTH,
  hasResults,
  isPlayable,
  membersOf,
  slotCount,
  type Debate,
} from '../model/session';
import styles from './setup.module.css';

/** Ids inside the debates panel, so the focus can be put back on a debate's controls. */
const ids = (prefix: string, debateId: string) => ({
  heading: `${prefix}-${debateId}-heading`,
  start: `${prefix}-${debateId}-start`,
  remove: `${prefix}-${debateId}-remove`,
  name: (side: Side, slot: number) => `${prefix}-${debateId}-${side}-${slot}`,
});

interface Props {
  readonly state: AppState;
  readonly dispatch: Dispatch<Action>;
  /** A debate whose Start button gets the focus: the one the teacher just left. */
  readonly focusDebate: string | null;
}

/** The debates: a topic each, a team per side, and Start once both teams are complete. */
export function DebatesPanel({ state, dispatch, focusDebate }: Props) {
  const { t } = useI18n();
  const prefix = useId();
  const focusLater = useFocusAfterRender();
  const { config, session } = state;
  const { debates } = session;
  const added = useRef(false);

  // Back from a debate: on its Start button, where the teacher left off.
  useEffect(() => {
    if (focusDebate !== null) document.getElementById(ids(prefix, focusDebate).start)?.focus();
  }, [focusDebate, prefix]);

  // A new debate: on its first name.
  useEffect(() => {
    const last = debates.at(-1);
    if (!added.current || last === undefined) return;
    added.current = false;
    document.getElementById(ids(prefix, last.id).name('pro', 0))?.focus();
  }, [debates, prefix]);

  // The magenta Start: the first debate that can begin and is not finished.
  const next = debates.find((debate) => !debate.done && isPlayable(config.format, debate));

  return (
    <section className={styles.panel} aria-labelledby={`${prefix}-heading`}>
      <h2 id={`${prefix}-heading`} className={styles.heading}>
        {t('setup.tab.debates')}
      </h2>
      <p className={styles.intro}>{t('debates.intro')}</p>

      <NewDebate
        config={config}
        idPrefix={prefix}
        onAdd={(topicId) => {
          added.current = true;
          dispatch({ type: 'add-debate', topicId });
        }}
      />

      {debates.length === 0 ? (
        <p className={styles.empty}>{t('debates.none')}</p>
      ) : (
        <ol className={styles.debates}>
          {debates.map((debate, index) => (
            <DebateItem
              key={debate.id}
              debate={debate}
              number={index + 1}
              config={config}
              idPrefix={prefix}
              primary={debate === next}
              dispatch={dispatch}
              onRemove={() => {
                const other = debates[index + 1] ?? debates[index - 1];
                focusLater(other === undefined ? `${prefix}-topic` : ids(prefix, other.id).remove);
                dispatch({ type: 'remove-debate', debateId: debate.id });
              }}
            />
          ))}
        </ol>
      )}
    </section>
  );
}

interface NewDebateProps {
  readonly config: DebateConfig;
  readonly idPrefix: string;
  readonly onAdd: (topicId: string) => void;
}

function NewDebate({ config, idPrefix, onAdd }: NewDebateProps) {
  const { t } = useI18n();
  const { topics } = config;
  const [picked, setPicked] = useState(topics[0].id);
  // The picked topic may have been removed meanwhile.
  const topicId = topics.some((topic) => topic.id === picked) ? picked : topics[0].id;
  const id = `${idPrefix}-topic`;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onAdd(topicId);
  };

  return (
    <form className={styles.addRow} onSubmit={submit}>
      <Field id={id} label={t('debates.topic')} className={styles.itemMain}>
        <Select id={id} value={topicId} onChange={(event) => setPicked(event.target.value)}>
          {topics.map((topic, index) => (
            <option key={topic.id} value={topic.id}>
              {`${index + 1}. ${topic.text}`}
            </option>
          ))}
        </Select>
      </Field>
      <Button type="submit">{t('debates.add')}</Button>
    </form>
  );
}

interface DebateItemProps {
  readonly debate: Debate;
  readonly number: number;
  readonly config: DebateConfig;
  readonly idPrefix: string;
  /** This debate's Start is the screen's one magenta action. */
  readonly primary: boolean;
  readonly dispatch: Dispatch<Action>;
  readonly onRemove: () => void;
}

function DebateItem({
  debate,
  number,
  config,
  idPrefix,
  primary,
  dispatch,
  onRemove,
}: DebateItemProps) {
  const { t } = useI18n();
  const { format } = config;
  const own = ids(idPrefix, debate.id);
  const topic = config.topics.find((candidate) => candidate.id === debate.topicId);
  const playable = isPlayable(format, debate);
  const results = hasResults(debate);
  const status = debate.done ? 'done' : results ? 'started' : playable ? 'ready' : 'incomplete';
  const start = debate.done ? 'debates.open' : results ? 'debates.continue' : 'debates.start';

  return (
    <li>
      <article className={styles.debate} aria-labelledby={own.heading}>
        <div className={styles.debateHead}>
          <h3 id={own.heading} className={styles.debateTitle}>
            {t('debates.label', { number })}
          </h3>
          <span className={styles.chip}>{t(`debates.status.${status}`)}</span>
        </div>
        <p className={topic === undefined ? styles.topicGone : styles.debateTopic}>
          {topic?.text ?? t('debates.topicGone')}
        </p>

        <div className={styles.teams}>
          {SIDES.map((side) => (
            <TeamFields
              key={side}
              debate={debate}
              side={side}
              config={config}
              idPrefix={idPrefix}
              dispatch={dispatch}
            />
          ))}
        </div>

        <div className={styles.debateActions}>
          <Button
            id={own.start}
            variant={primary ? 'primary' : 'secondary'}
            disabled={!playable}
            aria-describedby={own.heading}
            onClick={() =>
              dispatch({ type: 'open-debate', debateId: debate.id, now: performance.now() })
            }
          >
            {t(start)}
          </Button>
          <InlineConfirm
            trigger={t('action.remove')}
            triggerLabel={t('debates.remove', { number })}
            variant="ghost"
            question={t('debates.remove.question')}
            confirm={t('debates.remove.confirm')}
            onConfirm={onRemove}
          />
        </div>
      </article>
    </li>
  );
}

interface TeamFieldsProps {
  readonly debate: Debate;
  readonly side: Side;
  readonly config: DebateConfig;
  readonly idPrefix: string;
  readonly dispatch: Dispatch<Action>;
}

/** The names of one side, a field per slot, and whether the team is complete. */
function TeamFields({ debate, side, config, idPrefix, dispatch }: TeamFieldsProps) {
  const { t } = useI18n();
  const { teamSize, sides } = config.format;
  const own = ids(idPrefix, debate.id);
  const statusId = `${own.name(side, 0)}-status`;
  const size = membersOf(debate.teams, side).length;
  const slots = Array.from({ length: slotCount(config.format, debate.teams, side) }, (_, i) => i);

  const status =
    size < teamSize.min
      ? t('debates.team.tooFew', { min: teamSize.min })
      : size > teamSize.max
        ? t('debates.team.tooMany', { max: teamSize.max })
        : t('debates.team.complete');

  return (
    <fieldset className={styles.team} aria-describedby={statusId}>
      <legend className={styles.side}>{sides[side]}</legend>
      {slots.map((slot) => {
        const id = own.name(side, slot);
        const number = slot + 1;
        const name = debate.teams[side][slot] ?? '';
        const optional = slot >= teamSize.min && slot < teamSize.max;
        return (
          <div key={slot}>
            <label htmlFor={id} className={a11y.visuallyHidden}>
              {t('debates.name', { number })}
            </label>
            <TextInput
              id={id}
              value={name}
              placeholder={
                optional ? t('debates.nameOptional', { number }) : t('debates.name', { number })
              }
              maxLength={MAX_NAME_LENGTH}
              autoComplete="off"
              spellCheck={false}
              // A name beyond the largest team: there since the team size went down.
              invalid={slot >= teamSize.max && name.trim() !== ''}
              onChange={(event) =>
                dispatch({
                  type: 'set-name',
                  debateId: debate.id,
                  side,
                  slot,
                  name: event.target.value,
                })
              }
            />
          </div>
        );
      })}
      <p
        id={statusId}
        className={size >= teamSize.min && size <= teamSize.max ? styles.teamDone : styles.teamOpen}
      >
        {status}
      </p>
    </fieldset>
  );
}
