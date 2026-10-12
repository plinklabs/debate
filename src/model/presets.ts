// Built-in formats a teacher can start from. A preset is built for one UI
// language: its side and step labels exist in every locale, while ids, types,
// durations and topics are the same in each, so a session made with one
// language keeps working after a switch to the other. Presets are starting
// points: every duration stays editable.

import { CONFIG_VERSION, type DebateConfig, type Side, type Topic } from './config';
import type { Locale, Localized } from './locale';

export interface Preset {
  readonly id: string;
  readonly name: Localized;
  build(locale: Locale): DebateConfig;
}

// ---------------------------------------------------------------------------
// Graffiti: the debate of chapter 17 of Cursus Esthetica, where this app
// started (yvanvds/cursus-esthetica, debat-logic.ts).
// ---------------------------------------------------------------------------

/** Verbatim from the assignment sheet (Debat_graffiti.docx). Dutch content, in every locale. */
const GRAFFITI_TOPICS: readonly Topic[] = [
  {
    id: 't1',
    text: 'Graffiti verliest haar betekenis zodra ze wordt toegestaan of gesubsidieerd.',
  },
  {
    id: 't2',
    text: 'Wie zonder toestemming een muur beschildert, eist terecht de publieke ruimte op.',
  },
  { id: 't3', text: 'Bedrijven die graffiti-esthetiek gebruiken, hollen haar betekenis uit.' },
  { id: 't4', text: 'Een tag is evengoed kunst als een grote muurschildering.' },
  { id: 't5', text: 'Een graffitiwerk hoort toe aan de maker, niet aan de eigenaar van de muur.' },
];

const GRAFFITI_LABELS = {
  pro: { en: 'FOR', nl: 'VOOR' },
  con: { en: 'AGAINST', nl: 'TEGEN' },
  voteBefore: { en: 'Vote before', nl: 'Stemming vooraf' },
  opening: { en: 'Opening', nl: 'Opening' },
  consultation: { en: 'Short consultation', nl: 'Kort overleg' },
  rebuttal: { en: 'Rebuttal', nl: 'Weerlegging' },
  freeRound: { en: 'Free round', nl: 'Vrije ronde' },
  closing: { en: 'Closing statement', nl: 'Slotwoord' },
  voteAfter: { en: 'Vote after', nl: 'Stemming achteraf' },
} as const satisfies Record<string, Localized>;

export const GRAFFITI_PRESET: Preset = {
  id: 'graffiti',
  name: { en: 'Graffiti debate', nl: 'Graffitidebat' },
  build(locale) {
    const t = (key: keyof typeof GRAFFITI_LABELS) => GRAFFITI_LABELS[key][locale];
    return {
      version: CONFIG_VERSION,
      format: {
        sides: { pro: t('pro'), con: t('con') },
        teamSize: { min: 2, max: 3 },
        // As on the assignment sheet: the closing statements run against before for.
        steps: [
          { id: 'vote-before', type: 'vote-before', label: t('voteBefore') },
          { id: 'opening-pro', type: 'speech', side: 'pro', seconds: 60, label: t('opening') },
          { id: 'opening-con', type: 'speech', side: 'con', seconds: 60, label: t('opening') },
          { id: 'consultation', type: 'consultation', seconds: 60, label: t('consultation') },
          { id: 'rebuttal-pro', type: 'speech', side: 'pro', seconds: 90, label: t('rebuttal') },
          { id: 'rebuttal-con', type: 'speech', side: 'con', seconds: 90, label: t('rebuttal') },
          { id: 'free-round', type: 'free-round', seconds: 90, label: t('freeRound') },
          { id: 'closing-con', type: 'speech', side: 'con', seconds: 30, label: t('closing') },
          { id: 'closing-pro', type: 'speech', side: 'pro', seconds: 30, label: t('closing') },
          { id: 'vote-after', type: 'vote-after', label: t('voteAfter') },
        ],
      },
      topics: GRAFFITI_TOPICS.map((topic) => ({ ...topic })),
    };
  },
};

// ---------------------------------------------------------------------------
// Karl Popper: the classic school format, three against three, with
// cross-examinations and a prep-time bank (#8). Speeches, order and times as
// in "The Karl Popper Debate Format", a sheet on Debate Central of the
// University of Vermont: https://www.uvm.edu/~debate/dcpdf/KPDRules_Mead.com.pdf
//
//   constructive A1 6 · cross-examination by N3 3 · constructive N1 6 ·
//   cross-examination by A3 3 · rebuttal A2 5 · cross-examination by N1 3 ·
//   rebuttal N2 5 · cross-examination by A1 3 · rebuttal and closing A3 5 ·
//   rebuttal and closing N3 5 (minutes); 4 minutes of prep time per team.
//
// Other rule sets give each team 8 or 10 minutes of prep time; this preset
// follows the sheet. A panel of judges decides, so there is no audience vote.
// ---------------------------------------------------------------------------

/** Statements for a first Karl Popper debate. Dutch content, in every locale, like the graffiti topics. */
const KARL_POPPER_TOPICS: readonly Topic[] = [
  { id: 't1', text: 'Dierproeven voor cosmetica moeten verboden worden.' },
  { id: 't2', text: 'Smartphones horen niet thuis in de klas.' },
  { id: 't3', text: 'Huiswerk moet worden afgeschaft.' },
];

const KARL_POPPER_LABELS = {
  pro: { en: 'AFFIRMATIVE', nl: 'BEVESTIGEND' },
  con: { en: 'NEGATIVE', nl: 'ONTKENNEND' },
  constructive: { en: 'Constructive', nl: 'Openingsbetoog' },
  crossExamination: { en: 'Cross-examination', nl: 'Kruisverhoor' },
  rebuttal: { en: 'Rebuttal', nl: 'Weerlegging' },
  closing: { en: 'Rebuttal and closing', nl: 'Weerlegging en slotwoord' },
} as const satisfies Record<string, Localized>;

