import { useCallback, useEffect, useRef, useState } from 'react';
import { playTimeUp, readMuted, storeMuted } from './sound';

const browserStorage = () => window.localStorage;

export interface Sound {
  readonly muted: boolean;
  readonly setMuted: (muted: boolean) => void;
  /** The time-up signal, unless muted. */
  readonly timeUp: () => void;
}

/**
 * The time-up sound of the debate screen. A browser lets an `AudioContext`
 * play only after the user did something on the page, so it is made (or woken
 * up) on every key and pointer press while the screen is open. Without the
 * Web Audio API there is no sound, and the visual signal remains.
 */
export function useSound(): Sound {
  const [muted, setMutedState] = useState(() => readMuted(browserStorage));
  const context = useRef<AudioContext | null>(null);

  const unlock = useCallback(() => {
    try {
      if (context.current === null || context.current.state === 'closed') {
        if (typeof AudioContext === 'undefined') return;
        context.current = new AudioContext();
      }
      if (context.current.state === 'suspended') void context.current.resume();
    } catch {
      // No sound here; the signal on screen remains.
    }
  }, []);

  const play = useCallback(() => {
    if (context.current === null || context.current.state === 'closed') return;
    try {
      playTimeUp(context.current);
    } catch {
      // Sound is a courtesy.
    }
  }, []);

  useEffect(() => {
    window.addEventListener('pointerdown', unlock, true);
    window.addEventListener('keydown', unlock, true);
    return () => {
      window.removeEventListener('pointerdown', unlock, true);
      window.removeEventListener('keydown', unlock, true);
      const closing = context.current;
      context.current = null;
      void closing?.close().catch(() => {});
    };
  }, [unlock]);

  const setMuted = useCallback(
    (next: boolean) => {
      setMutedState(next);
      storeMuted(browserStorage, next);
      // Turning the sound on plays it once, so the teacher hears how loud it is.
      if (!next) {
        unlock();
        play();
      }
    },
    [unlock, play],
  );

  const timeUp = useCallback(() => {
    if (!muted) play();
  }, [muted, play]);

  return { muted, setMuted, timeUp };
}
