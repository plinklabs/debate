// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  LANGUAGE_STORAGE_KEY,
  detectLocale,
  matchLocale,
  readStoredLocale,
  startLocale,
  storeLocale,
  type LanguageStore,
} from './language';

function memoryStore(initial: Record<string, string> = {}): LanguageStore & {
  readonly data: Record<string, string>;
} {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => (Object.hasOwn(data, key) ? data[key] : null),
    setItem: (key, value) => {
      data[key] = value;
    },
  };
}

const blocked = (): LanguageStore => {
  throw new Error('SecurityError: storage is blocked');
};

describe('matchLocale', () => {
  it.each([
    ['nl', 'nl'],
    ['nl-BE', 'nl'],
    ['nl_NL', 'nl'],
    ['NL-be', 'nl'],
    ['en', 'en'],
    ['en-US', 'en'],
    ['en-GB', 'en'],
  ])('reads %s as %s', (tag, locale) => {
    expect(matchLocale(tag)).toBe(locale);
  });

  it.each(['fr-BE', 'de', 'nld', '', 'english'])('has no language for %j', (tag) => {
    expect(matchLocale(tag)).toBeNull();
  });
});

describe('detectLocale', () => {
  it("takes the first of the browser's languages that the app has", () => {
    expect(detectLocale(['nl-BE', 'en'])).toBe('nl');
    expect(detectLocale(['en-GB', 'nl'])).toBe('en');
    expect(detectLocale(['fr-BE', 'nl-BE', 'en'])).toBe('nl');
  });

  it('falls back to English', () => {
    expect(detectLocale(['fr-BE', 'de'])).toBe('en');
    expect(detectLocale([])).toBe('en');
  });
});

describe('the remembered language', () => {
  it('is stored under its own key, apart from the debate state', () => {
    const store = memoryStore();
    expect(storeLocale(() => store, 'nl')).toBe(true);
    expect(store.data).toEqual({ [LANGUAGE_STORAGE_KEY]: 'nl' });
    expect(LANGUAGE_STORAGE_KEY).not.toBe('plinklabs:debate:v1');
    expect(readStoredLocale(() => store)).toBe('nl');
  });

  it('is ignored when it is not a language the app has', () => {
    expect(readStoredLocale(() => memoryStore({ [LANGUAGE_STORAGE_KEY]: 'fr' }))).toBeNull();
    expect(readStoredLocale(() => memoryStore())).toBeNull();
  });

  it('cannot break the app when storage is blocked', () => {
    expect(readStoredLocale(blocked)).toBeNull();
    expect(storeLocale(blocked, 'nl')).toBe(false);
  });

  it("wins over the browser's language", () => {
    const store = memoryStore({ [LANGUAGE_STORAGE_KEY]: 'en' });
    expect(startLocale(() => store, ['nl-BE'])).toBe('en');
    expect(startLocale(() => memoryStore(), ['nl-BE'])).toBe('nl');
    expect(startLocale(blocked, ['nl-BE'])).toBe('nl');
  });
});
