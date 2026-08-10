import {
  EMPTY_LABEL,
  TOTAL_DIM,
  type AnalysisRow,
  type ComparisonMode,
  type DateWindow,
  type DisappearedItem,
  type ExplorationItem,
  type ExplorationResult,
  type ExplorationSerie,
  type ExplorationSeries,
  type FilterSet,
  type Granularity,
  type MetricAgg,
  type MetricDef,
} from '../types';
import {
  addUnits,
  bucketLabel,
  bucketOf,
  generateBuckets,
  shiftByDuration,
  shiftWindow,
  startOfUnit,
} from './dates';
import { getDateCondition, matchesSelections } from './filters';

/** Series con nombre propio en la evolución; el resto se pliega en «Otros». */
const TOP_SERIES = 10;

/** Longitud de los rankings de subidas y caídas. */
const TOP_MOVEMENTS = 5;

const TOP_DISAPPEARED = 10;

export const OTHERS_LABEL = 'Otros';

export const TOTAL_LABEL = 'Total';

export interface ResolvedWindows {
  current: DateWindow | null;
  previous: DateWindow | null;
}

/**
 * Traduce el filtro temporal a ventanas concretas.
 *
 * El ancla no es «hoy» sino el último día del dataset: un fichero cerrado en
 * marzo no debería mostrar «últimos 3 meses» vacíos porque el reloj del
 * navegador diga agosto.
 */
export function resolveWindows(
  filters: FilterSet,
  bounds: DateWindow | null,
  comparison: ComparisonMode,
  customPrevious: DateWindow | null = null,
): ResolvedWindows {
  if (bounds === null) return { current: null, previous: null };

  const condition = getDateCondition(filters);
  let current: DateWindow;

  if (condition === null) {
    current = bounds;
  } else if (condition.op === 'entre_fechas') {
    current = { desde: condition.desde, hasta: condition.hasta };
  } else {
    const hasta = bounds.hasta;
    const desde = addUnits(startOfUnit(hasta, condition.unit), -(condition.n - 1), condition.unit);
    current = { desde, hasta };
  }

  if (current.desde > current.hasta) {
    current = { desde: current.hasta, hasta: current.desde };
  }

  return { current, previous: previousOf(current, condition, comparison, customPrevious) };
}

function previousOf(
  current: DateWindow,
  condition: ReturnType<typeof getDateCondition>,
  comparison: ComparisonMode,
  customPrevious: DateWindow | null,
): DateWindow | null {
  switch (comparison) {
    case 'ninguna':
      return null;
    case 'personalizada':
      return customPrevious;
    case 'anio_anterior':
      return shiftWindow(current, 1, 'anio');
    case 'anterior':
      return condition !== null && condition.op === 'ultimos_periodos'
        ? shiftWindow(current, condition.n, condition.unit)
        : shiftByDuration(current);
  }
}

export interface ExplorationParams {
  /** `TOTAL_DIM` o el nombre de una columna de dimensión. */
  dim: string;
  metric: MetricDef;
  filters: FilterSet;
  window: DateWindow | null;
  previousWindow: DateWindow | null;
  grano: Granularity;
}

/**
 * Motor del análisis cruzado: agrupa, compara contra el período anterior,
 * construye la evolución temporal y ordena los movimientos.
 *
 * Función pura sobre filas ya normalizadas: se testea en Node y se puede mover
 * a un worker si algún día hace falta.
 */
