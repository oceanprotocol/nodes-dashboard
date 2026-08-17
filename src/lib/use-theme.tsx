import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type ThemePreference = 'light' | 'system' | 'dark';

export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'ocean-theme';

/**
 * The only OS read in the app, and only for an explicit `system` pick. Nothing else — no CSS media
 * query, no `light-dark()` value — may key off the OS, or a pinned theme would still follow it.
 */
const DARK_QUERY = '(prefers-color-scheme: dark)';

const isThemePreference = (value: unknown): value is ThemePreference =>
  value === 'light' || value === 'system' || value === 'dark';

/** Mirrors the pre-hydration script in `_document.tsx` — keep the two in sync. Always a resolved
    light/dark: MUI's `data-theme` colorSchemeSelector only matches when the attribute is present. */
const applyTheme = (resolved: ResolvedTheme) => {
  document.documentElement.setAttribute('data-theme', resolved);
};

const DEFAULT_PREFERENCE: ThemePreference = 'light';

const readStoredPreference = (): ThemePreference => {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isThemePreference(stored)) {
      return stored;
    }
  } catch {
    // Storage unavailable (private mode / blocked cookies).
  }
  return DEFAULT_PREFERENCE;
};

type ThemeContextValue = {
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  // Default first so server and client agree on hydration; stored choice loads in the effect below.
  const [preference, setPreferenceState] = useState<ThemePreference>(DEFAULT_PREFERENCE);
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>('light');

  useEffect(() => {
    setPreferenceState(readStoredPreference());
  }, []);

  useEffect(() => {
    const query = window.matchMedia(DARK_QUERY);
    const sync = () => setSystemTheme(query.matches ? 'dark' : 'light');
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  const resolvedTheme: ResolvedTheme = preference === 'system' ? systemTheme : preference;

  useEffect(() => {
    applyTheme(resolvedTheme);
  }, [resolvedTheme]);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Persisting is best-effort; the pick still applies for this session.
    }
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ preference, resolvedTheme, setPreference }),
    [preference, resolvedTheme, setPreference]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
