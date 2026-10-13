import { useId, useRef } from 'react';
import { Button } from '../components/ui/Button';
import { saveFile } from '../components/ui/saveFile';
import { useI18n } from '../i18n';
import type { AppState } from '../model/reducer';
import { hasResults } from '../model/session';
import { reportCsv } from './csv';
import { dayStamp } from './dayStamp';
import { reportHtml } from './html';
import styles from './report.module.css';

interface Props {
  readonly state: AppState;
  /** The debate the teacher just finished, to say so; `null` otherwise. */
  readonly finished: string | null;
  /** A report file the teacher picked, to show before it is loaded. */
  readonly onOpenReport: (file: File) => void;
}

/**
 * The results of the debates: the report of every debate with results, as an
 * HTML file or as a CSV file, and a report made earlier to open again. Both
 * files are made in the page and saved as downloads; nothing is sent.
 */
export function ResultsGroup({ state, finished, onOpenReport }: Props) {
  const { t, locale } = useI18n();
  const prefix = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const { debates } = state.session;
  const results = debates.some(hasResults);
  const finishedNumber = debates.findIndex((debate) => debate.id === finished) + 1;

  const download = (extension: 'html' | 'csv') => {
    const date = new Date();
    const now = performance.now();
    const name = t('results.fileName', { date: dayStamp(date), extension });
    if (extension === 'html') {
      saveFile(name, reportHtml(state, { locale, date, now }), 'text/html;charset=utf-8');
    } else {
      saveFile(name, reportCsv(state, { locale, now }), 'text/csv;charset=utf-8');
    }
  };

  return (
    <section className={styles.results} aria-labelledby={`${prefix}-heading`}>
      <h3 id={`${prefix}-heading`} className={styles.title}>
        {t('results.title')}
      </h3>
      {finishedNumber > 0 && (
        <p className={styles.finished}>{t('results.finished', { number: finishedNumber })}</p>
      )}
      <p className={styles.intro}>{results ? t('results.intro') : t('results.none')}</p>
      <div className={styles.actions}>
        {results && (
          <>
            <Button onClick={() => download('html')}>{t('results.downloadReport')}</Button>
            <Button onClick={() => download('csv')}>{t('results.downloadCsv')}</Button>
          </>
        )}
        <Button onClick={() => fileInput.current?.click()}>{t('results.open')}</Button>
        <input
          ref={fileInput}
          type="file"
          accept=".html,.htm,text/html"
          hidden
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            // The same file can be opened again later.
            event.currentTarget.value = '';
            if (file !== undefined) onOpenReport(file);
          }}
        />
      </div>
    </section>
  );
}
