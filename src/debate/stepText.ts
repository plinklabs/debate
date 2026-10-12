import type { Translate } from '../i18n';
import { stepSide, type Format, type Step } from '../model/config';

/** What a step is called on screen: its label, or the name of its kind when it has none. */
export function stepName(step: Step, t: Translate): string {
  const label = step.label.trim();
  return label === '' ? t(`stepType.${step.type}`) : label;
}

/** Whose turn a step is: a side, both teams, or the audience. */
export function stepWho(step: Step, format: Format, t: Translate): string {
  const side = stepSide(step);
  if (side !== null) return format.sides[side];
  return step.type === 'vote-before' || step.type === 'vote-after'
    ? t('debate.who.audience')
    : t('debate.who.both');
}
