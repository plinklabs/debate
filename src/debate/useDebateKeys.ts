import { useEffect, useRef } from 'react';

export type DebateCommand = 'toggle' | 'next' | 'previous';

/** The keys of the debate screen; PageUp and PageDown are what a presenter remote sends. */
export const DEBATE_KEYS: Readonly<Record<string, DebateCommand>> = {
  ' ': 'toggle',
  ArrowRight: 'next',
  PageDown: 'next',
  ArrowLeft: 'previous',
  PageUp: 'previous',
};

/** A key press that goes to a field the user types in: a vote count, say. */
export function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || target.matches('input, textarea, select'))
  );
}

function ignored(event: KeyboardEvent): boolean {
  return (
    event.defaultPrevented ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    event.shiftKey ||
    isTyping(event.target)
  );
}

/**
 * Space starts or pauses, → and PageDown go to the next step, ← and PageUp to
 * the previous one, wherever the focus is, except while typing. Space is
 * taken from a focused button too, so one press is one start or pause; a
 * button still works with Enter. Holding a key down does not repeat it.
 */
export function useDebateKeys(commands: Readonly<Record<DebateCommand, () => void>>): void {
  const latest = useRef(commands);

  useEffect(() => {
    latest.current = commands;
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!Object.hasOwn(DEBATE_KEYS, event.key) || ignored(event)) return;
      event.preventDefault();
      if (!event.repeat) latest.current[DEBATE_KEYS[event.key]]();
    };
    // A button is pressed with Space when the key comes up.
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === ' ' && !ignored(event)) event.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);
}
