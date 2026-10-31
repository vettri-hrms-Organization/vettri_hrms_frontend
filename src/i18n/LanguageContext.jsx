import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import hi from './hi';
import ta from './ta';

/**
 * Lightweight UI translation. Dictionaries are keyed by the exact English text, so the shared UI primitives
 * (sidebar, page headers, tabs, buttons, cards, form labels, empty states) translate any string they know and
 * leave the rest in English. The choice is a per-browser preference (localStorage).
 */
export const LANGUAGES = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'hi', label: 'Hindi', native: 'हिन्दी' },
  { code: 'ta', label: 'Tamil', native: 'தமிழ்' },
];

const DICTIONARIES = { hi, ta };
const STORAGE_KEY = 'vettri.lang';

function readStored() {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return LANGUAGES.some((l) => l.code === v) ? v : 'en';
  } catch {
    return 'en';
  }
}

/** Translate outside React (or where the hook can't be used). */
export function translate(lang, text) {
  if (typeof text !== 'string' || lang === 'en') return text;
  const dict = DICTIONARIES[lang];
  if (!dict) return text;
  return dict[text] ?? dict[text.trim()] ?? text;
}

const LanguageContext = createContext({ lang: 'en', setLang: () => {}, t: (s) => s });

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(readStored);
  useEffect(() => {
    document.documentElement.lang = lang === 'en' ? 'en-IN' : `${lang}-IN`;
  }, [lang]);
  const setLang = useCallback((code) => {
    setLangState(code);
    try {
      window.localStorage.setItem(STORAGE_KEY, code);
    } catch {
      // Private mode: the choice lasts for this tab only.
    }
  }, []);
  const t = useCallback((text) => translate(lang, text), [lang]);
  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  return useContext(LanguageContext);
}

/** `t(text)` for the current language; non-strings (elements) pass through untouched. */
export function useT() {
  return useContext(LanguageContext).t;
}
