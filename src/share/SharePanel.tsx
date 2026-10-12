import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '../components/ui/Button';
import { Field, TextInput, describedBy } from '../components/ui/Field';
import { saveFile } from '../components/ui/saveFile';
import { useI18n } from '../i18n';
import type { DebateConfig } from '../model/config';
import { configFileText, encodeConfig, linkTo } from '../model/share';
import setup from '../setup/setup.module.css';
import styles from './share.module.css';

interface Props {
  /** The setup to share: its topics and format, never the session. */
  readonly config: DebateConfig;
  /** A .json file the teacher picked, to show before it is used. */
  readonly onOpenFile: (file: File) => void;
}

interface Copy {
  /** The link this is about; a new link clears it. */
  readonly link: string;
  readonly copied: boolean;
}

/**
 * The setup as a link to copy, or as a file to download, and a file to open.
 * Copying falls back to selecting the link in its field when the browser
 * does not let the page write to the clipboard.
 */
export function SharePanel({ config, onOpenFile }: Props) {
  const { t } = useI18n();
  const prefix = useId();
  const linkId = `${prefix}-link`;
  const fileInput = useRef<HTMLInputElement>(null);
  const [made, setMade] = useState<{ readonly config: DebateConfig; readonly link: string }>();
  const [copy, setCopy] = useState<Copy | null>(null);

  // The link of the setup as it is now. Compressing is asynchronous, so the
  // link of an older setup is never shown for a newer one.
  useEffect(() => {
    let current = true;
    void encodeConfig(config).then((encoded) => {
      if (current) setMade({ config, link: linkTo(window.location.href, encoded) });
    });
    return () => {
      current = false;
    };
  }, [config]);

  const link = made?.config === config ? made.link : null;
  const status = copy !== null && copy.link === link ? copy : null;

  const selectLink = () => {
    const field = document.getElementById(linkId);
    if (!(field instanceof HTMLInputElement)) return;
    field.focus();
    field.select();
  };

  const copyLink = async () => {
    if (link === null) return;
    // Missing outside a secure context, and in some embedded browsers.
    const clipboard: Clipboard | undefined = navigator.clipboard;
    try {
      if (clipboard === undefined) throw new Error('No clipboard');
      await clipboard.writeText(link);
      setCopy({ link, copied: true });
    } catch {
      selectLink();
      setCopy({ link, copied: false });
    }
  };

  return (
    <section className={setup.panel} aria-labelledby={`${prefix}-heading`}>
      <h2 id={`${prefix}-heading`} className={setup.heading}>
        {t('setup.tab.share')}
      </h2>
      <p className={setup.intro}>{t('share.intro')}</p>

      <div className={setup.group}>
        <h3 className={setup.groupTitle}>{t('share.link')}</h3>
        <div className={styles.linkRow}>
          <Field
            id={linkId}
            label={t('share.link.label')}
            hint={t('share.link.hint')}
            className={styles.linkField}
          >
            <TextInput
              id={linkId}
              readOnly
              value={link ?? ''}
              placeholder={t('share.link.making')}
              aria-describedby={describedBy(linkId, { hint: true })}
              spellCheck={false}
              onFocus={(event) => event.currentTarget.select()}
            />
          </Field>
          <Button variant="primary" disabled={link === null} onClick={() => void copyLink()}>
            {t('share.link.copy')}
          </Button>
        </div>
        <p
          role="status"
          className={status?.copied === false ? styles.copyFailed : styles.copyStatus}
        >
          {status === null ? '' : t(status.copied ? 'share.link.copied' : 'share.link.copyFailed')}
        </p>
      </div>

      <div className={setup.group}>
        <h3 className={setup.groupTitle}>{t('share.file')}</h3>
        <p className={styles.groupIntro}>{t('share.file.intro')}</p>
        <div className={styles.fileActions}>
          <Button
            onClick={() =>
              saveFile(t('share.file.name'), configFileText(config), 'application/json')
            }
          >
            {t('share.file.download')}
          </Button>
          <Button onClick={() => fileInput.current?.click()}>{t('share.file.open')}</Button>
          <input
            ref={fileInput}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              // The same file can be opened again later.
              event.currentTarget.value = '';
              if (file !== undefined) onOpenFile(file);
            }}
          />
        </div>
      </div>
    </section>
  );
}
