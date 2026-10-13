import type { InputHTMLAttributes, ReactNode } from 'react';
import styles from './Checkbox.module.css';

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  readonly label: ReactNode;
}

/**
 * A checkbox with its label beside it: a crisp hairline box that fills with
 * ink and shows a magenta check, after the design system's `Checkbox`, at the
 * 16px floor. The native input stays, for the keyboard and screen readers.
 */
export function Checkbox({ label, className, ...props }: Props) {
  return (
    <label className={[styles.check, className].filter(Boolean).join(' ')}>
      <input type="checkbox" className={styles.input} {...props} />
      <span className={styles.box} aria-hidden="true">
        <svg viewBox="0 0 12 12" fill="none">
          <path
            d="M2 6.2 L4.6 9 L10 3"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span>{label}</span>
    </label>
  );
}
