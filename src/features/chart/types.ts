export type ChartType = 'bar' | 'line' | 'pie';

/** Nivel al que se trunca una dimensión de fecha antes de agrupar. */
export type DateGranularity = 'day' | 'week' | 'month' | 'quarter' | 'year';

/**
 * Cómo se ordenan las categorías. `natural` es cronológico para fechas,
 * alfabético para texto y «No/Sí» para booleanos.
 */
export type CategorySort = 'natural' | 'value-desc' | 'value-asc';

/**
 * Ajustes del gráfico que no dependen del dataset: el usuario los cambia
 * al vuelo y el gráfico se recalcula sin volver al mapeo.
 */
export interface ChartConfig {
  chartType: ChartType;
  granularity: DateGranularity;
  sort: CategorySort;
  /**
   * Categorías visibles antes de plegar el resto en «Otros»; `null` = todas.
   * No aplica a dimensiones de fecha: una serie temporal recortada por valor
   * deja de contar su historia.
   */
  topN: number | null;
}
