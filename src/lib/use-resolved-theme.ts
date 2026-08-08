import { useEffect, useState } from 'react';
import type { ResolvedTheme } from './theme';

function currentTheme(): ResolvedTheme {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

/**
 * Tema resuelto («light»/«dark») y reactivo. Observa la clase `dark` del
 * elemento raíz en lugar de la preferencia: así reacciona igual al toggle de
 * la propia pestaña, al evento `storage` de otra y al cambio del SO, sin
 * importar desde dónde se use.
 */
export function useResolvedTheme(): ResolvedTheme {
  const [theme, setTheme] = useState<ResolvedTheme>(currentTheme);

  useEffect(() => {
    const observer = new MutationObserver(() => setTheme(currentTheme()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
    return () => observer.disconnect();
  }, []);

  return theme;
}
