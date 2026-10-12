import { LanguageSwitch } from './LanguageSwitch';
import styles from './AppHeader.module.css';

/** The bar above every screen: the Plink Labs lockup and the language switch. */
export function AppHeader() {
  return (
    <header className={styles.header}>
      <div className={styles.bar}>
        {/* The logo: a name, the same in every language, so not in the dictionaries. */}
        <span className={styles.lockup}>
          <svg className={styles.mark} viewBox="0 0 120 120" aria-hidden="true">
            <path
              d="M36 86.8 A36 36 0 1 1 84 86.8"
              fill="none"
              stroke="currentColor"
              strokeWidth="9"
              strokeLinecap="round"
            />
            <circle cx="60" cy="60" r="13" fill="currentColor" />
          </svg>
          <span className={styles.wordmark}>
            plink <span className={styles.labs}>labs</span>
          </span>
        </span>
        <LanguageSwitch />
      </div>
    </header>
  );
}
