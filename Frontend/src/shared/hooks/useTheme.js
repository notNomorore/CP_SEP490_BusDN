import { useEffect, useState } from 'react';

const THEME_STORAGE_KEY = 'appTheme';
const listeners = new Set();
let currentTheme = null;

const getSystemTheme = () => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'light';
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const getStoredTheme = () => {
  if (typeof window === 'undefined') {
    return null;
  }

  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  return storedTheme === 'dark' || storedTheme === 'light' ? storedTheme : null;
};

const applyTheme = (theme) => {
  if (typeof document === 'undefined') {
    return;
  }

  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
};

const getTheme = () => {
  if (!currentTheme) {
    currentTheme = getStoredTheme() || getSystemTheme();
    applyTheme(currentTheme);
  }

  return currentTheme;
};

const setGlobalTheme = (nextTheme) => {
  currentTheme = nextTheme;
  applyTheme(nextTheme);

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  }

  listeners.forEach((listener) => listener(nextTheme));
};

const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const useTheme = () => {
  const [theme, setTheme] = useState(() => getTheme());

  useEffect(() => subscribe(setTheme), []);

  useEffect(() => {
    const mediaQuery = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-color-scheme: dark)')
      : null;

    if (!mediaQuery) {
      return undefined;
    }

    const handleMediaChange = (event) => {
      if (!getStoredTheme()) {
        setGlobalTheme(event.matches ? 'dark' : 'light');
      }
    };

    const handleStorageChange = (event) => {
      if (event.key === THEME_STORAGE_KEY && (event.newValue === 'dark' || event.newValue === 'light')) {
        setGlobalTheme(event.newValue);
      }
    };

    mediaQuery.addEventListener('change', handleMediaChange);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      mediaQuery.removeEventListener('change', handleMediaChange);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  return {
    theme,
    isDarkMode: theme === 'dark',
    setTheme: setGlobalTheme,
    toggleTheme: () => setGlobalTheme(theme === 'dark' ? 'light' : 'dark'),
  };
};

export default useTheme;
