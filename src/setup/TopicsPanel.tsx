import { useId, useState, type FormEvent } from 'react';
import { Button } from '../components/ui/Button';
import { Field, TextArea, describedBy } from '../components/ui/Field';
import { useFocusAfterRender } from '../components/ui/useFocusAfterRender';
import { useI18n } from '../i18n';
import { LIMITS } from '../model/config';
import { addTopic, moveTopic, removeTopic, setTopicText } from '../model/edit';
import type { Session } from '../model/session';
import { debatedTopicIds } from '../model/session';
import type { ConfigIssue } from '../model/validate';
import { NO_ISSUES, oneLine, type ConfigEditor } from './configEditor';
import { DraftField } from './DraftField';
import { ItemActions, actionIds } from './ItemActions';
import styles from './setup.module.css';

interface Props {
  readonly editor: ConfigEditor;
  readonly session: Session;
}

/** The statements to debate: add, edit, reorder and remove them. */
export function TopicsPanel({ editor, session }: Props) {
  const { t } = useI18n();
  const prefix = useId();
  const focusLater = useFocusAfterRender();
  const { config } = editor;
  const { topics } = config;

  const usage = new Map<string, number>();
  for (const debate of session.debates) {
    usage.set(debate.topicId, (usage.get(debate.topicId) ?? 0) + 1);
  }

  return (
    <section className={styles.panel} aria-labelledby={`${prefix}-heading`}>
      <h2 id={`${prefix}-heading`} className={styles.heading}>
        {t('setup.tab.topics')}
      </h2>
      <p className={styles.intro}>{t('topics.intro')}</p>

      <ol className={styles.list}>
        {topics.map((topic, index) => {
          const number = index + 1;
          const base = `${prefix}-${topic.id}`;
          const used = usage.get(topic.id) ?? 0;
          // A topic that debates use stays: removing it would leave them without one.
          const canRemove = used === 0 && editor.allows(removeTopic(config, topic.id));
          return (
            <li key={topic.id} className={styles.item}>
              <DraftField
                id={`${base}-text`}
                kind="textarea"
                label={t('topics.label', { number })}
                value={topic.text}
                maxLength={LIMITS.topicLength}
                hint={used > 0 ? t('topics.inUse', { count: used }) : undefined}
                apply={(raw) => editor.apply(setTopicText(config, topic.id, raw))}
                className={styles.itemMain}
              />
              <ItemActions
                base={base}
                labels={{
                  up: t('topics.moveUp', { number }),
                  down: t('topics.moveDown', { number }),
                  remove: t('topics.remove', { number }),
                }}
                canMoveUp={editor.allows(moveTopic(config, topic.id, -1))}
                canMoveDown={editor.allows(moveTopic(config, topic.id, 1))}
                canRemove={canRemove}
                onMove={(offset) => {
                  focusLater(actionIds(base)[offset < 0 ? 'up' : 'down']);
                  editor.apply(moveTopic(config, topic.id, offset));
                }}
                onRemove={() => {
                  const next = topics[index + 1] ?? topics[index - 1];
                  focusLater(actionIds(`${prefix}-${next.id}`).remove);
                  editor.apply(removeTopic(config, topic.id));
                }}
              />
            </li>
          );
        })}
      </ol>

      <NewTopic editor={editor} reserved={debatedTopicIds(session)} idPrefix={prefix} />
    </section>
  );
}

interface NewTopicProps {
  readonly editor: ConfigEditor;
  /** Topic ids that debates still refer to. */
  readonly reserved: Iterable<string>;
  readonly idPrefix: string;
}

function NewTopic({ editor, reserved, idPrefix }: NewTopicProps) {
  const { t, describeIssue } = useI18n();
  const [text, setText] = useState('');
  const [issues, setIssues] = useState<readonly ConfigIssue[]>(NO_ISSUES);
  const id = `${idPrefix}-new`;
  const invalid = issues.length > 0;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const found = editor.apply(addTopic(editor.config, text, reserved));
    setIssues(found);
    if (found.length === 0) setText('');
  };

  return (
    <form className={styles.addRow} onSubmit={submit} noValidate>
      <Field
        id={id}
        label={t('topics.new')}
        errors={[...new Set(issues.map(describeIssue))]}
        className={styles.itemMain}
      >
        <TextArea
          id={id}
          rows={2}
          value={text}
          invalid={invalid}
          maxLength={LIMITS.topicLength}
          aria-describedby={describedBy(id, { errors: invalid })}
          onChange={(event) => {
            setText(oneLine(event.target.value));
            setIssues(NO_ISSUES);
          }}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            event.currentTarget.form?.requestSubmit();
          }}
        />
      </Field>
      <Button type="submit">{t('topics.add')}</Button>
    </form>
  );
}
