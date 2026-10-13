import { useSyncExternalStore } from 'react';
import { Button } from '../components/ui/Button';
import { useI18n } from '../i18n';
import { appUpdates, type Updates } from './updates';
import styles from './UpdateNotice.module.css';

interface Props {
  /** The app's own updates; a test passes its own. */
  readonly updates?: Updates;
}

/**
 * A slim bar under the header once a new version of the app is ready (#9),
 * with a button to reload into it. It never reloads by itself: during a
 * debate it may show, but the clocks run on until the teacher clicks. The
 * debate is kept through the reload, its clocks paused.
 */
export function UpdateNotice({ updates = appUpdates }: Props) {
  const { t } = useI18n();
  const ready = useSyncExternalStore(updates.subscribe, updates.ready);
  if (!ready) return null;
  return (
    <div role="status" className={styles.notice}>
      <div className={styles.bar}>
        <p className={styles.text}>{t('update.ready')}</p>
        <Button variant="outline" onClick={updates.apply}>
          {t('update.reload')}
        </Button>
      </div>
    </div>
  );
}
