// Nederlands. Typed as the English dictionary: a missing or an extra key is a
// type error. Plain Dutch, without English loanwords where Dutch has a word.

import { LIMITS, type StepType } from '../model/config';
import type { ValueType } from '../model/validate';
import type { Dictionary } from './en';
import { formatNumber } from './format';
import type { IssueMessages, StepTypeNames } from './types';

const n = (value: number) => formatNumber('nl', value);

/** With its sign, `+3` or `-1,5`, and no sign for 0. */
const signed = (value: number, digits = 0) =>
  formatNumber('nl', value, { maximumFractionDigits: digits, signDisplay: 'exceptZero' });

/** 1 or −1 as shown with `digits` decimals: the singular. */
const isOne = (value: number, digits = 0) =>
  Math.abs(Math.round(value * 10 ** digits) / 10 ** digits) === 1;

const stepTypes: StepTypeNames = {
  'stepType.speech': 'Spreekbeurt',
  'stepType.consultation': 'Overleg',
  'stepType.free-round': 'Vrije ronde',
  'stepType.cross-examination': 'Kruisverhoor',
  'stepType.audience-questions': 'Publieksvragen',
  'stepType.vote-before': 'Stemming vooraf',
  'stepType.vote-after': 'Stemming achteraf',
  'stepType.jury': 'Juryoordeel',
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
  'issue.not-a-report': () =>
    'Dit is geen verslag van deze app: er zitten geen debatten in om te laden.',
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
  'issue.unknown-scope': ({ scope }) =>
    `Er bestaat geen manier van scoren ‘${scope}’: een beoordelingsraster scoort per ‘team’ of per ‘student’.`,
  'issue.scale-order': ({ min, max }) =>
    `De laagste score (${n(min)}) ligt niet onder de hoogste (${n(max)}).`,
  'issue.jury-without-rubric': () =>
    `Een stap ‘${stepType('jury')}’ heeft een beoordelingsraster nodig: voeg er een toe, of verwijder de stap.`,
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

  'update.ready': 'Er staat een nieuwe versie klaar.',
  'update.reload': 'Herladen',

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
    'Dit vervangt de kanten, de teamgrootte, de voorbereidingstijd, het beoordelingsraster en alle stappen. De stellingen blijven.',
  'format.usePreset.confirm': 'Debatvorm vervangen',
  'format.sides': 'Kanten',
  'format.side.pro': 'Voor de stelling',
  'format.side.con': 'Tegen de stelling',
  'format.teamSize': 'Leerlingen per team',
  'format.teamSize.min': 'Minstens',
  'format.teamSize.max': 'Hoogstens',
  'format.prepTime': 'Voorbereidingstijd',
  'format.prepTime.on': 'Een voorraad voorbereidingstijd per team',
  'format.prepTime.hint':
    'Elk team neemt voorbereidingstijd wanneer het wil, tussen twee stappen of tijdens een stap. Is de voorraad op, dan loopt de klok door in overtijd.',
  'format.steps': 'Stappen',
  'format.step': ({ number }) => `Stap ${n(number)}`,
  'format.step.type': 'Soort',
  'format.step.label': 'Titel',
  'format.step.side': 'Kant',
  'format.step.askingSide': 'Kant die vraagt',
  'format.step.seconds': 'Seconden',
  'format.step.secondsPerTeam': 'Seconden per team',
  'format.step.vote': 'Het publiek stemt. Geen klok.',
  'format.step.jury': 'De jury scoort op het beoordelingsraster. Geen klok.',
  'format.step.moveUp': ({ number }) => `Stap ${n(number)} naar boven`,
  'format.step.moveDown': ({ number }) => `Stap ${n(number)} naar beneden`,
  'format.step.remove': ({ number }) => `Stap ${n(number)} verwijderen`,
  'format.addStep': 'Stap toevoegen',

  'format.rubric': 'Beoordelingsraster',
  'format.rubric.hint':
    'Een jury scoort de teams of de leerlingen op deze criteria in een stap ‘Juryoordeel’, het ene jurylid na het andere op dit toestel. Het raster gaat mee als je de opzet deelt; de scores blijven in deze browser.',
  'format.rubric.addStandard': 'Standaardraster toevoegen',
  'format.rubric.addCustom': 'Eigen raster',
  'format.rubric.scale.min': 'Laagste score',
  'format.rubric.scale.max': 'Hoogste score',
  'format.rubric.scope': 'Scores voor',
  'format.rubric.scope.team': 'Elk team',
  'format.rubric.scope.student': 'Elke leerling',
  'format.rubric.maxTotal': ({ max }) => `Hoogste totaal: ${n(max)}`,
  'format.rubric.criteria': 'Beoordelingscriteria',
  'format.rubric.criterion': ({ number }) => `Criterium ${n(number)}`,
  'format.rubric.criterion.label': 'Naam',
  'format.rubric.criterion.weight': 'Gewicht',
  'format.rubric.criterion.levels': 'Wat elke score betekent',
  'format.rubric.level': ({ level }) => `Score ${n(level)}`,
  'format.rubric.criterion.moveUp': ({ number }) => `Criterium ${n(number)} naar boven`,
  'format.rubric.criterion.moveDown': ({ number }) => `Criterium ${n(number)} naar beneden`,
  'format.rubric.criterion.remove': ({ number }) => `Criterium ${n(number)} verwijderen`,
  'format.rubric.newCriterion': 'Nieuw criterium',
  'format.rubric.addCriterion': 'Criterium toevoegen',
  'format.rubric.noJuryStep':
    'Nog geen stap scoort erop: voeg een stap ‘Juryoordeel’ toe, meestal op het einde.',
  'format.rubric.remove': 'Raster verwijderen',
  'format.rubric.remove.question': 'Het beoordelingsraster verwijderen, met alle criteria?',
  'format.rubric.removeBlocked':
    'Een stap ‘Juryoordeel’ scoort op dit raster: verwijder eerst die stap om het raster te verwijderen.',

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

  'results.title': 'Resultaten',
  'results.intro':
    'Het verslag bevat elk debat met resultaten: één bestand dat in elke browser opent en op A4 afdrukt. Open het hier opnieuw om verder te gaan met de debatten. Het CSV-bestand is voor een rekenblad.',
  'results.none':
    'Nog geen resultaten. Een verslag dat je eerder maakte, kan je hier openen om verder te gaan met de debatten.',
  'results.finished': ({ number }) => `Debat ${n(number)} is afgewerkt.`,
  'results.downloadReport': 'Verslag downloaden (HTML)',
  'results.downloadCsv': 'CSV downloaden',
  'results.open': 'Verslag openen',
  'results.fileName': ({ date, extension }) => `debat-${date}.${extension}`,

  'report.title': 'Debatverslag',
  'report.summary': ({ count }) =>
    count === 1 ? '1 debat met resultaten' : `${n(count)} debatten met resultaten`,
  'report.saveNote':
    'Dit bestand is ook een bewaarbestand: om verder te gaan met deze debatten, of om ze te verbeteren, open je het in de app onder Debatten en teams, met Verslag openen.',
  'report.none': 'Nog geen enkel debat heeft resultaten.',
  'report.notFinished': 'Niet afgewerkt',
  'report.whoSpoke': 'Wie sprak er',
  'report.student': 'Leerling',
  'report.speeches': 'Spreekbeurten',
  'report.crossExaminations': 'Kruisverhoren',
  'report.freeRound': 'Vrije ronde',
  'report.turns': 'Beurten',
  'report.noNames': 'Geen namen',
  'report.time': 'Tijd per stap',
  'report.step': 'Stap',
  'report.planned': 'Gepland',
  'report.used': 'Gebruikt',
  'report.difference': 'Verschil',
  'report.overtime': ({ time }) => `+${time} overtijd`,
  'report.early': ({ time }) => `${time} vroeger gestopt`,
  'report.onTime': 'op tijd',
  'report.notUsed': 'niet gebruikt',
  'report.balance': ({ step }) => `${step}: verhouding tussen de teams`,
  'report.crossExam.who': ({ asking, answering }) => `${asking} ondervraagt ${answering}`,
  'report.answers': ({ step }) => `${step}: antwoorden per kant`,
  'report.answerCount': 'Antwoorden',
  'report.prep': 'Voorbereidingstijd',
  'report.prep.bank': ({ time }) => `Elk team had ${time}.`,
  'report.left': 'Over',
  'report.side': 'Kant',
  'report.timeUsed': 'Gebruikte tijd',
  'report.share': 'Aandeel',
  'report.teamTurns': 'Teambeurten',
  'report.vote': 'Stemming van het publiek',
  'report.notCounted': 'niet geteld',
  'report.shareFor': ({ side }) => `Aandeel ${side}`,
  'report.jury': 'Scores van de jury',
  'report.jury.scale': ({ min, max, total }) =>
    `Elk criterium krijgt een score van ${n(min)} tot ${n(max)}; het hoogste totaal is ${n(total)}.`,
  'report.jury.average': ({ count }) => `Gemiddelde van ${n(count)} juryleden`,
  'report.jury.none': 'Geen scores.',

  'csv.debate': 'Debat',
  'csv.topic': 'Stelling',
  'csv.side': 'Kant',
  'csv.student': 'Leerling',
  'csv.team': 'Teamleden',
  'csv.turns': 'Beurten',
  'csv.planned': ({ step }) => `${step} gepland (s)`,
  'csv.used': ({ step }) => `${step} gebruikt (s)`,
  'csv.left': ({ step }) => `${step} rest (s)`,
  'csv.overtime': ({ step }) => `${step} overtijd (s)`,
  'csv.teamTurns': ({ step }) => `${step} teambeurten`,
  'csv.role': ({ step }) => `${step} rol`,
  'csv.role.asked': 'vroeg',
  'csv.role.answered': 'antwoordde',
  'csv.answers': ({ step }) => `${step} antwoorden`,
  'csv.prep': 'Voorbereidingstijd',
  'csv.votesBefore': ({ side }) => `Stemmen ${side} vooraf`,
  'csv.votesAfter': ({ side }) => `Stemmen ${side} achteraf`,
  'csv.shiftVotes': ({ side }) => `Verschuiving ${side} (stemmen)`,
  'csv.shiftPoints': ({ side }) => `Verschuiving ${side} (pp)`,
  'csv.score': ({ step, criterion }) => `${step}: ${criterion}`,
  'csv.total': ({ step }) => `${step}: totaal`,
  'csv.jurors': ({ step }) => `${step}: juryleden`,
  'csv.jurorTotal': ({ step, number }) => `${step}: totaal jurylid ${n(number)}`,
  'csv.done': 'Afgerond',
  'csv.yes': 'ja',
  'csv.no': 'nee',

  'loadReport.eyebrow': '// Verslag',
  'loadReport.reading': 'Het verslag wordt gelezen…',
  'loadReport.title': 'Dit verslag laden?',
  'loadReport.fromFile': ({ name }) =>
    `Dit verslag komt uit het bestand ‘${name}’. Er verandert niets tot je kiest om het te laden.`,
  'loadReport.invalid.intro': 'Er zit geen verslag in dat deze app kan lezen.',
  'loadReport.debates': 'Debatten in het verslag',
  'loadReport.noDebates': 'Dit verslag heeft geen debatten.',
  'loadReport.replaces': ({ debates, results }) => {
    if (debates === 0) return 'Laden vervangt de opzet in deze browser.';
    const what =
      debates === 1
        ? `het debat in deze browser${results > 0 ? ', met zijn resultaten' : ''}`
        : `de ${n(debates)} debatten in deze browser${results === 0 ? '' : results === 1 ? ', waarvan één met resultaten' : `, waarvan ${n(results)} met resultaten`}`;
    const keep = results > 0 ? ' Download daar eerst een verslag van om ze te bewaren.' : '';
    return `Laden vervangt de opzet en ${what}.${keep}`;
  },
  'loadReport.load': 'Verslag laden',

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
  'preview.asks': ({ side }) => `${side} vraagt`,
  'preview.rubric': ({ count, min, max, perStudent }) =>
    `${count === 1 ? '1 criterium' : `${n(count)} criteria`}, ${n(min)} tot ${n(max)}, ${perStudent ? 'per leerling' : 'per team'}`,
  'preview.weight': ({ weight }) => `telt ${n(weight)}×`,
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

  'debate.back': 'Terug naar de opzet',
  'debate.sound': 'Geluid',
  'debate.sound.on': 'aan',
  'debate.sound.off': 'uit',
  'debate.steps': 'Stappen',
  'debate.stepName': ({ number, name, side }) =>
    `Stap ${n(number)}: ${name}${side === null ? '' : ` (${side})`}`,
  'debate.stepOf': ({ number, total }) => `Stap ${n(number)} van ${n(total)}`,
  'debate.who.both': 'Beide teams',
  'debate.who.audience': 'Het publiek',
  'debate.who.crossExam': ({ asking, answering }) => `${asking} vraagt, ${answering} antwoordt`,
  'debate.who.audienceQuestions': 'Het publiek en beide teams',
  'debate.who.jury': 'De jury',
  'debate.floor': ({ name }) => `${name} heeft het woord`,
  'debate.tapSpeaker': 'Tik op wie spreekt.',
  'debate.tapFreeRound': 'Tik op een naam: de klok van dat team loopt.',
  'debate.consult': 'Beide teams overleggen.',
  'debate.clock': 'Tijd',
  'debate.of': ({ time }) => `van ${time}`,
  'debate.paused': 'Gepauzeerd',
  'debate.overtime': 'Overtijd',
  'debate.timeUp': 'De tijd is om.',
  'debate.speakers': 'Sprak in deze beurt',
  'debate.removeSpeaker': ({ name }) => `${name} schrappen als spreker`,
  'debate.turns': ({ count }) => (count === 1 ? '1 beurt' : `${n(count)} beurten`),
  'debate.fewerTurns': ({ name }) => `Eén beurt minder voor ${name}`,
  'debate.crossExam.tap': 'Tik op wie vraagt en op wie antwoordt.',
  'debate.crossExam.asks': ({ who }) => `${who} vraagt`,
  'debate.crossExam.answers': ({ who }) => `${who} antwoordt`,
  'debate.crossExam.asked': 'Vroegen',
  'debate.crossExam.answered': 'Antwoordden',
  'debate.audience.prompt':
    'Het publiek stelt vragen aan beide teams. Tel eventueel de antwoorden per team.',
  'debate.answers': ({ count }) => (count === 1 ? '1 antwoord' : `${n(count)} antwoorden`),
  'debate.answers.more': ({ side }) => `Eén antwoord meer voor ${side}`,
  'debate.answers.fewer': ({ side }) => `Eén antwoord minder voor ${side}`,
  'debate.prep': 'Voorbereidingstijd',
  'debate.prep.team': ({ side }) => `Voorbereidingstijd ${side}`,
  'debate.prep.call': 'Tijd nemen',
  'debate.prep.stop': 'Tijd stoppen',
  'debate.prep.timeUp': ({ side }) => `De voorbereidingstijd van ${side} is op.`,
  'debate.vote.prompt': 'Wie is het eens met de stelling? Tel de handen.',
  'debate.vote.count': ({ side }) => `Stemmen ${side}`,
  'debate.vote.fewer': ({ side }) => `Eén stem minder voor ${side}`,
  'debate.vote.more': ({ side }) => `Eén stem meer voor ${side}`,
  'debate.vote.before': 'Vooraf',
  'debate.vote.after': 'Achteraf',
  'debate.shift': ({ points, side }) =>
    `Verschuiving naar ${side}: ${signed(points, 1)} ${isOne(points, 1) ? 'procentpunt' : 'procentpunten'}`,
  'debate.shift.votes': ({ count }) => `${signed(count)} ${isOne(count) ? 'stem' : 'stemmen'}`,
  'debate.shift.none': 'Nog geen verschuiving: elke stemming heeft minstens één hand nodig.',
  'debate.start': 'Starten',
  'debate.pause': 'Pauzeren',
  'debate.previous': 'Vorige stap',
  'debate.next': 'Volgende stap',
  'debate.finish': 'Debat afsluiten',
  'debate.keys': 'Spatie: start of pauze · ← →: vorige of volgende stap',
  'debate.clear': 'Stap wissen',
  'debate.clear.question': 'De tijd, de sprekers, de stemmen of de scores van deze stap wissen?',
  'debate.clear.confirm': 'Wissen',

  'jury.prompt.team':
    'Geef elk team een score op elk criterium. De juryleden wisselen elkaar af op dit toestel: voeg er een toe voor elk.',
  'jury.prompt.student':
    'Geef elke leerling een score op elk criterium. De juryleden wisselen elkaar af op dit toestel: voeg er een toe voor elk.',
  'jury.jurors': 'Juryleden',
  'jury.juror': ({ number }) => `Jurylid ${n(number)}`,
  'jury.add': 'Jurylid toevoegen',
  'jury.name': 'Naam van dit jurylid (mag leeg)',
  'jury.remove': ({ juror }) => `${juror} verwijderen`,
  'jury.remove.question': ({ juror }) =>
    `${juror} verwijderen, met alle scores die gegeven werden?`,
  'jury.remove.confirm': 'Jurylid verwijderen',
  'jury.sheet': ({ juror }) => `Scoreblad van ${juror}`,
  'jury.student': ({ name, side }) => `${name} (${side})`,
  'jury.weight': ({ weight }) => `telt ${n(weight)}×`,
  'jury.clearScore': ({ criterion, who }) => `Score van ${who} voor ${criterion} wissen`,
  'jury.total': 'Totaal',
  'jury.notScored': 'Nog geen score.',
  'jury.overview': 'Totalen van alle juryleden',
  'jury.average': 'Gemiddelde',
  'jury.noRubric': 'Deze debatvorm heeft geen beoordelingsraster om op te scoren.',

  ...stepTypes,
  ...issues,
};
