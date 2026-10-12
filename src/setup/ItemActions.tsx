import { Button } from '../components/ui/Button';
import { useI18n } from '../i18n';
import styles from './setup.module.css';

/** The ids of an item's buttons, to put the focus back on one after a change. */
export function actionIds(base: string) {
  return { up: `${base}-up`, down: `${base}-down`, remove: `${base}-remove` };
}

interface Props {
  /** Base of the button ids (see `actionIds`). */
  readonly base: string;
  readonly labels: { readonly up: string; readonly down: string; readonly remove: string };
  readonly canMoveUp: boolean;
  readonly canMoveDown: boolean;
  readonly canRemove: boolean;
  readonly onMove: (offset: -1 | 1) => void;
  readonly onRemove: () => void;
}

/**
 * Up, down and remove for an item in a list. A button that cannot act is
 * `aria-disabled` rather than `disabled`, so it keeps the focus when an item
 * reaches the end of the list.
 */
export function ItemActions({
  base,
  labels,
  canMoveUp,
  canMoveDown,
  canRemove,
  onMove,
  onRemove,
}: Props) {
  const { t } = useI18n();
  const ids = actionIds(base);
  return (
    <div className={styles.itemActions}>
      <Button
        id={ids.up}
        className={styles.moveButton}
        aria-label={labels.up}
        aria-disabled={!canMoveUp}
        onClick={() => canMoveUp && onMove(-1)}
      >
        ↑
      </Button>
      <Button
        id={ids.down}
        className={styles.moveButton}
        aria-label={labels.down}
        aria-disabled={!canMoveDown}
        onClick={() => canMoveDown && onMove(1)}
      >
        ↓
      </Button>
      <Button
        id={ids.remove}
        variant="ghost"
        aria-label={labels.remove}
        aria-disabled={!canRemove}
        onClick={() => canRemove && onRemove()}
      >
        {t('action.remove')}
      </Button>
    </div>
  );
}
