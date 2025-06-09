'use client';

import { useState, useEffect } from 'react';
import { Language, getTranslations, Translations } from '../lib/i18n';

export function useTranslations() {
  const [language, setLanguageState] = useState<Language>('es');

  useEffect(() => {
    // Load language from localStorage or user settings
    const savedLanguage = localStorage.getItem('language') as Language;
    if (savedLanguage && (savedLanguage === 'es' || savedLanguage === 'en')) {
      setLanguageState(savedLanguage);
    }

    // Listen for settings changes
    const handleSettingsChange = () => {
      const newLanguage = localStorage.getItem('language') as Language;
      if (newLanguage && (newLanguage === 'es' || newLanguage === 'en')) {
        setLanguageState(newLanguage);
      }
    };

    window.addEventListener('settingsChanged', handleSettingsChange);
    return () => window.removeEventListener('settingsChanged', handleSettingsChange);
  }, []);

  const setLanguage = (newLanguage: Language) => {
    setLanguageState(newLanguage);
    localStorage.setItem('language', newLanguage);
  };

  return {
    language,
    translations: getTranslations(language),
    t: getTranslations(language),
    setLanguage,
  };
} 