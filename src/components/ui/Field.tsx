import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import a11y from './a11y.module.css';
import styles from './Field.module.css';

function classes(...names: (string | false | undefined)[]): string {
  return names.filter(Boolean).join(' ');
}

/** The ids a field's hint and errors get, for the control's `aria-describedby`. */
export function fieldIds(id: string) {
  return { hint: `${id}-hint`, errors: `${id}-errors` };
}

/** `aria-describedby` for a control with this id: its hint and its errors, when it has them. */
export function describedBy(
  id: string,
  { hint = false, errors = false }: { readonly hint?: boolean; readonly errors?: boolean },
): string | undefined {
  const ids = fieldIds(id);
  const list = [hint && ids.hint, errors && ids.errors].filter(Boolean);
  return list.length > 0 ? list.join(' ') : undefined;
}

interface FieldProps {
  /** The id of the control inside. */
  readonly id: string;
  readonly label: ReactNode;
  /** Read out, but not shown: the context says what the field is. */
  readonly hideLabel?: boolean;
  readonly hint?: ReactNode;
  /** What is wrong with the value, one sentence each. */
  readonly errors?: readonly string[];
  readonly className?: string;
  readonly children: ReactNode;
}

/**
 * A control with its mono label above it, an optional hint below, and what is
 * wrong with its value. The errors sit in a live region, so a screen reader
 * says them as they appear.
 */
export function Field({
  id,
  label,
  hideLabel = false,
  hint,
  errors = [],
  className,
  children,
}: FieldProps) {
  const ids = fieldIds(id);
  return (
    <div className={classes(styles.field, className)}>
      <label htmlFor={id} className={hideLabel ? a11y.visuallyHidden : styles.label}>
        {label}
      </label>
      {children}
      {hint !== undefined && (
        <p id={ids.hint} className={styles.hint}>
          {hint}
        </p>
      )}
      <div id={ids.errors} className={styles.errors} aria-live="polite">
        {errors.map((error) => (
          <p key={error} className={styles.error}>
            {error}
          </p>
        ))}
      </div>
    </div>
  );
}

interface ControlProps {
  readonly invalid?: boolean;
}

export function TextInput({
  invalid = false,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & ControlProps) {
  return (
    <input
      className={classes(styles.control, invalid && styles.invalid, className)}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
}

export function TextArea({
  invalid = false,
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & ControlProps) {
  return (
    <textarea
      className={classes(styles.control, styles.textarea, invalid && styles.invalid, className)}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
}

export function Select({
  invalid = false,
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & ControlProps) {
  return (
    <select
      className={classes(styles.control, styles.select, invalid && styles.invalid, className)}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
}
