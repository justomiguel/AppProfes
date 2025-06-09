'use client';

import { useState, useCallback, useEffect } from 'react';
import esTranslations from '../locales/es.json';
import enTranslations from '../locales/en.json';

type Language = 'es' | 'en';

type TranslationData = {
  [key: string]: string | TranslationData;
};

const translations: Record<Language, TranslationData> = {
  es: esTranslations,
  en: enTranslations
};

export function useTranslations() {
  const [language, setLanguageState] = useState<Language>('es');

  // Load language from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedLanguage = localStorage.getItem('app-language') as Language;
      if (savedLanguage && ['es', 'en'].includes(savedLanguage)) {
        setLanguageState(savedLanguage);
      }
    }
  }, []);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    if (typeof window !== 'undefined') {
      localStorage.setItem('app-language', lang);
    }
  }, []);

  const t = useCallback((key: string, variables?: Record<string, string | number>): string => {
    const keys = key.split('.');
    let value: any = translations[language];

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        console.warn(`Translation key not found: ${key} for language: ${language}`);
        return key; // Return the key if translation is not found
      }
    }

    if (typeof value !== 'string') {
      console.warn(`Translation value is not a string for key: ${key}`);
      return key;
    }

    // Simple variable interpolation
    if (variables) {
      return value.replace(/\{(\w+)\}/g, (match, varName) => {
        return variables[varName]?.toString() || match;
      });
    }

    return value;
  }, [language]);

  // Helper function to get array of translations (useful for lists)
  const getTranslationObject = useCallback((key: string): TranslationData | null => {
    const keys = key.split('.');
    let value: any = translations[language];

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return null;
      }
    }

    return typeof value === 'object' ? value : null;
  }, [language]);

  return {
    t,
    language,
    setLanguage,
    getTranslationObject
  };
} 