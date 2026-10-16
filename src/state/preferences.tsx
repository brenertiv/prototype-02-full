import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

/**
 * User preferences the shell persists (SYS-NAVPAT-11, SYS-AI-11, personalization).
 * localStorage stands in for the personalization service; /reset clears it.
 */
export interface Prefs {
  panelDocked: boolean;
  drawerOpen: boolean;
  theme: 'system' | 'light' | 'dark';
  units: 'imperial' | 'metric';
  /** Hints dismissed once per user (SYS-ONB-06). */
  hintsSeen: string[];
  /** Column widths the user dragged to, in px. */
  panelWidth: number;
  chatWidth: number;
}

const DEFAULTS: Prefs = {
  panelDocked: true,
  drawerOpen: false,
  theme: 'system',
  units: 'imperial',
  hintsSeen: [],
  panelWidth: 281,
  chatWidth: 320,
};

const KEY = 'kw.prefs';

function load(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Prefs>) };
  } catch {
    return DEFAULTS;
  }
}

interface Ctx {
  prefs: Prefs;
  set: <K extends keyof Prefs>(key: K, value: Prefs[K]) => void;
  seeHint: (id: string) => void;
}

const PrefsContext = createContext<Ctx | null>(null);

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Prefs>(load);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(prefs));
    } catch {
      /* private mode or blocked storage: the shell still works */
    }
  }, [prefs]);

  useEffect(() => {
    const root = document.documentElement;
    if (prefs.theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', prefs.theme);
  }, [prefs.theme]);

  const set = useCallback(<K extends keyof Prefs>(key: K, value: Prefs[K]) => {
    setPrefs((p) => ({ ...p, [key]: value }));
  }, []);
  const seeHint = useCallback((id: string) => setPrefs((p) => (p.hintsSeen.includes(id) ? p : { ...p, hintsSeen: [...p.hintsSeen, id] })), []);

  const value = useMemo(() => ({ prefs, set, seeHint }), [prefs, set, seeHint]);
  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export function usePrefs() {
  const ctx = useContext(PrefsContext);
  if (!ctx) throw new Error('usePrefs outside PrefsProvider');
  return ctx;
}
