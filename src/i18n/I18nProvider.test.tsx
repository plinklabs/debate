import { act, render, renderHook, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useI18n } from './context';
import { I18nProvider } from './I18nProvider';
import { LANGUAGE_STORAGE_KEY } from './language';

function browserPrefers(...languages: string[]) {
  vi.spyOn(navigator, 'languages', 'get').mockReturnValue(languages);
  vi.spyOn(navigator, 'language', 'get').mockReturnValue(languages[0] ?? '');
}

const wrapper = ({ children }: { children: ReactNode }) => <I18nProvider>{children}</I18nProvider>;

function Name() {
  const { t } = useI18n();
  return <p>{t('app.name')}</p>;
}

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  document.documentElement.lang = 'en';
});

describe('I18nProvider', () => {
  it("starts in the browser's language", () => {
    browserPrefers('fr-BE', 'nl-BE', 'en');
    const { result } = renderHook(() => useI18n(), { wrapper });
    expect(result.current.locale).toBe('nl');
  });

  it("starts in English when the browser's languages are not in the app", () => {
    browserPrefers('fr-BE', 'de');
    const { result } = renderHook(() => useI18n(), { wrapper });
    expect(result.current.locale).toBe('en');
  });

  it("starts in the remembered language, whatever the browser's", () => {
    browserPrefers('nl-BE');
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'en');
    const { result } = renderHook(() => useI18n(), { wrapper });
    expect(result.current.locale).toBe('en');
  });

  it('switches the text, <html lang> and the page title, and remembers the choice', () => {
    browserPrefers('en-US');
    const { result } = renderHook(() => useI18n(), { wrapper });
    expect(document.documentElement.lang).toBe('en');
    expect(document.title).toBe('Debate — by Plink Labs');
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBeNull();

    act(() => result.current.setLocale('nl'));

    expect(result.current.locale).toBe('nl');
    expect(result.current.t('app.name')).toBe('Debat');
    expect(document.documentElement.lang).toBe('nl');
    expect(document.title).toBe('Debat — door Plink Labs');
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('nl');
  });

  it('keeps working when storage is blocked', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new Error('SecurityError: storage is blocked');
    });
    browserPrefers('nl-BE');
    const { result } = renderHook(() => useI18n(), { wrapper });
    expect(result.current.locale).toBe('nl');
    act(() => result.current.setLocale('en'));
    expect(result.current.locale).toBe('en');
  });

  it('formats numbers and durations in the current language', () => {
    const { result } = renderHook(() => useI18n(), {
      wrapper: ({ children }) => <I18nProvider initialLocale="nl">{children}</I18nProvider>,
    });
    expect(result.current.formatNumber(2.5)).toBe('2,5');
    expect(result.current.formatDuration(90, 'long')).toBe('1 minuut 30 seconden');
    expect(result.current.describeIssue({ code: 'empty', path: [] })).toBe(
      'Dit mag niet leeg zijn.',
    );
  });

  it('is needed by useI18n', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Name />)).toThrow(/I18nProvider/);
  });

  it('gives the text to the components below it', () => {
    render(
      <I18nProvider initialLocale="nl">
        <Name />
      </I18nProvider>,
    );
    expect(screen.getByText('Debat')).toBeInTheDocument();
  });
});
