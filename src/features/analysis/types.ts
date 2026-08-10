/**
 * Tipos del análisis cruzado: la exploración multidimensional que ocupa el
 * último paso del asistente. Todo se calcula en memoria, sobre las filas ya
 * normalizadas por `prepare-rows.ts`.
 */

/** Cómo se combinan los valores de una métrica dentro de una categoría. */
export type MetricAgg = 'sum' | 'avg' | 'count';

export type MetricFormat = 'numero' | 'moneda' | 'porcentaje';

export type Currency = 'EUR' | 'USD' | 'MXN';

/** Métrica «recuento de filas»: no consume ninguna columna. */
export const COUNT_METRIC_ID = '__filas__';

/** Dimensión sin agrupar: una única categoría con el total. */
export const TOTAL_DIM = '__total__';

/** Etiqueta de las filas cuya dimensión está vacía. Nada se descarta en silencio. */
export const EMPTY_LABEL = '(sin valor)';

export interface MetricDef {
  /** `__filas__` o el nombre de la columna numérica. */
  id: string;
  label: string;
  agg: MetricAgg;
  /** `null` solo para el recuento de filas. */
  column: string | null;
  format: MetricFormat;
  /**
   * Una métrica acumulativa reparte su total entre las categorías: la
   * participación y el residuo «Otros» solo tienen sentido con ellas. La media
   * no lo es (la media de las partes no suma la media del todo).
   */
  cumulative: boolean;
}

/** Qué columnas alimentan el cuadro de mando. Se decide en el paso 2. */
export interface AnalysisConfig {
  /** Eje temporal. `null` si el dataset no tiene ninguna columna de fecha. */
  dateColumn: string | null;
  /** Columnas por las que se puede agrupar. */
  dimensions: string[];
  metrics: MetricDef[];
  currency: Currency;
}

export type Granularity = 'dia' | 'semana' | 'mes' | 'trimestre' | 'anio';

export type ComparisonMode = 'anterior' | 'anio_anterior' | 'personalizada' | 'ninguna';

/** Ventana temporal cerrada por ambos extremos, en ISO `YYYY-MM-DD`. */
export interface DateWindow {
  desde: string;
  hasta: string;
}

/**
 * Condición de filtrado. El conjunto se interpreta siempre en `AND`, y como
 * mucho hay una condición temporal (la de la columna de fecha).
 */
export type Condition =
  | { op: 'in'; column: string; values: string[] }
  | { op: 'entre_fechas'; column: string; desde: string; hasta: string }
  | { op: 'ultimos_periodos'; column: string; n: number; unit: Granularity };

export interface FilterSet {
  conditions: Condition[];
}

/**
 * Fila lista para agregar: la fecha ya convertida a día ISO, las dimensiones a
 * texto y las medidas a número. Convertir una vez y no en cada recálculo es lo
 * que permite filtrar de forma cruzada sin que se note.
 */
export interface AnalysisRow {
  /** Día ISO, o `null` si la fila no tiene fecha convertible. */
  day: string | null;
  dims: Record<string, string>;
  values: Record<string, number | null>;
}

export interface ExplorationItem {
  name: string;
  value: number;
  /** Porcentaje sobre el total visible; `null` en métricas no acumulativas. */
  sharePct: number | null;
  /** `null` cuando no hay período de comparación. */
  previousValue: number | null;
  /** `null` si no hay comparación o si el valor previo era cero. */
  deltaPct: number | null;
}

export interface ExplorationSeries {
  name: string;
  /** Un valor por período; `null` es hueco (la línea se corta, no cae a cero). */
  values: (number | null)[];
  isOthers: boolean;
}

export interface ExplorationSerie {
  grano: Granularity;
  /** Claves de período (`2026-07`, `2026-W…`), estables e independientes del idioma. */
  periods: string[];
  /** Las mismas claves ya formateadas para el eje. */
  labels: string[];
  series: ExplorationSeries[];
  /**
   * Serie del período de comparación alineada por índice. Solo se calcula
   * cuando hay una única serie visible: superpuesta sobre diez líneas sería ruido.
   */
  previous: ExplorationSeries | null;
}

export interface DisappearedItem {
  name: string;
  previousValue: number;
}

export interface ExplorationResult {
  dim: string;
  window: DateWindow | null;
  previousWindow: DateWindow | null;
  items: ExplorationItem[];
  total: number;
  previousTotal: number | null;
  serie: ExplorationSerie | null;
  subidas: ExplorationItem[];
  caidas: ExplorationItem[];
  desaparecidos: DisappearedItem[];
  /** Filas que entran en la ventana actual tras aplicar los filtros. */
  rowsMatched: number;
  /** Filas que entran en la ventana de comparaciÃ³n tras aplicar los filtros. */
  previousRowsMatched: number | null;
  /** Valores distintos de la dimensiÃ³n en la ventana de comparaciÃ³n. */
  previousItemsCount: number | null;
  /** Filas que pasan los filtros pero quedan fuera por no tener fecha. */
  rowsWithoutDate: number;
}
