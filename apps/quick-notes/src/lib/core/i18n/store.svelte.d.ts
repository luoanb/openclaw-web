import type { Locale, TranslationKey } from "./types";

export function createLocaleStore(): {
  locale: Locale;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  setLocale: (locale: Locale) => void;
};

export function getLocaleStore(): {
  readonly locale: Locale;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  setLocale: (locale: Locale) => void;
};
