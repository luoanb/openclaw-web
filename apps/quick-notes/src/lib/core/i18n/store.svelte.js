import { getContext, setContext } from "svelte";
import { zh } from "./zh";
import { en } from "./en";

/** @type {import("./types").TranslationKey} */
const LOCALE_CONTEXT_KEY = Symbol("locale-store");

const dictionaries = { zh, en };

/**
 * Create a reactive locale store.
 * Called once in App.svelte root layout.
 * @returns {{ locale: import("./types").Locale, t: (key: import("./types").TranslationKey, params?: Record<string, string|number>) => string, setLocale: (l: import("./types").Locale) => void }}
 */
export function createLocaleStore() {
  let locale = $state("zh");

  function t(key, params) {
    const text = dictionaries[locale][key] ?? key;

    if (!params) {
      return text;
    }

    return Object.entries(params).reduce(
      (acc, [k, v]) => acc.replace(`{${k}}`, String(v)),
      text,
    );
  }

  function setLocale(l) {
    locale = l;
  }

  setContext(LOCALE_CONTEXT_KEY, {
    get locale() {
      return locale;
    },
    t,
    setLocale,
  });

  return { locale, t, setLocale };
}

/**
 * Get the locale store in child components.
 */
export function getLocaleStore() {
  return getContext(LOCALE_CONTEXT_KEY);
}
