import { useEffect, useRef } from 'react';
import { Button } from '../components/ui/Button';
import { useI18n } from '../i18n';
import { SIDES } from '../model/config';
import type { AppState, OpenDebate } from '../model/reducer';
import { membersOf } from '../model/session';
import styles from './DebateScreen.module.css';

interface Props {
  readonly state: AppState;
  /** The open debate (`currentDebate(state)`). */
  readonly open: OpenDebate;
  /** Close the debate and go back to the setup. */
  readonly onBack: () => void;
}

/**
 * The screen of an open debate. A placeholder for now: the topic, the teams
 * and a way back. The debate screen itself (steps, timer, vote) is #6.
 */
export function DebateScreen({ state, open, onBack }: Props) {
  const { t } = useI18n();
  const heading = useRef<HTMLHeadingElement>(null);
  const { format } = state.config;
  const number = state.session.debates.findIndex((debate) => debate.id === open.debate.id) + 1;

  // The Start button that brought the teacher here is gone: start reading at the topic.
  useEffect(() => {
    heading.current?.focus();
  }, []);

  return (
    <main className={styles.shell}>
      <p className={styles.eyebrow}>{`// ${t('debates.label', { number })}`}</p>
      <h1 ref={heading} tabIndex={-1} className={styles.topic}>
        {open.topic?.text ?? t('debates.topicGone')}
      </h1>
      <dl className={styles.teams}>
        {SIDES.map((side) => (
          <div key={side}>
            <dt>{format.sides[side]}</dt>
            <dd>
              {membersOf(open.debate.teams, side)
                .map((member) => member.name)
                .join(', ')}
            </dd>
          </div>
        ))}
      </dl>
      <p className={styles.pending}>{t('debate.pending')}</p>
      <Button onClick={onBack}>
        <span aria-hidden="true">←</span> {t('debate.back')}
      </Button>
    </main>
  );
}
