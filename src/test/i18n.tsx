// Component tests render inside the i18n provider, in a fixed language rather
// than the remembered or the browser's one.
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { I18nProvider } from '../i18n';
import type { Locale } from '../model/locale';

export function renderWithI18n(ui: ReactElement, { locale = 'en' }: { locale?: Locale } = {}) {
  return render(<I18nProvider initialLocale={locale}>{ui}</I18nProvider>);
}
