// Stand-ins for browser APIs that jsdom does not have: the Web Audio API and
// the Screen Wake Lock API. Each records what the app did with it.
import { vi } from 'vitest';

/**
 * An `AudioContext` that counts the tones started on it, over every context
 * made. Installed as the global `AudioContext`; `vi.unstubAllGlobals()` takes
 * it away.
 */
export function fakeAudio() {
  const tones: number[] = [];

  class FakeAudioContext {
    state: AudioContextState = 'running';
    currentTime = 0;
    readonly destination = {};

    createOscillator() {
      return {
        type: 'sine',
        frequency: { value: 0 },
        connect: <T>(node: T) => node,
        start: () => tones.push(this.currentTime),
        stop: () => {},
      };
    }

    createGain() {
      return {
        gain: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
        connect: <T>(node: T) => node,
      };
    }

    resume() {
      this.state = 'running';
      return Promise.resolve();
    }

    close() {
      this.state = 'closed';
      return Promise.resolve();
    }
  }

  vi.stubGlobal('AudioContext', FakeAudioContext);
  return { tones: () => tones.length };
}

/**
 * A `navigator.wakeLock` that grants every request and counts the locks
 * held. `hide()` lets go of them as a browser does when the page is hidden.
 */
export function fakeWakeLock({ refuse = false }: { refuse?: boolean } = {}) {
  const sentinels: { released: boolean }[] = [];
  const request = vi.fn((type: string) => {
    if (refuse) return Promise.reject(new DOMException('Not now', 'NotAllowedError'));
    const sentinel = {
      type,
      released: false,
      release: () => {
        sentinel.released = true;
        return Promise.resolve();
      },
    };
    sentinels.push(sentinel);
    return Promise.resolve(sentinel);
  });
  Object.defineProperty(navigator, 'wakeLock', { value: { request }, configurable: true });
  return {
    request,
    held: () => sentinels.filter((sentinel) => !sentinel.released).length,
    hide: () => {
      for (const sentinel of sentinels) sentinel.released = true;
    },
    remove: () => Reflect.deleteProperty(navigator, 'wakeLock'),
  };
}