export const KARL_POPPER_PRESET: Preset = {
  id: 'karl-popper',
  name: { en: 'Karl Popper debate', nl: 'Karl Popperdebat' },
  build(locale) {
    const t = (key: keyof typeof KARL_POPPER_LABELS) => KARL_POPPER_LABELS[key][locale];
    const cx = (id: string, askingSide: Side) =>
      ({
        id,
        type: 'cross-examination',
        askingSide,
        seconds: 180,
        label: t('crossExamination'),
      }) as const;
    return {
      version: CONFIG_VERSION,
      format: {
        sides: { pro: t('pro'), con: t('con') },
        teamSize: { min: 3, max: 3 },
        prepTime: { secondsPerTeam: 240 },
        steps: [
          {
            id: 'constructive-pro',
            type: 'speech',
            side: 'pro',
            seconds: 360,
            label: t('constructive'),
          },
          cx('cross-examination-con-1', 'con'),
          {
            id: 'constructive-con',
            type: 'speech',
            side: 'con',
            seconds: 360,
            label: t('constructive'),
          },
          cx('cross-examination-pro-1', 'pro'),
          { id: 'rebuttal-pro', type: 'speech', side: 'pro', seconds: 300, label: t('rebuttal') },
          cx('cross-examination-con-2', 'con'),
          { id: 'rebuttal-con', type: 'speech', side: 'con', seconds: 300, label: t('rebuttal') },
          cx('cross-examination-pro-2', 'pro'),
          { id: 'closing-pro', type: 'speech', side: 'pro', seconds: 300, label: t('closing') },
          { id: 'closing-con', type: 'speech', side: 'con', seconds: 300, label: t('closing') },
        ],
      },
      topics: KARL_POPPER_TOPICS.map((topic) => ({ ...topic })),
    };
  },
};

// ---------------------------------------------------------------------------
// Public debate: the Oxford style of Intelligence Squared U.S. (now Open to
// Debate), where the audience votes before and after and the side that moved
// more of the audience wins (#8). Times as Open to Debate describes the
// format, https://opentodebate.org/wp-content/uploads/2022/03/intelligence-squared-u-s-discusses-important-world-issues.pdf:
// a vote, a 7-minute opening statement, questions from the audience, a
// 2-minute closing statement, and the vote again, with two debaters a side
// (https://en.wikipedia.org/wiki/Intelligence_Squared). There each debater
// gives an opening and a closing; for a class, each side gives one opening
// and one closing of those lengths, and its two debaters share them. The
// sources set no length for the audience questions: here they get 10 minutes.
// ---------------------------------------------------------------------------

/** Statements for a public debate. Dutch content, in every locale, like the graffiti topics. */
const PUBLIC_DEBATE_TOPICS: readonly Topic[] = [
  { id: 't1', text: 'Sociale media doen meer kwaad dan goed.' },
  { id: 't2', text: 'Kunstmatige intelligentie hoort thuis op school.' },
  { id: 't3', text: 'Onze stad moet autovrij worden.' },
];

const PUBLIC_DEBATE_LABELS = {
  pro: { en: 'FOR', nl: 'VOOR' },
  con: { en: 'AGAINST', nl: 'TEGEN' },
  voteBefore: { en: 'Vote before', nl: 'Stemming vooraf' },
  opening: { en: 'Opening statement', nl: 'Openingsbetoog' },
  questions: { en: 'Questions from the audience', nl: 'Vragen uit het publiek' },
  closing: { en: 'Closing statement', nl: 'Slotwoord' },
  voteAfter: { en: 'Vote after', nl: 'Stemming achteraf' },
} as const satisfies Record<string, Localized>;

export const PUBLIC_DEBATE_PRESET: Preset = {
  id: 'public-debate',
  name: { en: 'Public debate', nl: 'Publiek debat' },
  build(locale) {
    const t = (key: keyof typeof PUBLIC_DEBATE_LABELS) => PUBLIC_DEBATE_LABELS[key][locale];
    return {
      version: CONFIG_VERSION,
      format: {
        sides: { pro: t('pro'), con: t('con') },
        teamSize: { min: 2, max: 2 },
        steps: [
          { id: 'vote-before', type: 'vote-before', label: t('voteBefore') },
          { id: 'opening-pro', type: 'speech', side: 'pro', seconds: 420, label: t('opening') },
          { id: 'opening-con', type: 'speech', side: 'con', seconds: 420, label: t('opening') },
          {
            id: 'audience-questions',
            type: 'audience-questions',
            seconds: 600,
            label: t('questions'),
          },
          { id: 'closing-pro', type: 'speech', side: 'pro', seconds: 120, label: t('closing') },
          { id: 'closing-con', type: 'speech', side: 'con', seconds: 120, label: t('closing') },
          { id: 'vote-after', type: 'vote-after', label: t('voteAfter') },
        ],
      },
      topics: PUBLIC_DEBATE_TOPICS.map((topic) => ({ ...topic })),
    };
  },
};

export const PRESETS: readonly Preset[] = [
  GRAFFITI_PRESET,
  KARL_POPPER_PRESET,
  PUBLIC_DEBATE_PRESET,
];

export const DEFAULT_PRESET: Preset = GRAFFITI_PRESET;

export function findPreset(id: string): Preset | undefined {
  return PRESETS.find((preset) => preset.id === id);
}

/** The config a new session starts with. */
export function defaultConfig(locale: Locale): DebateConfig {
  return DEFAULT_PRESET.build(locale);
}
