import type { AnalysisRow, MetricAgg, MetricDef } from '../types';

/**
 * Acumulador de una métrica sobre un conjunto de filas.
 *
 * Suma y recuento bastan para las tres agregaciones que ofrece la aplicación,
 * y se llevan en un solo recorrido: agrupar por categoría, por período o por
 * cliente es siempre el mismo gesto y no merece tres implementaciones.
 */
export interface Accumulator {
  sum: number;
  count: number;
}

export function newAccumulator(): Accumulator {
  return { sum: 0, count: 0 };
}

/** Acumulador de una clave, creándolo la primera vez que aparece. */
export function bucketFor(map: Map<string, Accumulator>, key: string): Accumulator {
  const existing = map.get(key);
  if (existing !== undefined) return existing;

  const created = newAccumulator();
  map.set(key, created);
  return created;
}

export function accumulate(
  accumulator: Accumulator,
  row: AnalysisRow,
  metric: MetricDef,
): void {
  if (metric.column === null) {
    // Recuento: toda fila cuenta uno y no mira ninguna columna.
    accumulator.sum += 1;
    accumulator.count += 1;
    return;
  }

  const value = row.values[metric.column];
  if (value === null || value === undefined) return;

  accumulator.sum += value;
  accumulator.count += 1;
}

export function valueOf(accumulator: Accumulator, agg: MetricAgg): number {
  switch (agg) {
    case 'sum':
      return accumulator.sum;
    case 'count':
      return accumulator.count;
    case 'avg':
      // Como AVG en SQL: dividen solo las filas que aportaron valor.
      return accumulator.count === 0 ? 0 : accumulator.sum / accumulator.count;
  }
}

/**
 * En una métrica acumulativa un período sin filas vale cero; en una media no
 * vale nada, y dibujar un cero fingiría un desplome. De ahí el hueco.
 */
export function seriesValue(accumulator: Accumulator, metric: MetricDef): number | null {
  if (accumulator.count === 0) return metric.cumulative ? 0 : null;
  return valueOf(accumulator, metric.agg);
}
