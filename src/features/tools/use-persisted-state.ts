import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';

/**
 * Estado que sobrevive a la recarga, guardado en `localStorage`.
 *
 * Las herramientas recuerdan su configuración por esquema de columnas: volver
 * a cargar el informe del mes siguiente no debería costar reconfigurarlo todo.
 * Al cambiar la clave —otro dataset, otra herramienta— el estado se recarga
 * durante el render, para que el primer pintado ya use el valor correcto.
 *
 * `fallback` tiene que ser estable (una constante del módulo): se usa cada vez
 * que la clave cambia y no hay nada guardado.
 */
export function usePersistedState<T>(
  key: string,
  fallback: T,
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => read<T>(key) ?? fallback);
  const currentKey = useRef(key);

  if (currentKey.current !== key) {
    currentKey.current = key;
    setValue(read<T>(key) ?? fallback);
  }

  useEffect(() => {
    write(key, value);
  }, [key, value]);

  return [value, setValue];
}

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? null : (JSON.parse(raw) as T);
  } catch {
    // Modo privado, cuota agotada o JSON corrupto: se empieza de cero.
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Guardar la configuración es una comodidad, no un requisito.
  }
}

/**
 * Clave de almacenamiento de una herramienta, atada al esquema de columnas:
 * dos ficheros con las mismas columnas comparten configuración, y uno con
 * columnas distintas empieza limpio en vez de heredar huecos imposibles.
 */
export function toolStorageKey(toolId: string, columnNames: readonly string[]): string {
  return `quickbi_${toolId}_${[...columnNames].sort().join('__')}`;
}
