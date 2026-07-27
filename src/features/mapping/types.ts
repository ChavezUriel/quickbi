export type Aggregation = 'sum' | 'avg' | 'count' | 'min' | 'max';

/**
 * Qué se va a representar: una medida agregada por cada valor de una dimensión.
 *
 * `measure` puede ser `null` cuando la agregación es `count`, que cuenta filas
 * y no necesita ninguna columna numérica.
 */
export interface ChartMapping {
  dimension: string | null;
  measure: string | null;
  aggregation: Aggregation;
}

/** `count` es la única agregación que no consume una medida. */
export function needsMeasure(aggregation: Aggregation): boolean {
  return aggregation !== 'count';
}

/** `true` si el mapeo está completo y puede alimentar un gráfico. */
export function isMappingComplete(mapping: ChartMapping): boolean {
  if (mapping.dimension === null) return false;
  return !needsMeasure(mapping.aggregation) || mapping.measure !== null;
}
