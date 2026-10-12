import type { Translate } from '../i18n';
import { otherSide, stepSide, type Format, type Step } from '../model/config';

/** What a step is called on screen: its label, or the name of its kind when it has none. */
export function stepName(step: Step, t: Translate): string {
  const label = step.label.trim();
  return label === '' ? t(`stepType.${step.type}`) : label;
}

/** Whose turn a step is: a side, one side asking the other, both teams, or the audience. */
export function stepWho(step: Step, format: Format, t: Translate): string {
  switch (step.type) {
    case 'cross-examination':
      return t('debate.who.crossExam', {
        asking: format.sides[step.askingSide],
        answering: format.sides[otherSide(step.askingSide)],
      });
    case 'audience-questions':
      return t('debate.who.audienceQuestions');
    case 'vote-before':
    case 'vote-after':
      return t('debate.who.audience');
    case 'speech':
    case 'consultation':
    case 'free-round': {
      const side = stepSide(step);
      return side === null ? t('debate.who.both') : format.sides[side];
    }
  }
}
