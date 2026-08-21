import {
  accumulate,
  newAccumulator,
  valueOf,
  type Accumulator,
} from '@/features/analysis/lib/aggregate';
import type { AnalysisRow, MetricDef } from '@/features/analysis/types';

/**
 * Tabla dinámica: una métrica repartida entre dos ejes de categorías.
 *
 * Es la primitiva que la gente lleva treinta años haciendo a mano en una hoja
 * de cálculo, y la más pedida de todas: filas, columnas y una cifra en cada
 * cruce. El motor del análisis cruzado sabe agrupar por una dimensión y por
 * período; esto agrupa por dos dimensiones cualesquiera.
 */

/** Clave y etiqueta del residuo cuando el eje no cabe entero. */
export const OTHERS_KEY = '__otros__';
export const OTHERS_LABEL = 'Otros';

export type AxisSort = 'total' | 'clave';

export interface PivotAxis {
  /** Clave estable de la categoría a la que pertenece una fila. */
  keyOf: (row: AnalysisRow) => string;
  /**
   * Etiqueta visible de una clave. Se separa de la clave porque los períodos
   * ordenan por `2026-01` y se leen como «ene 26»: ordenar por lo que se ve
   * pondría abril antes que enero.
   */
  labelOf: (key: string) => string;
  sort: AxisSort;
  /** Cuántas categorías caben antes de plegar el resto. */
  max: number;
}

export interface PivotParams {
  row: PivotAxis;
  /** `null` cuando la tabla es una sola columna con el total. */
  col: PivotAxis | null;
  metric: MetricDef;
}

export interface PivotHeader {
  key: string;
  label: string;
  isOthers: boolean;
}

export interface PivotTable {
  rows: PivotHeader[];
  cols: PivotHeader[];
  /** `cells[fila][columna]`; `null` es «ninguna fila en este cruce». */
  cells: (number | null)[][];
  rowTotals: number[];
  colTotals: number[];
  grandTotal: number;
  /** Categorías que no caben en el eje. Cero si cabe entero. */
  hiddenRows: number;
  hiddenCols: number;
  /** Extremos de las celdas con valor, para la escala del mapa de calor. */
  min: number;
  max: number;
}

/** Etiqueta de la única columna cuando no hay eje de columnas. */
const SINGLE_COL_KEY = '__total__';

