const STORAGE_KEY = 'quickbi:theme';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const DARK_QUERY = '(prefers-color-scheme: dark)';

export function prefersDarkQuery(): MediaQueryList {
  return window.matchMedia(DARK_QUERY);
}

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference !== 'system') return preference;
  return prefersDarkQuery().matches ? 'dark' : 'light';
}

/** Lee la preferencia guardada; cae a `system` si no hay o no es válida. */
export function readStoredTheme(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
  } catch {
    return 'system'; // localStorage puede lanzar con cookies bloqueadas
  }
}

export function storeTheme(preference: ThemePreference): void {
  try {
    localStorage.setItem(STORAGE_KEY, preference);
  } catch {
    // Sin persistencia: el tema sigue funcionando durante la sesión.
  }
}

/**
 * Aplica el tema al elemento raíz. `color-scheme` hace que el navegador pinte
 * también sus propios controles (scrollbars, inputs nativos) en el modo correcto.
 */
export function applyTheme(preference: ThemePreference): void {
  const resolved = resolveTheme(preference);
  const root = document.documentElement;

  root.classList.toggle('dark', resolved === 'dark');
  root.style.colorScheme = resolved;
}