export function computeExploration(
  rows: readonly AnalysisRow[],
  params: ExplorationParams,
): ExplorationResult {
  const { dim, metric, filters, window, previousWindow, grano } = params;

  const currentRows: AnalysisRow[] = [];
  const previousRows: AnalysisRow[] = [];
  let rowsWithoutDate = 0;

  for (const row of rows) {
    if (!matchesSelections(row, filters)) continue;

    if (window === null) {
      currentRows.push(row);
      continue;
    }

    if (row.day === null) {
      rowsWithoutDate += 1;
      continue;
    }

    if (row.day >= window.desde && row.day <= window.hasta) currentRows.push(row);
    else if (
      previousWindow !== null &&
      row.day >= previousWindow.desde &&
      row.day <= previousWindow.hasta
    ) {
      previousRows.push(row);
    }
  }

  const keyOf = (row: AnalysisRow): string =>
    dim === TOTAL_DIM ? TOTAL_LABEL : (row.dims[dim] ?? EMPTY_LABEL);

  const currentTotals = new Map<string, Accumulator>();
  const currentGlobal = newAccumulator();
  for (const row of currentRows) {
    accumulate(currentGlobal, row, metric);
    accumulate(bucketFor(currentTotals, keyOf(row)), row, metric);
  }

  const previousTotals = new Map<string, Accumulator>();
  const previousGlobal = newAccumulator();
  for (const row of previousRows) {
    accumulate(previousGlobal, row, metric);
    accumulate(bucketFor(previousTotals, keyOf(row)), row, metric);
  }

  const hasComparison = previousWindow !== null;
  const total = valueOf(currentGlobal, metric.agg);
  const previousTotal = hasComparison ? valueOf(previousGlobal, metric.agg) : null;
  const previousRowsMatched = hasComparison ? previousRows.length : null;
  const previousItemsCount = hasComparison ? previousTotals.size : null;

  const items: ExplorationItem[] = [...currentTotals.entries()]
    .map(([name, accumulator]) => {
      const value = valueOf(accumulator, metric.agg);
      const previousAccumulator = previousTotals.get(name);
      const previousValue = hasComparison
        ? previousAccumulator === undefined
          ? 0
          : valueOf(previousAccumulator, metric.agg)
        : null;

      return {
        name,
        value,
        sharePct: metric.cumulative && total !== 0 ? (value / total) * 100 : null,
        previousValue,
        deltaPct: deltaOf(value, previousValue),
      };
    })
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, 'es'));

  const withDelta = items.filter((item) => item.deltaPct !== null);

  const subidas = withDelta
    .filter((item) => (item.deltaPct ?? 0) > 0)
    .sort((a, b) => (b.deltaPct ?? 0) - (a.deltaPct ?? 0))
    .slice(0, TOP_MOVEMENTS);

  const caidas = withDelta
    .filter((item) => (item.deltaPct ?? 0) < 0)
    .sort((a, b) => (a.deltaPct ?? 0) - (b.deltaPct ?? 0))
    .slice(0, TOP_MOVEMENTS);

  // Lo que desapareció no tiene delta (dividir entre su valor previo daría
  // -100 % para todos y perdería el tamaño de lo perdido), así que va aparte.
  const desaparecidos: DisappearedItem[] = hasComparison
    ? [...previousTotals.entries()]
        .filter(([name]) => !currentTotals.has(name))
        .map(([name, accumulator]) => ({
          name,
          previousValue: valueOf(accumulator, metric.agg),
        }))
        .filter((item) => item.previousValue !== 0)
        .sort((a, b) => Math.abs(b.previousValue) - Math.abs(a.previousValue))
        .slice(0, TOP_DISAPPEARED)
    : [];

  const serie =
    window === null
      ? null
      : buildSerie({
          currentRows,
          previousRows,
          keyOf,
          metric,
          grano,
          window,
          previousWindow,
          topNames: items.slice(0, TOP_SERIES).map((item) => item.name),
          foldOthers: metric.cumulative && items.length > TOP_SERIES,
        });

  return {
    dim,
    window,
    previousWindow,
    items,
    total,
    previousTotal,
    serie,
    subidas,
    caidas,
    desaparecidos,
    rowsMatched: currentRows.length,
    previousRowsMatched,
    previousItemsCount,
    rowsWithoutDate,
  };
}

interface SerieInput {
  currentRows: readonly AnalysisRow[];
  previousRows: readonly AnalysisRow[];
  keyOf: (row: AnalysisRow) => string;
  metric: MetricDef;
  grano: Granularity;
  window: DateWindow;
  previousWindow: DateWindow | null;
  topNames: string[];
  foldOthers: boolean;
}

