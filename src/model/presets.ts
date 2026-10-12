// Built-in formats a teacher can start from. A preset is built for one UI
// language: its side and step labels exist in every locale, while ids, types,
// durations and topics are the same in each, so a session made with one
// language keeps working after a switch to the other.

import { CONFIG_VERSION, type DebateConfig, type Topic } from './config';
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

export const PRESETS: readonly Preset[] = [GRAFFITI_PRESET];

export const DEFAULT_PRESET: Preset = GRAFFITI_PRESET;

export function findPreset(id: string): Preset | undefined {
  return PRESETS.find((preset) => preset.id === id);
}

/** The config a new session starts with. */
export function defaultConfig(locale: Locale): DebateConfig {
  return DEFAULT_PRESET.build(locale);
}
