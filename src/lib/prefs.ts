import { LANGS, type Lang } from './i18n';

/** Small per-browser preferences (language, last viewed person). */
export const prefs = {
  get(key: string): string | null {
    try { return localStorage.getItem(`family-tree:${key}`); } catch { return null; }
  },
  set(key: string, value: string | null) {
    try {
      if (value === null) localStorage.removeItem(`family-tree:${key}`);
      else localStorage.setItem(`family-tree:${key}`, value);
    } catch { /* storage unavailable */ }
  },
};

export function initialLang(): Lang {
  const saved = prefs.get('lang') as Lang | null;
  if (saved && LANGS.some((l) => l.code === saved)) return saved;
  const nav = navigator.language.slice(0, 2);
  return nav === 'fr' ? 'fr' : nav === 'en' ? 'en' : 'he';
}
