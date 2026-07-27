import { createContext } from 'react';
import type { ParsedDataset } from './types';

export interface DatasetStore {
  /** Dataset activo, o `null` si el usuario aún no ha cargado ninguno. */
  dataset: ParsedDataset | null;
  setDataset: (dataset: ParsedDataset) => void;
  clearDataset: () => void;
}

/**
 * El dataset es el objeto de dominio central: lo consumirán el mapeo de
 * columnas, los gráficos y los filtros. Vive en contexto desde ya para que
 * añadir esas pantallas no obligue a hacer prop-drilling desde `App`.
 *
 * El contexto se declara aparte del provider para no mezclar componentes y
 * no-componentes en el mismo módulo (Fast Refresh).
 */
export const DatasetContext = createContext<DatasetStore | null>(null);
