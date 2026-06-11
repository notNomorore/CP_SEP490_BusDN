import { useEffect, useState } from 'react';

const LANGUAGE_STORAGE_KEY = 'appLanguage';
const listeners = new Set();
let currentLanguage = null;

const getStoredLanguage = () => {
  if (typeof window === 'undefined') {
    return null;
  }

  const storedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  return storedLanguage === 'vi' || storedLanguage === 'en' ? storedLanguage : null;
};

const getLanguage = () => {
  if (!currentLanguage) {
    currentLanguage = getStoredLanguage() || 'en';
  }

  return currentLanguage;
};

const setGlobalLanguage = (nextLanguage) => {
  currentLanguage = nextLanguage;

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
  }

  listeners.forEach((listener) => listener(nextLanguage));
};

const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const useLanguage = () => {
  const [language, setLanguage] = useState(() => getLanguage());

  useEffect(() => subscribe(setLanguage), []);

  useEffect(() => {
    const handleStorageChange = (event) => {
      if (event.key === LANGUAGE_STORAGE_KEY && (event.newValue === 'vi' || event.newValue === 'en')) {
        setGlobalLanguage(event.newValue);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  return {
    language,
    setLanguage: setGlobalLanguage,
    toggleLanguage: () => setGlobalLanguage(language === 'en' ? 'vi' : 'en'),
  };
};

export default useLanguage;
