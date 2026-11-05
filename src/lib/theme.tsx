import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { ThemeContext, type Theme } from './theme-context';

function getInitialTheme(): Theme {
  try {
    return localStorage.getItem('hos-theme') === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const { pathname } = useLocation();
  const activeTheme = pathname === '/' ? 'dark' : theme;

  useEffect(() => {
    document.documentElement.dataset.theme = activeTheme;
    try {
      localStorage.setItem('hos-theme', theme);
    } catch (error) {
      console.warn('Theme preference could not be saved in this browser.', error);
    }
  }, [activeTheme, theme]);

  const value = useMemo(
    () => ({
      theme,
      toggleTheme: () => setTheme((current) => (current === 'dark' ? 'light' : 'dark')),
    }),
    [theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