function buildSerie(input: SerieInput): ExplorationSerie {
  const { currentRows, keyOf, metric, grano, window, topNames, foldOthers } = input;

  const periods = generateBuckets(window, grano);
  const index = new Map(periods.map((period, position) => [period, position]));

  const perSeries = new Map<string, Accumulator[]>(
    topNames.map((name) => [name, periods.map(newAccumulator)]),
  );
  const perPeriod = periods.map(newAccumulator);

  for (const row of currentRows) {
    if (row.day === null) continue;
    const position = index.get(bucketOf(row.day, grano));
    if (position === undefined) continue;

    const periodAccumulator = perPeriod[position];
    if (periodAccumulator !== undefined) accumulate(periodAccumulator, row, metric);

    const accumulators = perSeries.get(keyOf(row));
    const accumulator = accumulators?.[position];
    if (accumulator !== undefined) accumulate(accumulator, row, metric);
  }

  const series: ExplorationSeries[] = topNames.map((name) => ({
    name,
    values: (perSeries.get(name) ?? []).map((accumulator) =>
      seriesValue(accumulator, metric),
    ),
    isOthers: false,
  }));

  if (foldOthers) {
    // El residuo se calcula por período contra el total, no sumando las series
    // descartadas: así «Otros» cuadra siempre con el total del período.
    const values = perPeriod.map((accumulator, position) => {
      const named = series.reduce(
        (sum, current) => sum + (current.values[position] ?? 0),
        0,
      );
      return Math.max(valueOf(accumulator, metric.agg) - named, 0);
    });

    if (values.some((value) => value > 0)) {
      series.push({ name: OTHERS_LABEL, values, isOthers: true });
    }
  }

  return {
    grano,
    periods,
    labels: periods.map((period) => bucketLabel(period, grano)),
    series,
    previous: series.length === 1 ? previousSeries(input, periods.length) : null,
  };
}

/**
 * Serie del período de comparación alineada por índice con la actual: el cubo
 * n-ésimo del período previo se dibuja bajo el cubo n-ésimo del actual.
 */
function previousSeries(input: SerieInput, length: number): ExplorationSeries | null {
  const { previousRows, previousWindow, metric, grano } = input;
  if (previousWindow === null || previousRows.length === 0) return null;

  const periods = generateBuckets(previousWindow, grano);
  const index = new Map(periods.map((period, position) => [period, position]));
  const accumulators = periods.map(newAccumulator);

  for (const row of previousRows) {
    if (row.day === null) continue;
    const position = index.get(bucketOf(row.day, grano));
    const accumulator = position === undefined ? undefined : accumulators[position];
    if (accumulator !== undefined) accumulate(accumulator, row, metric);
  }

  const values = accumulators.map((accumulator) => seriesValue(accumulator, metric));
  // Si el período previo tiene más cubos (meses de distinta longitud), se
  // recorta; si tiene menos, se rellena con huecos.
  const aligned = Array.from({ length }, (_, position) => values[position] ?? null);

  return { name: 'Período anterior', values: aligned, isOthers: false };
}

interface Accumulator {
  sum: number;
  count: number;
}

function newAccumulator(): Accumulator {
  return { sum: 0, count: 0 };
}

function bucketFor(map: Map<string, Accumulator>, key: string): Accumulator {
  const existing = map.get(key);
  if (existing !== undefined) return existing;

  const created = newAccumulator();
  map.set(key, created);
  return created;
}

function accumulate(accumulator: Accumulator, row: AnalysisRow, metric: MetricDef): void {
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

function valueOf(accumulator: Accumulator, agg: MetricAgg): number {
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
function seriesValue(accumulator: Accumulator, metric: MetricDef): number | null {
  if (accumulator.count === 0) return metric.cumulative ? 0 : null;
  return valueOf(accumulator, metric.agg);
}

function deltaOf(value: number, previousValue: number | null): number | null {
  if (previousValue === null || previousValue === 0) return null;
  return ((value - previousValue) / Math.abs(previousValue)) * 100;
}
