export type Theme = 'dark' | 'light';

const THEME_STORAGE_KEY = 'classmate_theme';

/**
 * Returns the currently active theme from localStorage, or defaults to 'dark'.
 */
export const getStoredTheme = (): Theme => {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') {
      return saved;
    }
  } catch {
    // Fall back to default if localStorage is inaccessible
  }
  return 'dark';
};

/**
 * Persists the theme to localStorage and sets data-theme on documentElement.
 */
export const setStoredTheme = (theme: Theme): void => {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Ignore storage write issues
  }
  applyTheme(theme);
};

/**
 * Applies the theme attribute to the HTML root element.
 */
export const applyTheme = (theme: Theme): void => {
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', theme);
  }
};
