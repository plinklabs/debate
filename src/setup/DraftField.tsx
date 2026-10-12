import { useState, type ReactNode } from 'react';
import { Field, TextArea, TextInput, describedBy } from '../components/ui/Field';
import { useI18n } from '../i18n';
import type { ConfigIssue } from '../model/validate';
import { NO_ISSUES, oneLine } from './configEditor';

interface Draft {
  readonly raw: string;
  readonly issues: readonly ConfigIssue[];
  /** The setup's value when the draft was typed. */
  readonly base: string;
}

interface Props {
  readonly id: string;
  readonly label: string;
  readonly hideLabel?: boolean;
  /** The value in the setup now. */
  readonly value: string;
  /** Keep the setup with `raw` in this field; what is wrong with it otherwise (see `ConfigEditor`). */
  readonly apply: (raw: string) => readonly ConfigIssue[];
  /** `textarea` wraps a long text, but takes no line breaks: Enter does nothing. */
  readonly kind?: 'text' | 'number' | 'textarea';
  /** Shown below while the value is valid. */
  readonly hint?: ReactNode;
  readonly placeholder?: string;
  readonly maxLength?: number;
  readonly min?: number;
  readonly max?: number;
  readonly className?: string;
}

/**
 * A field of the setup. Every change that makes a valid setup is kept at
 * once. One that does not (an empty topic, a step of 0 seconds) stays in the
 * field as typed, with what is wrong below it, while the setup keeps its last
 * valid value; the next valid change replaces both, and so does a change to
 * the setup from elsewhere (a preset, an imported setup).
 */
export function DraftField({
  id,
  label,
  hideLabel,
  value,
  apply,
  kind = 'text',
  hint,
  placeholder,
  maxLength,
  min,
  max,
  className,
}: Props) {
  const { describeIssue } = useI18n();
  const [typed, setDraft] = useState<Draft | null>(null);
  const draft = typed !== null && typed.base === value ? typed : null;

  const issues = draft?.issues ?? NO_ISSUES;
  const invalid = issues.length > 0;
  const errors = [...new Set(issues.map(describeIssue))];
  const shownHint = invalid ? undefined : hint;

  const change = (input: string) => {
    const raw = kind === 'textarea' ? oneLine(input) : input;
    const found = apply(raw);
    setDraft(found.length > 0 ? { raw, issues: found, base: value } : null);
  };

  const common = {
    id,
    value: draft?.raw ?? value,
    invalid,
    placeholder,
    'aria-describedby': describedBy(id, { hint: shownHint !== undefined, errors: invalid }),
  };

  return (
    <Field
      id={id}
      label={label}
      hideLabel={hideLabel}
      hint={shownHint}
      errors={errors}
      className={className}
    >
      {kind === 'textarea' ? (
        <TextArea
          {...common}
          rows={2}
          maxLength={maxLength}
          onChange={(event) => change(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.preventDefault();
          }}
        />
      ) : (
        <TextInput
          {...common}
          type={kind}
          inputMode={kind === 'number' ? 'numeric' : undefined}
          step={kind === 'number' ? 1 : undefined}
          min={min}
          max={max}
          maxLength={maxLength}
          autoComplete="off"
          onChange={(event) => change(event.target.value)}
        />
      )}
    </Field>
  );
}