export function computePivot(
  rows: readonly AnalysisRow[],
  params: PivotParams,
): PivotTable {
  const { row: rowAxis, col: colAxis, metric } = params;

  const cellAcc = new Map<string, Map<string, Accumulator>>();
  const rowAcc = new Map<string, Accumulator>();
  const colAcc = new Map<string, Accumulator>();
  const grand = newAccumulator();

  for (const row of rows) {
    const rowKey = rowAxis.keyOf(row);
    const colKey = colAxis === null ? SINGLE_COL_KEY : colAxis.keyOf(row);

    accumulate(bucket(rowAcc, rowKey), row, metric);
    accumulate(bucket(colAcc, colKey), row, metric);
    accumulate(grand, row, metric);

    let byCol = cellAcc.get(rowKey);
    if (byCol === undefined) {
      byCol = new Map<string, Accumulator>();
      cellAcc.set(rowKey, byCol);
    }
    accumulate(bucket(byCol, colKey), row, metric);
  }

  const rowKeys = orderedKeys(rowAcc, rowAxis, metric);
  const colKeys =
    colAxis === null ? [SINGLE_COL_KEY] : orderedKeys(colAcc, colAxis, metric);

  // Una métrica no acumulativa no se puede plegar: la media de lo que sobra no
  // es la media de nada que el usuario haya pedido, así que se deja fuera y se
  // dice cuánto se ha dejado fuera.
  const foldRows = metric.cumulative && rowKeys.length > rowAxis.max;
  const foldCols =
    colAxis !== null && metric.cumulative && colKeys.length > colAxis.max;

  const visibleRows = rowKeys.slice(0, rowAxis.max);
  const visibleCols = colAxis === null ? colKeys : colKeys.slice(0, colAxis.max);

  const rowHeaders = headersOf(visibleRows, rowAxis, foldRows);
  const colHeaders =
    colAxis === null
      ? [{ key: SINGLE_COL_KEY, label: 'Total', isOthers: false }]
      : headersOf(visibleCols, colAxis, foldCols);

  const rowIndex = indexOf(rowHeaders, foldRows);
  const colIndex = indexOf(colHeaders, foldCols);

  const grid = rowHeaders.map(() => colHeaders.map(newAccumulator));
  const rowTotalAcc = rowHeaders.map(newAccumulator);
  const colTotalAcc = colHeaders.map(newAccumulator);

  for (const [rowKey, byCol] of cellAcc) {
    const targetRow = rowIndex.get(rowKey);
    if (targetRow === undefined) continue;

    for (const [colKey, accumulator] of byCol) {
      const targetCol = colIndex.get(colKey);
      if (targetCol === undefined) continue;

      merge(grid[targetRow]?.[targetCol], accumulator);
      merge(rowTotalAcc[targetRow], accumulator);
      merge(colTotalAcc[targetCol], accumulator);
    }
  }

  const cells = grid.map((line) =>
    line.map((accumulator) =>
      accumulator.count === 0 ? null : valueOf(accumulator, metric.agg),
    ),
  );

  const present = cells.flat().filter((value): value is number => value !== null);

  return {
    rows: rowHeaders,
    cols: colHeaders,
    cells,
    rowTotals: rowTotalAcc.map((accumulator) => valueOf(accumulator, metric.agg)),
    colTotals: colTotalAcc.map((accumulator) => valueOf(accumulator, metric.agg)),
    grandTotal: valueOf(grand, metric.agg),
    hiddenRows: foldRows ? 0 : Math.max(rowKeys.length - rowAxis.max, 0),
    hiddenCols:
      colAxis === null || foldCols ? 0 : Math.max(colKeys.length - colAxis.max, 0),
    min: present.length === 0 ? 0 : Math.min(...present),
    max: present.length === 0 ? 0 : Math.max(...present),
  };
}

function bucket(map: Map<string, Accumulator>, key: string): Accumulator {
  const existing = map.get(key);
  if (existing !== undefined) return existing;

  const created = newAccumulator();
  map.set(key, created);
  return created;
}

function merge(target: Accumulator | undefined, source: Accumulator): void {
  if (target === undefined) return;
  target.sum += source.sum;
  target.count += source.count;
}

function orderedKeys(
  accumulators: Map<string, Accumulator>,
  axis: PivotAxis,
  metric: MetricDef,
): string[] {
  const keys = [...accumulators.keys()];

  if (axis.sort === 'clave') {
    return keys.sort((a, b) => a.localeCompare(b, 'es'));
  }

  return keys.sort((a, b) => {
    const left = valueOf(accumulators.get(a) ?? newAccumulator(), metric.agg);
    const right = valueOf(accumulators.get(b) ?? newAccumulator(), metric.agg);
    return right - left;
  });
}

function headersOf(keys: string[], axis: PivotAxis, fold: boolean): PivotHeader[] {
  const headers = keys.map((key) => ({
    key,
    label: axis.labelOf(key),
    isOthers: false,
  }));

  if (fold) headers.push({ key: OTHERS_KEY, label: OTHERS_LABEL, isOthers: true });
  return headers;
}

/**
 * Dónde va cada clave del acumulado: en su propia posición, en el residuo, o
 * a ningún sitio cuando el eje no se pliega y la categoría se queda fuera.
 */
function indexOf(
  headers: PivotHeader[],
  fold: boolean,
): { get: (key: string) => number | undefined } {
  const positions = new Map<string, number>();
  headers.forEach((header, position) => {
    if (!header.isOthers) positions.set(header.key, position);
  });

  const othersPosition = fold
    ? headers.findIndex((header) => header.isOthers)
    : undefined;

  return {
    get: (key: string) => positions.get(key) ?? othersPosition,
  };
}
