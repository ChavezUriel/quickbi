import type { ColumnProfile } from '@/features/dataset/lib/column-types';
import { coerceValue } from '@/features/dataset/lib/infer-columns';
import type { CellValue, DataRow } from '@/features/dataset/types';
import { EMPTY_LABEL, type AnalysisConfig, type AnalysisRow, type DateWindow } from '../types';
import { toIso } from './dates';

/** Tope de valores distintos que se ofrecen en un desplegable de filtro. */
const DISTINCT_CAP = 500;

export interface PreparedData {
  rows: AnalysisRow[];
  /** Filas descartadas por no convertir en una columna sin «preservar». */
  dropped: number;
  /** Primer y último día del dataset; `null` si no hay eje temporal. */
  bounds: DateWindow | null;
  /** Valores distintos por dimensión, ya ordenados, para los filtros. */
  distinct: Record<string, string[]>;
}

/**
 * Convierte el dataset una sola vez a la forma que consume el motor: fecha a
 * día ISO, dimensiones a texto y medidas a número.
 *
 * Es la optimización que hace viable el filtrado cruzado: sin ella, cada clic
 * volvería a parsear «1.234,56» y «15/01/2026» en cada fila y cada widget.
 */
export function prepareRows(
  sourceRows: readonly DataRow[],
  columns: readonly ColumnProfile[],
  config: AnalysisConfig,
  preserveInvalid: Readonly<Record<string, boolean>> = {},
): PreparedData {
  const byName = new Map(columns.map((column) => [column.name, column]));

  const dateColumn =
    config.dateColumn === null ? undefined : byName.get(config.dateColumn);

  const dimensionColumns = config.dimensions
    .map((name) => byName.get(name))
    .filter((column): column is ColumnProfile => column !== undefined);

  const metricColumns = [
    ...new Set(
      config.metrics
        .map((metric) => metric.column)
        .filter((name): name is string => name !== null),
    ),
  ]
    .map((name) => byName.get(name))
    .filter((column): column is ColumnProfile => column !== undefined);

  // Mismo criterio que el resumen del paso 2: una fila que no convierte en una
  // columna cuyos errores no se han marcado como «preservar» queda fuera.
  const strictColumns = columns.filter(
    (column) => column.invalidCount > 0 && preserveInvalid[column.name] !== true,
  );

  const rows: AnalysisRow[] = [];
  const distinctSets = new Map<string, Set<string>>(
    dimensionColumns.map((column) => [column.name, new Set<string>()]),
  );
  let dropped = 0;
  let minDay: string | null = null;
  let maxDay: string | null = null;

  for (const sourceRow of sourceRows) {
    if (droppedByStrictColumns(sourceRow, strictColumns)) {
      dropped += 1;
      continue;
    }

    let day: string | null = null;
    if (dateColumn !== undefined) {
      const coerced = coerceValue(
        sourceRow[dateColumn.name] ?? null,
        dateColumn.type,
        dateColumn.format,
      );
      if (coerced instanceof Date) {
        day = toIso(coerced);
        if (minDay === null || day < minDay) minDay = day;
        if (maxDay === null || day > maxDay) maxDay = day;
      }
    }

    const dims: Record<string, string> = {};
    for (const column of dimensionColumns) {
      const label = dimensionLabel(
        coerceValue(sourceRow[column.name] ?? null, column.type, column.format),
      );
      dims[column.name] = label;

      const set = distinctSets.get(column.name);
      if (set !== undefined && set.size < DISTINCT_CAP) set.add(label);
    }

    const values: Record<string, number | null> = {};
    for (const column of metricColumns) {
      const coerced = coerceValue(
        sourceRow[column.name] ?? null,
        column.type,
        column.format,
      );
      values[column.name] = typeof coerced === 'number' ? coerced : null;
    }

    rows.push({ day, dims, values });
  }

  const distinct: Record<string, string[]> = {};
  for (const [name, set] of distinctSets) {
    distinct[name] = [...set].sort((a, b) => a.localeCompare(b, 'es'));
  }

  return {
    rows,
    dropped,
    bounds: minDay !== null && maxDay !== null ? { desde: minDay, hasta: maxDay } : null,
    distinct,
  };
}

function droppedByStrictColumns(
  row: DataRow,
  strictColumns: readonly ColumnProfile[],
): boolean {
  for (const column of strictColumns) {
    const value = row[column.name];
    if (value === null || value === undefined) continue;
    if (coerceValue(value, column.type, column.format) === null) return true;
  }
  return false;
}

/**
 * Etiqueta estable de una categoría. Las fechas usan ISO y no el formato local:
 * la clave de agrupación no debería depender del idioma del navegador.
 */
function dimensionLabel(value: CellValue | null): string {
  if (value === null) return EMPTY_LABEL;
  if (value instanceof Date) return toIso(value);
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';

  const text = String(value).trim();
  return text === '' ? EMPTY_LABEL : text;
}
