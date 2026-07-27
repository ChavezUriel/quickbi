import { useCallback, useEffect, useState } from 'react';
import {
  applyTheme,
  prefersDarkQuery,
  readStoredTheme,
  storeTheme,
  type ThemePreference,
} from './theme';

export function useTheme() {
  const [preference, setPreferenceState] = useState<ThemePreference>(readStoredTheme);

  useEffect(() => {
    applyTheme(preference);
  }, [preference]);

  // Si el usuario sigue al sistema, el tema debe cambiar en vivo cuando el SO
  // cambia (p. ej. al anochecer), sin recargar.
  useEffect(() => {
    if (preference !== 'system') return;

    const media = prefersDarkQuery();
    const onChange = () => applyTheme('system');

    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [preference]);

  const setPreference = useCallback((next: ThemePreference) => {
    storeTheme(next);
    setPreferenceState(next);
  }, []);

  return { preference, setPreference };
}
