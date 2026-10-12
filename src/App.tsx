import styles from './App.module.css';
import { AppHeader } from './components/AppHeader';
import { useI18n } from './i18n';

// Placeholder until the debate screens land.
export function App() {
  const { t } = useI18n();
  return (
    <>
      <AppHeader />
      <main className={styles.shell}>
        <p className={styles.eyebrow}>{t('placeholder.status')}</p>
        <h1 className={styles.title}>
          {t('app.name')} <span className={styles.endorse}>{t('app.endorsement')}</span>
        </h1>
        <p className={styles.lede}>{t('placeholder.lede')}</p>
      </main>
    </>
  );
}
