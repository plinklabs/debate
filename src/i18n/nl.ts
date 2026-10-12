// Nederlands. Typed as the English dictionary: a missing or an extra key is a
// type error. Plain Dutch, without English loanwords where Dutch has a word.

import { LIMITS, type StepType } from '../model/config';
import type { ValueType } from '../model/validate';
import type { Dictionary } from './en';
import { formatNumber } from './format';
import type { IssueMessages, StepTypeNames } from './types';

const n = (value: number) => formatNumber('nl', value);

const stepTypes: StepTypeNames = {
  'stepType.speech': 'Spreekbeurt',
  'stepType.consultation': 'Overleg',
  'stepType.free-round': 'Vrije ronde',
  'stepType.vote-before': 'Stemming vooraf',
  'stepType.vote-after': 'Stemming achteraf',
};

const stepType = (type: StepType) => stepTypes[`stepType.${type}`];

const valueTypes: Readonly<Record<ValueType, string>> = {
  object: 'een groep velden',
  array: 'een lijst',
  string: 'tekst',
  integer: 'een geheel getal',
};

const issues: IssueMessages = {
  'issue.invalid-json': () => 'Dit is geen opzet: de tekst kan niet gelezen worden.',
  'issue.newer-version': ({ found, supported }) =>
    `Deze opzet is gemaakt met een nieuwere versie van de app (versie ${n(found)}; deze leest tot versie ${n(supported)}). Laad de pagina opnieuw om de nieuwste versie te krijgen.`,
  'issue.invalid-version': () => 'Deze opzet heeft geen geldig versienummer.',
  'issue.missing-field': () => 'Dit veld ontbreekt.',
  'issue.wrong-type': ({ expected }) => `Hier hoort ${valueTypes[expected]}.`,
  'issue.unknown-step-type': ({ stepType }) => `Er bestaat geen soort stap ‘${stepType}’.`,
  'issue.unknown-side': ({ side }) => `Er bestaat geen kant ‘${side}’.`,
  'issue.out-of-range': ({ value, min, max }) =>
    `${n(value)} ligt niet tussen ${n(min)} en ${n(max)}.`,
  'issue.empty': () => 'Dit mag niet leeg zijn.',
  'issue.too-long': ({ length, max }) => `Te lang: ${n(length)} tekens, hoogstens ${n(max)}.`,
  'issue.too-few': ({ count, min }) => `Te weinig: ${n(count)}, minstens ${n(min)}.`,
  'issue.too-many': ({ count, max }) => `Te veel: ${n(count)}, hoogstens ${n(max)}.`,
  'issue.invalid-id': () =>
    `Een id bestaat uit 1 tot ${n(LIMITS.idLength)} letters, cijfers of streepjes, en begint niet met een streepje.`,
  'issue.duplicate-id': ({ id }) => `Het id ‘${id}’ komt meer dan één keer voor.`,
  'issue.duplicate-step-type': ({ stepType: type }) =>
    `Er mag maar één stap ‘${stepType(type)}’ zijn.`,
  'issue.team-size-order': ({ min, max }) =>
    `De kleinste teamgrootte (${n(min)}) is groter dan de grootste (${n(max)}).`,
  'issue.vote-order': () =>
    `De stap ‘${stepType('vote-after')}’ staat vóór de stap ‘${stepType('vote-before')}’.`,
};

export const nl: Dictionary = {
  'app.title': 'Debat — door Plink Labs',
  'app.name': 'Debat',
  'app.endorsement': '— door Plink Labs',

  'language.label': 'Taal',
  'language.name': 'Nederlands',
  'language.code': 'NL',

  'placeholder.status': '// In aanbouw',
  'placeholder.lede':
    'Stellingen, teams, spreektijden en een stemming van het publiek, om een debat in de klas te houden. Alles blijft in je browser.',

  ...stepTypes,
  ...issues,
};
