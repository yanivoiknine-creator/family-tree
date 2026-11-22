import { createContext, useContext } from 'react';
import { translate, type Lang, type MsgKey } from './i18n';

interface LangCtx {
  lang: Lang;
  t: (key: MsgKey, vars?: Record<string, string>) => string;
}

export const LangContext = createContext<LangCtx>({ lang: 'he', t: (k, v) => translate('he', k, v) });
export const useLang = () => useContext(LangContext);
