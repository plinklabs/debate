import type { ReactNode } from 'react';
import { useI18n } from '../i18n';
import type { ConsultationStep, Step } from '../model/config';
import { clocksOf } from '../model/session';
import { AudienceQuestionsPanel } from './AudienceQuestionsPanel';
import { Countdown } from './Countdown';
import { CrossExaminationPanel } from './CrossExaminationPanel';
import styles from './debate.module.css';
import { FreeRoundPanel } from './FreeRoundPanel';
import type { PanelProps } from './panels';
import { SpeechPanel } from './SpeechPanel';
import { VotePanel } from './VotePanel';

/**
 * What the stage shows for the current step, by the step's type. A new kind
 * of step gets its panel here; the compiler asks for it, since the switch
 * covers every type.
 */
export function StepPanel(props: PanelProps<Step>): ReactNode {
  const { step } = props;
  switch (step.type) {
    case 'speech':
      return <SpeechPanel {...props} step={step} />;
    case 'consultation':
      return <ConsultationPanel {...props} step={step} />;
    case 'free-round':
      return <FreeRoundPanel {...props} step={step} />;
    case 'cross-examination':
      return <CrossExaminationPanel {...props} step={step} />;
    case 'audience-questions':
      return <AudienceQuestionsPanel {...props} step={step} />;
    case 'vote-before':
    case 'vote-after':
      return <VotePanel {...props} step={step} />;
  }
}

/** Both teams prepare: only a clock. */
function ConsultationPanel({ step, debate, now }: PanelProps<ConsultationStep>) {
  const { t } = useI18n();
  const [clock] = clocksOf(debate, step);
  return (
    <div className={styles.split}>
      <Countdown clock={clock} now={now} label={t('debate.clock')} />
      <div className={styles.floor}>
        <p className={styles.floorLine}>{t('debate.consult')}</p>
      </div>
    </div>
  );
}
