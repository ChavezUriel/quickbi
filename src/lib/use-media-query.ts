import { useCallback, useSyncExternalStore } from 'react';

/**
 * Suscripción a una media query del navegador.
 *
 * La mayoría de lo responsive se resuelve en CSS; esto es para lo que no puede,
 * como decidir la disposición de la leyenda de un lienzo de ECharts, que se
 * dibuja con píxeles y no entiende de puntos de ruptura.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    [query],
  );

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    // En SSR/prerender no hay ventana: se asume el caso ancho, que es el que
    // menos daño hace si la hidratación corrige después.
    () => true,
  );
}
