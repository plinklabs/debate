// The time-up sound and whether it is muted. The sound is made on the spot
// with the Web Audio API, so the app ships no audio files. Muting is a
// preference of this browser, kept under its own key: it is not part of the
// setup that is shared, nor of the debate state (src/model/storage.ts).

export const SOUND_STORAGE_KEY = 'plinklabs:debate:sound';

/** The part of the Web Storage API this needs; `window.localStorage` fits. */
export interface PreferenceStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/**
 * Whether the user muted the sound here earlier. `store` is a function
 * because merely reading `window.localStorage` throws when storage is blocked.
 */
export function readMuted(store: () => PreferenceStore): boolean {
  try {
    return store().getItem(SOUND_STORAGE_KEY) === 'off';
  } catch {
    return false;
  }
}

/** Remember the choice. `false` when storage is blocked: it then lasts until a reload. */
export function storeMuted(store: () => PreferenceStore, muted: boolean): boolean {
  try {
    store().setItem(SOUND_STORAGE_KEY, muted ? 'off' : 'on');
    return true;
  } catch {
    return false;
  }
}

/** The beeps of the signal: start and length in seconds, and pitch in Hz. */
export const TIME_UP_BEEPS = [
  { at: 0, length: 0.26, frequency: 880 },
  { at: 0.32, length: 0.26, frequency: 880 },
] as const;

/** The part of an `AudioContext` the sound needs. */
export type SoundContext = Pick<
  BaseAudioContext,
  'currentTime' | 'destination' | 'createOscillator' | 'createGain'
>;

/** Play the time-up signal, a short double beep, on `context`. */
export function playTimeUp(context: SoundContext): void {
  const start = context.currentTime;
  for (const beep of TIME_UP_BEEPS) {
    const from = start + beep.at;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = beep.frequency;
    // A quick rise and a fall, so the beep does not click.
    gain.gain.setValueAtTime(0.0001, from);
    gain.gain.exponentialRampToValueAtTime(0.5, from + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, from + beep.length);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(from);
    oscillator.stop(from + beep.length + 0.02);
  }
}
