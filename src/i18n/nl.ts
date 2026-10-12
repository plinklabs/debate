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
  'issue.invalid-link': () =>
    'Deze link is beschadigd of onvolledig. Kopieer de hele link opnieuw, of vraag een nieuwe.',
  'issue.too-large': () => 'Dit is te groot voor een opzet.',
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

  'action.cancel': 'Annuleren',
  'action.remove': 'Verwijderen',

  'setup.eyebrow': '// Opzet',
  'setup.lede':
    'Stellingen, teams, spreektijden en een stemming van het publiek, om een debat in de klas te houden. Alles blijft in je browser.',
  'setup.areas': 'Delen van de opzet',
  'setup.tab.topics': 'Stellingen',
  'setup.tab.format': 'Debatvorm',
  'setup.tab.debates': 'Debatten en teams',
  'setup.tab.share': 'Delen',

  'topics.intro':
    'De stellingen waarover de klas debatteert. Meerdere debatten kunnen dezelfde stelling gebruiken.',
  'topics.label': ({ number }) => `Stelling ${n(number)}`,
  'topics.moveUp': ({ number }) => `Stelling ${n(number)} naar boven`,
  'topics.moveDown': ({ number }) => `Stelling ${n(number)} naar beneden`,
  'topics.remove': ({ number }) => `Stelling ${n(number)} verwijderen`,
  'topics.inUse': ({ count }) =>
    count === 1 ? 'Gebruikt in 1 debat.' : `Gebruikt in ${n(count)} debatten.`,
  'topics.new': 'Nieuwe stelling',
  'topics.add': 'Stelling toevoegen',

  'format.intro':
    'De kanten, de grootte van de teams en de stappen van een debat. Elk debat in deze opzet volgt ze.',
  'format.total': 'Totale tijd',
  'format.stepCount': 'Aantal stappen',
  'format.locked': ({ count }) =>
    `${count === 1 ? 'Eén debat heeft al resultaten' : `${n(count)} debatten hebben al resultaten`}. Een wijziging aan de debatvorm verandert hoe die te lezen zijn: een stap die je verwijdert, valt eruit, en een nieuwe duur verandert de geplande tijd.`,
  'format.unlock': 'Debatvorm toch wijzigen',
  'format.preset': 'Sjabloon',
  'format.usePreset': 'Dit sjabloon gebruiken',
  'format.usePreset.question':
    'Dit vervangt de kanten, de teamgrootte en alle stappen. De stellingen blijven.',
  'format.usePreset.confirm': 'Debatvorm vervangen',
  'format.sides': 'Kanten',
  'format.side.pro': 'Voor de stelling',
  'format.side.con': 'Tegen de stelling',
  'format.teamSize': 'Leerlingen per team',
  'format.teamSize.min': 'Minstens',
  'format.teamSize.max': 'Hoogstens',
  'format.steps': 'Stappen',
  'format.step': ({ number }) => `Stap ${n(number)}`,
  'format.step.type': 'Soort',
  'format.step.label': 'Titel',
  'format.step.side': 'Kant',
  'format.step.seconds': 'Seconden',
  'format.step.secondsPerTeam': 'Seconden per team',
  'format.step.vote': 'Het publiek stemt. Geen klok.',
  'format.step.moveUp': ({ number }) => `Stap ${n(number)} naar boven`,
  'format.step.moveDown': ({ number }) => `Stap ${n(number)} naar beneden`,
  'format.step.remove': ({ number }) => `Stap ${n(number)} verwijderen`,
  'format.addStep': 'Stap toevoegen',

  'debates.intro':
    'Een debat is één stelling met een team aan elke kant. Het kan beginnen zodra beide teams volledig zijn.',
  'debates.topic': 'Stelling',
  'debates.add': 'Debat toevoegen',
  'debates.none': 'Nog geen debatten. Kies een stelling en voeg er een toe.',
  'debates.label': ({ number }) => `Debat ${n(number)}`,
  'debates.topicGone': 'Deze stelling zit niet meer in de opzet.',
  'debates.name': ({ number }) => `Naam ${n(number)}`,
  'debates.nameOptional': ({ number }) => `Naam ${n(number)} (mag leeg)`,
  'debates.team.complete': 'Volledig',
  'debates.team.tooFew': ({ min }) =>
    min === 1 ? 'Nog geen naam' : `Minstens ${n(min)} namen nodig`,
  'debates.team.tooMany': ({ max }) =>
    max === 1 ? 'Hoogstens één naam' : `Hoogstens ${n(max)} namen`,
  'debates.status.ready': 'Klaar',
  'debates.status.incomplete': 'Teams onvolledig',
  'debates.status.started': 'Begonnen',
  'debates.status.done': 'Afgewerkt',
  'debates.start': 'Beginnen',
  'debates.continue': 'Verdergaan',
  'debates.open': 'Openen',
  'debates.remove': ({ number }) => `Debat ${n(number)} verwijderen`,
  'debates.remove.question': 'Dit debat verwijderen, met de namen en resultaten?',
  'debates.remove.confirm': 'Debat verwijderen',

  'share.intro':
    'Deel deze opzet met een collega, bewaar hem voor volgend jaar of zet hem op een cursuspagina. Een link of een bestand bevat de stellingen en de debatvorm, en niets anders: namen, tijden, stemmen en scores blijven in deze browser.',
  'share.link': 'Als link',
  'share.link.label': 'Link naar deze opzet',
  'share.link.hint': 'Wie hem opent, ziet eerst de opzet en kiest dan of die gebruikt wordt.',
  'share.link.making': 'De link wordt gemaakt…',
  'share.link.copy': 'Link kopiëren',
  'share.link.copied': 'Link gekopieerd.',
  'share.link.copyFailed':
    'Deze browser laat de app niet kopiëren. De link is geselecteerd: kopieer hem met Ctrl+C, of Cmd+C op een Mac.',
  'share.file': 'Als bestand',
  'share.file.intro':
    'Een .json-bestand om te bewaren of door te sturen. Open er een om te zien wat erin zit, voor je het gebruikt.',
  'share.file.download': 'Bestand downloaden',
  'share.file.open': 'Bestand openen',
  'share.file.name': 'debatopzet.json',

  'preview.eyebrow': '// Gedeelde opzet',
  'preview.reading': 'De opzet wordt gelezen…',
  'preview.title': 'Deze opzet gebruiken?',
  'preview.fromLink':
    'Deze opzet komt uit een link. Er verandert niets tot je kiest om hem te gebruiken.',
  'preview.fromFile': ({ name }) =>
    `Deze opzet komt uit het bestand ‘${name}’. Er verandert niets tot je kiest om hem te gebruiken.`,
  'preview.teamSize': ({ min, max }) => (min === max ? n(min) : `${n(min)} tot ${n(max)}`),
  'preview.perTeam': ({ duration }) => `${duration} per team`,
  'preview.impact': ({ debates, results }) =>
    debates === 1
      ? `Er is één debat in deze browser${results > 0 ? ', en het heeft al resultaten' : ''}. Het blijft, maar volgt vanaf nu deze opzet:`
      : `Er zijn ${n(debates)} debatten in deze browser${results === 0 ? '' : results === 1 ? ', en één ervan heeft al resultaten' : `, en ${n(results)} ervan hebben al resultaten`}. Ze blijven, maar volgen vanaf nu deze opzet:`,
  'preview.impact.topic': ({ number, topic }) => `Debat ${n(number)} gaat dan over ‘${topic}’`,
  'preview.impact.topicGone': ({ number }) =>
    `Debat ${n(number)} verliest zijn stelling: die zit niet in deze opzet.`,
  'preview.impact.format':
    'De debatvorm verandert: een stap die deze debatvorm niet heeft, valt uit de resultaten, en een nieuwe duur verandert de geplande tijd.',
  'preview.use': 'Deze opzet gebruiken',
  'preview.invalid.link': 'Deze link is niet bruikbaar',
  'preview.invalid.file': 'Dit bestand is niet bruikbaar',
  'preview.invalid.intro': 'Er zit geen opzet in die deze app kan lezen.',
  'preview.invalid.more': ({ count }) =>
    count === 1 ? 'En nog één probleem.' : `En nog ${n(count)} problemen.`,
  'preview.place.version': 'Versie',
  'preview.close': 'Verder naar de app',

  'debate.pending':
    'Het debatscherm is nog in aanbouw. Het toont straks de stappen, een grote klok en de stemming.',
  'debate.back': 'Terug naar de opzet',

  ...stepTypes,
  ...issues,
};
