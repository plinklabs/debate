// The UI languages. The model only needs them to build the built-in presets,
// whose labels exist in both; the i18n layer itself lives outside the model.

export type Locale = 'en' | 'nl';

export const LOCALES: readonly Locale[] = ['en', 'nl'];

/** A text, or any other value, in every UI language. */
export type Localized<T = string> = Readonly<Record<Locale, T>>;
