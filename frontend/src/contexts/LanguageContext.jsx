import { createContext, useContext, useState, useEffect } from 'react';
import { translations, LANGUAGES } from '@/lib/i18n';

const LanguageContext = createContext();

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem('ssc_lang') || 'en');

  useEffect(() => {
    localStorage.setItem('ssc_lang', lang);
    const langConfig = LANGUAGES.find(l => l.code === lang);
    document.documentElement.dir = langConfig?.rtl ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  }, [lang]);

  const t = (key) => translations[lang]?.[key] || translations.en?.[key] || key;
  const isRTL = LANGUAGES.find(l => l.code === lang)?.rtl || false;

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, isRTL }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => useContext(LanguageContext);
