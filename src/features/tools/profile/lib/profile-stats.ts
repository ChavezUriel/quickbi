import {
  autoGranularity,
  bucketLabel,
  bucketOf,
  daysBetween,
  toIso,
} from '@/features/analysis/lib/dates';
import type { Granularity } from '@/features/analysis/types';
import type {
  ColumnProfile,
  ColumnRole,
  ColumnType,
} from '@/features/dataset/lib/column-types';
import { coerceValue } from '@/features/dataset/lib/infer-columns';
import type { DataRow } from '@/features/dataset/types';

/**
 * Perfil descriptivo del dataset: la radiografía que conviene mirar antes de
 * sacar conclusiones de nada.
 *
 * Una media no dice si media columna está vacía, y un total no dice si hay
 * filas duplicadas. Aquí se cuentan las dos cosas, columna a columna, con las
 * mismas conversiones que usará después el resto del análisis: lo que esta
 * herramienta llama inválido es exactamente lo que las demás descartarán.
 */

/** Barras del histograma de una columna numérica. */
const HISTOGRAM_BINS = 12;

/** Valores más frecuentes que se listan de una columna categórica. */
const TOP_VALUES = 8;

/** Tope de valores distintos que se rastrean: uno por fila sería un mapa inútil. */
const DISTINCT_CAP = 20_000;

/** Tope de filas que se comparan entre sí buscando duplicados. */
const DUPLICATE_SCAN_CAP = 200_000;

/** Máximo de barras de la distribución temporal antes de subir de grano. */
const MAX_DATE_BUCKETS = 36;

export interface HistogramBin {
  from: number;
  to: number;
  count: number;
}

export interface NumericStats {
  min: number;
  max: number;
  mean: number;
  median: number;
  p25: number;
  p75: number;
  stdDev: number;
  sum: number;
  zeros: number;
  negatives: number;
  histogram: HistogramBin[];
}

export interface DateBucket {
  label: string;
  count: number;
}

export interface DateStats {
  min: string;
  max: string;
  spanDays: number;
  grano: Granularity;
  buckets: DateBucket[];
}

export interface TopValue {
  value: string;
  count: number;
  /** Porcentaje sobre las filas con valor. */
  share: number;
}

export interface ColumnStats {
  name: string;
  type: ColumnType;
  role: ColumnRole;
  /** Filas del dataset. */
  total: number;
  /** Celdas vacías. */
  nulls: number;
  /** Celdas con contenido que no convierte al tipo de la columna. */
  invalid: number;
  /** Celdas que sí convierten. */
  valid: number;
  distinctCount: number;
  distinctCountExact: boolean;
  samples: string[];
  /** Un único valor en toda la columna: no sirve para agrupar. */
  constant: boolean;
  numeric: NumericStats | null;
  date: DateStats | null;
  /** Valores más frecuentes; solo en columnas categóricas. */
  top: TopValue[] | null;
}

export interface DatasetProfile {
  rowCount: number;
  columnCount: number;
  columns: ColumnStats[];
  /** Filas idénticas a otra anterior en todas sus columnas. */
  duplicateRows: number;
  /** `false` si el dataset era tan grande que se dejó de comparar. */
  duplicatesExact: boolean;
  /** Columnas sin un solo valor aprovechable. */
  emptyColumns: number;
  /** Porcentaje de celdas con contenido convertible sobre el total. */
  completeness: number;
}

export function profileDataset(
  rows: readonly DataRow[],
  columns: readonly ColumnProfile[],
): DatasetProfile {
  const stats = columns.map((column) => profileSingleColumn(rows, column));
  const cells = rows.length * columns.length;
  const valid = stats.reduce((sum, column) => sum + column.valid, 0);

  return {
    rowCount: rows.length,
    columnCount: columns.length,
    columns: stats,
    ...countDuplicates(rows, columns),
    emptyColumns: stats.filter((column) => column.valid === 0).length,
    completeness: cells === 0 ? 0 : (valid / cells) * 100,
  };
}

function profileSingleColumn(
  rows: readonly DataRow[],
  column: ColumnProfile,
): ColumnStats {
  let nulls = 0;
  let invalid = 0;
  const numbers: number[] = [];
  const days: string[] = [];
  const counts = new Map<string, number>();
  let overCap = false;

  for (const row of rows) {
    const raw = row[column.name] ?? null;
    if (raw === null || raw === '') {
      nulls += 1;
      continue;
    }

    const value = coerceValue(raw, column.type, column.format);
    if (value === null) {
      invalid += 1;
      continue;
    }

    if (typeof value === 'number') {
      numbers.push(value);
      continue;
    }

    if (value instanceof Date) {
      days.push(toIso(value));
      continue;
    }

    const label = typeof value === 'boolean' ? (value ? 'Sí' : 'No') : String(value);
    const seen = counts.get(label);
    if (seen !== undefined) {
      counts.set(label, seen + 1);
    } else if (counts.size < DISTINCT_CAP) {
      counts.set(label, 1);
    } else {
      overCap = true;
    }
  }

  const valid = rows.length - nulls - invalid;

  return {
    name: column.name,
    type: column.type,
    role: column.role,
    total: rows.length,
    nulls,
    invalid,
    valid,
    distinctCount: column.distinctCount,
    distinctCountExact: column.distinctCountExact && !overCap,
    samples: column.samples,
    constant: valid > 0 && column.distinctCount === 1,
    numeric: numbers.length > 0 ? numericStats(numbers) : null,
    date: days.length > 0 ? dateStats(days) : null,
    top: counts.size > 0 ? topValues(counts, valid) : null,
  };
}

