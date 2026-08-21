import { bucketLabel, bucketOf } from '@/features/analysis/lib/dates';
import { EMPTY_LABEL, type AnalysisRow, type Granularity } from '@/features/analysis/types';
import type { AxisSort, PivotAxis } from '../pivot/lib/pivot';

/**
 * Ejes de categorías compartidos por las herramientas que agrupan.
 *
 * Una dimensión y el tiempo se comportan igual —ambos reparten las filas en
 * grupos con nombre—, pero se ordenan distinto: los períodos van en orden de
 * calendario, y una serie temporal ordenada por importe deja de ser una serie.
 * Aquí está esa diferencia escrita una sola vez.
 */

/** Eje especial: el tiempo, agrupado por el grano elegido. */
export const TIME_DIM = '__tiempo__';

/** Eje vacío: la herramienta dibuja una sola serie o columna de totales. */
export const NO_DIM = '__ninguna__';

/** Métrica «recuento de filas» en los desplegables de métrica. */
export const COUNT_COLUMN = '__filas__';

/** Clave de las filas sin fecha cuando el eje es temporal. */
const NO_DATE_KEY = '__sin_fecha__';

export interface AxisOptions {
  /** Nombre de dimensión o `TIME_DIM`. */
  dim: string;
  grain: Granularity;
  sort: AxisSort;
  max: number;
}

export function categoryAxis(options: AxisOptions): PivotAxis {
  const { dim, grain, sort, max } = options;

  if (dim === TIME_DIM) {
    return {
      keyOf: (row: AnalysisRow) =>
        row.day === null ? NO_DATE_KEY : bucketOf(row.day, grain),
      labelOf: (key: string) =>
        key === NO_DATE_KEY ? 'Sin fecha' : bucketLabel(key, grain),
      sort: 'clave',
      max,
    };
  }

  return {
    keyOf: (row: AnalysisRow) => row.dims[dim] ?? EMPTY_LABEL,
    labelOf: (key: string) => key,
    sort,
    max,
  };
}
