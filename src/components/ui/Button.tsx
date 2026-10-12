import type { ComponentPropsWithRef } from 'react';
import styles from './Button.module.css';

/**
 * `primary` is the one magenta action of a screen; `secondary` is solid ink;
 * `outline` a hairline button; `ghost` a quiet mono action. After the Plink
 * Labs Button, with the 16px floor for the projector.
 */
export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost';

interface Props extends ComponentPropsWithRef<'button'> {
  readonly variant?: ButtonVariant;
}

export function Button({ variant = 'outline', className, type = 'button', ...props }: Props) {
  const classes = [styles.button, styles[variant], className].filter(Boolean).join(' ');
  return <button type={type} className={classes} {...props} />;
}
