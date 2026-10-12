import { LOCALES } from '../model/locale';
import { DICTIONARIES, useI18n } from '../i18n';
import styles from './LanguageSwitch.module.css';

/**
 * EN | NL. Each button shows its language's code and is named in that
 * language ("Nederlands"), so it reads the same whatever the UI language is.
 */
export function LanguageSwitch() {
  const { locale, setLocale, t } = useI18n();
  return (
    <div className={styles.switch} role="group" aria-label={t('language.label')}>
      {LOCALES.map((option) => {
        const own = DICTIONARIES[option];
        return (
          <button
            key={option}
            type="button"
            className={styles.option}
            lang={option}
            aria-label={own['language.name']}
            aria-pressed={option === locale}
            onClick={() => setLocale(option)}
          >
            {own['language.code']}
          </button>
        );
      })}
    </div>
  );
}
