import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useI18n } from '../../i18n';
import { Button, type ButtonVariant } from './Button';
import styles from './InlineConfirm.module.css';

interface Props {
  /** The text on the button. */
  readonly trigger: string;
  /** The button's name when its text needs context ("Remove debate 2"). */
  readonly triggerLabel?: string;
  readonly variant?: ButtonVariant;
  /** What will happen, asked in place of the button. */
  readonly question: string;
  /** The text on the button that goes ahead. */
  readonly confirm: string;
  readonly onConfirm: () => void;
}

/**
 * A button that asks before it acts: the question replaces it, with a button
 * to go ahead and one to cancel. Cancel gets the focus, so a second press of
 * Enter does not go ahead by accident; Escape cancels too.
 */
export function InlineConfirm({
  trigger,
  triggerLabel,
  variant = 'outline',
  question,
  confirm,
  onConfirm,
}: Props) {
  const { t } = useI18n();
  const [asking, setAsking] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const asked = useRef(false);

  useEffect(() => {
    if (asking) cancelRef.current?.focus();
    else if (asked.current) triggerRef.current?.focus();
    asked.current = asking;
  }, [asking]);

  if (!asking) {
    return (
      <Button
        ref={triggerRef}
        variant={variant}
        aria-label={triggerLabel}
        onClick={() => setAsking(true)}
      >
        {trigger}
      </Button>
    );
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    setAsking(false);
  };

  return (
    <div
      role="group"
      aria-label={triggerLabel ?? trigger}
      className={styles.confirm}
      onKeyDown={onKeyDown}
    >
      <p className={styles.question}>{question}</p>
      <div className={styles.actions}>
        <Button
          variant="secondary"
          onClick={() => {
            setAsking(false);
            onConfirm();
          }}
        >
          {confirm}
        </Button>
        <Button ref={cancelRef} variant="outline" onClick={() => setAsking(false)}>
          {t('action.cancel')}
        </Button>
      </div>
    </div>
  );
}