export function numericStats(values: readonly number[]): NumericStats {
  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((total, value) => total + value, 0);
  const mean = sum / sorted.length;
  const variance =
    sorted.reduce((total, value) => total + (value - mean) ** 2, 0) / sorted.length;

  const min = sorted[0] ?? 0;
  const max = sorted[sorted.length - 1] ?? 0;

  return {
    min,
    max,
    mean,
    median: percentile(sorted, 0.5),
    p25: percentile(sorted, 0.25),
    p75: percentile(sorted, 0.75),
    stdDev: Math.sqrt(variance),
    sum,
    zeros: sorted.filter((value) => value === 0).length,
    negatives: sorted.filter((value) => value < 0).length,
    histogram: histogramOf(sorted, min, max),
  };
}

/**
 * Percentil por interpolación lineal, el mismo criterio que usan las hojas de
 * cálculo: con cuatro valores, la mediana es la media de los dos centrales.
 */
export function percentile(sorted: readonly number[], fraction: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0] ?? 0;

  const position = (sorted.length - 1) * fraction;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const low = sorted[lower] ?? 0;
  const high = sorted[upper] ?? low;

  return low + (high - low) * (position - lower);
}

function histogramOf(
  sorted: readonly number[],
  min: number,
  max: number,
): HistogramBin[] {
  // Una columna constante no tiene forma que enseñar: una sola barra con todo.
  if (min === max) return [{ from: min, to: max, count: sorted.length }];

  const width = (max - min) / HISTOGRAM_BINS;
  const bins: HistogramBin[] = Array.from({ length: HISTOGRAM_BINS }, (_, index) => ({
    from: min + width * index,
    to: min + width * (index + 1),
    count: 0,
  }));

  for (const value of sorted) {
    // El máximo cae en la última barra y no en una decimotercera.
    const index = Math.min(Math.floor((value - min) / width), HISTOGRAM_BINS - 1);
    const bin = bins[index];
    if (bin !== undefined) bin.count += 1;
  }

  return bins;
}

function dateStats(days: readonly string[]): DateStats {
  const sorted = [...days].sort();
  const min = sorted[0] ?? '';
  const max = sorted[sorted.length - 1] ?? '';
  const grano = coarseEnough(min, max);

  const counts = new Map<string, number>();
  for (const day of sorted) {
    const bucket = bucketOf(day, grano);
    counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
  }

  return {
    min,
    max,
    spanDays: daysBetween(min, max) + 1,
    grano,
    buckets: [...counts.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([bucket, count]) => ({ label: bucketLabel(bucket, grano), count })),
  };
}

/** Aproximación de días por período, para estimar cuántas barras saldrían. */
const DAYS_PER_UNIT: Record<Granularity, number> = {
  dia: 1,
  semana: 7,
  mes: 30,
  trimestre: 91,
  anio: 365,
};

const COARSER: Granularity[] = ['dia', 'semana', 'mes', 'trimestre', 'anio'];

/**
 * Grano con el que la distribución cabe en una tira de barras. El automático
 * de la evolución busca una serie legible; aquí hay todavía menos sitio, y por
 * eso puede seguir subiendo hasta el año.
 */
function coarseEnough(min: string, max: string): Granularity {
  const start = Math.max(COARSER.indexOf(autoGranularity({ desde: min, hasta: max })), 0);
  const span = daysBetween(min, max) + 1;

  for (const grano of COARSER.slice(start)) {
    if (span / DAYS_PER_UNIT[grano] <= MAX_DATE_BUCKETS) return grano;
  }
  return 'anio';
}

function topValues(counts: Map<string, number>, valid: number): TopValue[] {
  return [...counts.entries()]
    .sort(([, a], [, b]) => b - a)
    .slice(0, TOP_VALUES)
    .map(([value, count]) => ({
      value,
      count,
      share: valid === 0 ? 0 : (count / valid) * 100,
    }));
}

/**
 * Filas repetidas: idénticas en todas sus columnas. Es el error de carga más
 * frecuente —un fichero pegado dos veces— y el que más infla los totales.
 */
function countDuplicates(
  rows: readonly DataRow[],
  columns: readonly ColumnProfile[],
): { duplicateRows: number; duplicatesExact: boolean } {
  const limit = Math.min(rows.length, DUPLICATE_SCAN_CAP);
  const seen = new Set<string>();
  let duplicates = 0;

  for (let index = 0; index < limit; index += 1) {
    const row = rows[index];
    if (row === undefined) continue;

    // Separador de unidad: un carácter que no aparece en una hoja de cálculo,
    // para que «ab | c» y «a | bc» no den la misma clave.
    const key = columns.map((column) => String(row[column.name] ?? '')).join('\u0000');
    if (seen.has(key)) {
      duplicates += 1;
    } else {
      seen.add(key);
    }
  }

  return { duplicateRows: duplicates, duplicatesExact: limit === rows.length };
}
