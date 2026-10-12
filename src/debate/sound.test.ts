import { describe, expect, it } from 'vitest';
import { STORAGE_KEY } from '../model/storage';
import {
  SOUND_STORAGE_KEY,
  TIME_UP_BEEPS,
  playTimeUp,
  readMuted,
  storeMuted,
  type PreferenceStore,
  type SoundContext,
} from './sound';

function memoryStore(): PreferenceStore & { readonly items: Map<string, string> } {
  const items = new Map<string, string>();
  return {
    items,
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => {
      items.set(key, value);
    },
  };
}

const blocked = (): PreferenceStore => {
  throw new DOMException('Blocked', 'SecurityError');
};

describe('the mute preference', () => {
  it('is off until muted, and kept under its own key', () => {
    const store = memoryStore();
    expect(readMuted(() => store)).toBe(false);
    expect(storeMuted(() => store, true)).toBe(true);
    expect(readMuted(() => store)).toBe(true);
    expect(storeMuted(() => store, false)).toBe(true);
    expect(readMuted(() => store)).toBe(false);
    expect([...store.items.keys()]).toEqual([SOUND_STORAGE_KEY]);
    expect(SOUND_STORAGE_KEY).not.toBe(STORAGE_KEY);
  });

  it('falls back to sound on when storage is blocked', () => {
    expect(readMuted(blocked)).toBe(false);
    expect(storeMuted(blocked, true)).toBe(false);
  });
});

describe('playTimeUp', () => {
  it('schedules short beeps from now, made with oscillators rather than a sound file', () => {
    const started: { at: number; stop: number; frequency: number }[] = [];
    const context: SoundContext = {
      currentTime: 12,
      destination: {} as AudioDestinationNode,
      createOscillator: () => {
        const tone = { at: NaN, stop: NaN, frequency: 0 };
        const oscillator = {
          type: 'square',
          frequency: {
            set value(hz: number) {
              tone.frequency = hz;
            },
          },
          connect: <T>(node: T) => node,
          start: (at: number) => {
            tone.at = at;
            started.push(tone);
          },
          stop: (at: number) => {
            tone.stop = at;
          },
        };
        return oscillator as unknown as OscillatorNode;
      },
      createGain: () =>
        ({
          gain: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
          connect: <T>(node: T) => node,
        }) as unknown as GainNode,
    };

    playTimeUp(context);

    expect(started).toHaveLength(TIME_UP_BEEPS.length);
    expect(started.map((tone) => tone.at)).toEqual(TIME_UP_BEEPS.map((beep) => 12 + beep.at));
    for (const tone of started) {
      expect(tone.frequency).toBe(880);
      expect(tone.stop - tone.at).toBeLessThan(0.5);
    }
  });
});
