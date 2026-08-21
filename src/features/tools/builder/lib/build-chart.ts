import {
  accumulate,
  newAccumulator,
  valueOf,
  type Accumulator,
} from '@/features/analysis/lib/aggregate';
import type { AnalysisRow, MetricDef } from '@/features/analysis/types';
import { computePivot, type PivotAxis } from '../../pivot/lib/pivot';

/**
 * Datos de un gráfico cualquiera: categorías en un eje y una o varias series.
 *
 * El constructor no tiene un motor propio. Un gráfico de barras agrupadas es
 * exactamente una tabla dinámica dibujada —categorías, series y un valor en
 * cada cruce—, así que reutiliza el mismo cálculo y hereda gratis su orden,
 * su tope y su residuo «Otros». La dispersión es la excepción: no cruza dos
 * dimensiones sino dos métricas, y lleva su propio recorrido.
 */

export type ChartKind =
  | 'barras'
  | 'barras_apiladas'
  | 'lineas'
  | 'area'
  | 'circular'
  | 'dispersion';

export const CHART_KIND_LABEL: Record<ChartKind, string> = {
  barras: 'Barras agrupadas',
  barras_apiladas: 'Barras apiladas',
  lineas: 'Líneas',
  area: 'Área',
  circular: 'Circular',
  dispersion: 'Dispersión',
};

/** Los que aceptan una dimensión de series; el resto dibuja una sola. */
export const SUPPORTS_SERIES: Record<ChartKind, boolean> = {
  barras: true,
  barras_apiladas: true,
  lineas: true,
  area: true,
  circular: false,
  dispersion: false,
};

export interface ChartSeries {
  name: string;
  values: (number | null)[];
  isOthers: boolean;
}

export interface ChartPoint {
  name: string;
  x: number;
  y: number;
}

export interface ChartCategory {
  key: string;
  label: string;
  isOthers: boolean;
}

export interface ChartData {
  categories: ChartCategory[];
  series: ChartSeries[];
  /** Solo la dispersión: un punto por categoría con sus dos métricas. */
  points: ChartPoint[] | null;
  hiddenCategories: number;
  hiddenSeries: number;
  total: number;
}

export interface ChartSpec {
  kind: ChartKind;
  category: PivotAxis;
  /** `null` cuando el gráfico dibuja una sola serie. */
  series: PivotAxis | null;
  metric: MetricDef;
  /** Eje Y de la dispersión. */
  metricY: MetricDef | null;
}

export function buildChartData(
  rows: readonly AnalysisRow[],
  spec: ChartSpec,
): ChartData {
  if (spec.kind === 'dispersion') return scatterData(rows, spec);

  const table = computePivot(rows, {
    row: spec.category,
    col: SUPPORTS_SERIES[spec.kind] ? spec.series : null,
    metric: spec.metric,
  });

  const single = spec.series === null || !SUPPORTS_SERIES[spec.kind];

  return {
    categories: table.rows,
    series: table.cols.map((col, colIndex) => ({
      // Sin dimensión de series, la única serie se llama como la métrica: la
      // leyenda diría «Total», que no informa de nada.
      name: single ? spec.metric.label : col.label,
      isOthers: col.isOthers,
      values: table.rows.map((_, rowIndex) => table.cells[rowIndex]?.[colIndex] ?? null),
    })),
    points: null,
    hiddenCategories: table.hiddenRows,
    hiddenSeries: table.hiddenCols,
    total: table.grandTotal,
  };
}

/**
 * Dispersión: dos métricas por categoría.
 *
 * No pasa por la tabla dinámica porque no cruza dos dimensiones: cada punto es
 * una categoría, y lo que se compara son dos cifras suyas. Se recorren las
 * filas una vez acumulando las dos a la vez, para no pagar dos pasadas.
 */
function scatterData(rows: readonly AnalysisRow[], spec: ChartSpec): ChartData {
  const metricY = spec.metricY ?? spec.metric;
  const xAcc = new Map<string, Accumulator>();
  const yAcc = new Map<string, Accumulator>();

  for (const row of rows) {
    const key = spec.category.keyOf(row);
    accumulate(bucket(xAcc, key), row, spec.metric);
    accumulate(bucket(yAcc, key), row, metricY);
  }

  const all = [...xAcc.keys()].map((key) => ({
    name: spec.category.labelOf(key),
    x: valueOf(xAcc.get(key) ?? newAccumulator(), spec.metric.agg),
    y: valueOf(yAcc.get(key) ?? newAccumulator(), metricY.agg),
  }));

  all.sort((a, b) =>
    spec.category.sort === 'clave' ? a.name.localeCompare(b.name, 'es') : b.x - a.x,
  );

  const points = all.slice(0, spec.category.max);

  return {
    categories: points.map((point) => ({
      key: point.name,
      label: point.name,
      isOthers: false,
    })),
    series: [],
    points,
    hiddenCategories: Math.max(all.length - spec.category.max, 0),
    hiddenSeries: 0,
    total: all.reduce((sum, point) => sum + point.x, 0),
  };
}

function bucket(map: Map<string, Accumulator>, key: string): Accumulator {
  const existing = map.get(key);
  if (existing !== undefined) return existing;

  const created = newAccumulator();
  map.set(key, created);
  return created;
}
