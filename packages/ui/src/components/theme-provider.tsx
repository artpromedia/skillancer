'use client';

import * as React from 'react';

type Theme = 'dark' | 'light' | 'system';

interface ThemeProviderState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: 'dark' | 'light';
}

const ThemeProviderContext = React.createContext<ThemeProviderState | undefined>(undefined);

export interface ThemeProviderProps {
  children: React.ReactNode;
  /**
   * Default theme to use
   * @default "system"
   */
  defaultTheme?: Theme;
  /**
   * Key to use for storing theme preference in localStorage
   * @default "skillancer-theme"
   */
  storageKey?: string;
  /**
   * Attribute to apply to the root element
   * @default "class"
   */
  attribute?: 'class' | 'data-theme';
  /**
   * Whether to enable system theme detection
   * @default true
   */
  enableSystem?: boolean;
  /**
   * Whether to disable transitions on theme change
   * @default false
   */
  disableTransitionOnChange?: boolean;
}

/**
 * Theme provider for dark mode support
 *
 * @example
 * // In your app root:
 * <ThemeProvider defaultTheme="system" storageKey="my-app-theme">
 *   <App />
 * </ThemeProvider>
 *
 * // In any component:
 * const { theme, setTheme, resolvedTheme } = useTheme();
 */
export function ThemeProvider({
  children,
  defaultTheme = 'system',
  storageKey = 'skillancer-theme',
  attribute = 'class',
  enableSystem = true,
  disableTransitionOnChange = false,
}: ThemeProviderProps) {
  const [theme, setThemeState] = React.useState<Theme>(() => {
    if (typeof window === 'undefined') {
      return defaultTheme;
    }
    try {
      const stored = localStorage.getItem(storageKey) as Theme | null;
      return stored || defaultTheme;
    } catch {
      return defaultTheme;
    }
  });

  const [resolvedTheme, setResolvedTheme] = React.useState<'dark' | 'light'>('light');

  // Get system theme
  const getSystemTheme = React.useCallback((): 'dark' | 'light' => {
    if (typeof window === 'undefined') return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }, []);

  // Apply theme to document
  const applyTheme = React.useCallback(
    (newTheme: Theme) => {
      const resolved = newTheme === 'system' ? getSystemTheme() : newTheme;
      setResolvedTheme(resolved);

      if (typeof window === 'undefined') return;

      const root = window.document.documentElement;

      // Disable transitions if requested
      if (disableTransitionOnChange) {
        root.style.setProperty('transition', 'none');
      }

      if (attribute === 'class') {
        root.classList.remove('light', 'dark');
        root.classList.add(resolved);
      } else {
        root.setAttribute('data-theme', resolved);
      }

      // Re-enable transitions
      if (disableTransitionOnChange) {
        // Force reflow
        root.offsetHeight;
        root.style.removeProperty('transition');
      }
    },
    [attribute, disableTransitionOnChange, getSystemTheme]
  );

  // Set theme and persist to localStorage
  const setTheme = React.useCallback(
    (newTheme: Theme) => {
      setThemeState(newTheme);
      try {
        localStorage.setItem(storageKey, newTheme);
      } catch {
        // Ignore localStorage errors
      }
      applyTheme(newTheme);
    },
    [applyTheme, storageKey]
  );

  // Apply theme on mount and when theme changes
  React.useEffect(() => {
    applyTheme(theme);
  }, [applyTheme, theme]);

  // Listen for system theme changes
  React.useEffect(() => {
    if (!enableSystem) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = () => {
      if (theme === 'system') {
        applyTheme('system');
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [applyTheme, enableSystem, theme]);

  const value = React.useMemo(
    () => ({
      theme,
      setTheme,
      resolvedTheme,
    }),
    [theme, setTheme, resolvedTheme]
  );

  return <ThemeProviderContext.Provider value={value}>{children}</ThemeProviderContext.Provider>;
}

/**
 * Hook to access theme context
 *
 * @example
 * const { theme, setTheme, resolvedTheme } = useTheme();
 *
 * // Toggle theme
 * setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
 */
export function useTheme() {
  const context = React.useContext(ThemeProviderContext);

  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }

  return context;
}
