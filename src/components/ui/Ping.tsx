import styles from './Ping.module.css';

interface Props {
  /** Width and height in px. */
  readonly size?: number;
  /** `pulse`: rings radiate (something is live); `static`: one still ring. */
  readonly mode?: 'pulse' | 'static';
  /** On the full-bleed ink section: the lighter magenta. */
  readonly onInk?: boolean;
  readonly className?: string;
}

/**
 * The Plink Labs ping: concentric magenta rings around a filled core, after
 * the design system's `Ping`. Decoration only, so hidden from screen readers;
 * the rings stand still with `prefers-reduced-motion`.
 */
export function Ping({ size = 28, mode = 'pulse', onInk = false, className }: Props) {
  const core = Math.max(4, Math.round(size * 0.26));
  const classes = [styles.ping, styles[mode], onInk && styles.onInk, className]
    .filter(Boolean)
    .join(' ');
  return (
    <span aria-hidden="true" className={classes} style={{ width: size, height: size }}>
      {mode === 'static' ? (
        <span className={`${styles.ring} ${styles.still}`} />
      ) : (
        <>
          <span className={styles.ring} />
          <span className={`${styles.ring} ${styles.late}`} />
        </>
      )}
      <span className={styles.core} style={{ width: core, height: core }} />
    </span>
  );
}
