import { useEffect, useRef } from 'react';

/**
 * Comunica al asistente si la configuración de la herramienta ya sirve.
 *
 * El aviso va en un efecto y no en el render porque cambia estado del padre;
 * el manejador se lee por referencia para que el efecto dispare cuando cambia
 * la validez y no cada vez que el padre se vuelve a pintar.
 */
export function useToolReady(onReady: (ready: boolean) => void, ready: boolean): void {
  const handler = useRef(onReady);
  handler.current = onReady;

  useEffect(() => {
    handler.current(ready);
  }, [ready]);
}
