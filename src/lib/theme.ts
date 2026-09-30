export type Theme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'theme';

/**
 * Inline script injected into <head> (see src/app/layout.tsx) and run
 * before hydration, so the correct theme class is already on <html> by the
 * time anything paints — without this, the page would flash the system
 * theme and then flip to the stored override a moment later.
 *
 * Kept as a plain string (not a shared function) because it has to run as
 * a standalone <script> tag, before any of the app's JS has loaded.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var s=localStorage.getItem('${THEME_STORAGE_KEY}');var d=s?s==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.classList.add(d?'dark':'light');}catch(e){}})();`;

export function getStoredTheme(): Theme | null {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored === 'dark' || stored === 'light' ? stored : null;
  } catch {
    return null;
  }
}

export function getSystemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** Reads whichever theme is currently applied to <html> — set either by
 * THEME_INIT_SCRIPT before hydration, or by a previous call to this. */
export function getAppliedTheme(): Theme {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.documentElement.classList.toggle('light', theme === 'light');
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage can be unavailable (private browsing, quota) — the toggle
    // still works for the rest of the session, it just won't persist.
  }
}
