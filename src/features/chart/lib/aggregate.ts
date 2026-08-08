import type { ColumnProfile } from '@/features/dataset/lib/column-types';
import { coerceValue } from '@/features/dataset/lib/infer-columns';
import type { CellValue, DataRow } from '@/features/dataset/types';
import { needsMeasure, type Aggregation } from '@/features/mapping/types';
import type { CategorySort, DateGranularity } from '../types';

export const OTHERS_LABEL = 'Otros';

export interface AggregateSpec {
  /** Columna por la que se agrupa, con el tipo ya confirmado por el usuario. */
  dimension: ColumnProfile;
  /** `null` solo con la agregación `count`, que cuenta filas. */
  measure: ColumnProfile | null;
  aggregation: Aggregation;
  /** Solo aplica a dimensiones de fecha. */
  granularity: DateGranularity;
  sort: CategorySort;
  /** Ignorado en dimensiones de fecha (ver `ChartConfig.topN`). */
  topN: number | null;
}

export interface AggregateRow {
  /** Etiqueta de la categoría, ya formateada para mostrar. */
  label: string;
  value: number;
  /** Filas originales que aportan a esta categoría. */
  rowCount: number;
  /** La categoría «Otros» pliega las que quedan por debajo del top N. */
  isOthers: boolean;
}

export interface AggregateResult {
  rows: AggregateRow[];
  /**
   * Filas que no aportan a ninguna categoría porque la dimensión o la medida
   * no se pudieron convertir al tipo elegido. Se muestra junto al gráfico:
   * nada se descarta en silencio.
   */
  excludedCount: number;
  totalRows: number;
}

/**
 * Corazón del gráfico: agrupa las filas por la dimensión y combina la medida
 * según la agregación elegida. Consume exactamente los valores que acepta
 * `coerceValue`, de modo que lo que el gráfico pinta coincide con lo que el
 * usuario vio en el mapeo («N no convertibles»).
 */
export function aggregate(rows: readonly DataRow[], spec: AggregateSpec): AggregateResult {
  if (needsMeasure(spec.aggregation) && spec.measure === null) {
    throw new Error(`La agregación "${spec.aggregation}" necesita una medida.`);
  }

  const buckets = new Map<string, Bucket>();
  let excludedCount = 0;

  for (const row of rows) {
    const category = categoryOf(row[spec.dimension.name], spec);
    const contribution = category === null ? null : contributionOf(row, spec);

    if (category === null || contribution === null) {
      excludedCount += 1;
      continue;
    }

    const bucket = buckets.get(category.key);
    if (bucket === undefined) {
      buckets.set(category.key, {
        label: category.label,
        natural: category.natural,
        sum: contribution,
        count: 1,
        min: contribution,
        max: contribution,
      });
    } else {
      bucket.sum += contribution;
      bucket.count += 1;
      if (contribution < bucket.min) bucket.min = contribution;
      if (contribution > bucket.max) bucket.max = contribution;
    }
  }

  let valued = [...buckets.values()].map((bucket) => toValuedBucket(bucket, spec.aggregation));

  if (spec.topN !== null && spec.dimension.type !== 'date' && valued.length > spec.topN) {
    valued = foldIntoOthers(valued, spec.topN, spec.aggregation);
  }

  sortBuckets(valued, spec.sort);

  return {
    rows: valued.map((bucket) => ({
      label: bucket.label,
      value: bucket.value,
      rowCount: bucket.count,
      isOthers: bucket.isOthers,
    })),
    excludedCount,
    totalRows: rows.length,
  };
}

/** Acumulador por categoría: guarda lo necesario para cualquier agregación. */
interface Bucket {
  label: string;
  /** Orden natural: timestamp para fechas, 0/1 para booleanos, texto en minúsculas. */
  natural: number | string;
  sum: number;
  count: number;
  min: number;
  max: number;
}

type ValuedBucket = Bucket & { value: number; isOthers: boolean };

interface Category {
  /** Identidad de la categoría en el Map (independiente del idioma). */
  key: string;
  label: string;
  natural: number | string;
}

function categoryOf(value: CellValue | undefined, spec: AggregateSpec): Category | null {
  const coerced = coerceValue(value ?? null, spec.dimension.type, spec.dimension.format);
  if (coerced === null) return null;

  if (coerced instanceof Date) return dateCategory(coerced, spec.granularity);

  if (typeof coerced === 'boolean') {
    return { key: String(coerced), label: coerced ? 'Sí' : 'No', natural: coerced ? 1 : 0 };
  }

  const label = String(coerced);
  return { key: label, label, natural: label.toLocaleLowerCase('es') };
}

/**
 * Las fechas se construyen en hora local (ver `parseDate`), así que truncar
 * con los getters locales es coherente: el «2026-01-15» del CSV cae en el
 * cubo del 15 de enero sin sorpresas de zona horaria.
 */
function dateCategory(date: Date, granularity: DateGranularity): Category {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();

  switch (granularity) {
    case 'day': {
      const truncated = new Date(year, month, day);
      return {
        key: `${year}-${pad2(month + 1)}-${pad2(day)}`,
        label: truncated.toLocaleDateString('es-ES'),
        natural: truncated.getTime(),
      };
    }
    case 'week': {
      const dayOfWeek = date.getDay();
      const daysToSubtract = (dayOfWeek + 6) % 7;
      const truncated = new Date(year, month, day - daysToSubtract);
      const tYear = truncated.getFullYear();
      const tMonth = truncated.getMonth();
      const tDay = truncated.getDate();
      return {
        key: `${tYear}-W${pad2(tMonth + 1)}-${pad2(tDay)}`,
        label: `Semana del ${truncated.toLocaleDateString('es-ES')}`,
        natural: truncated.getTime(),
      };
    }
    case 'month': {
      const truncated = new Date(year, month, 1);
      return {
        key: `${year}-${pad2(month + 1)}`,
        label: new Intl.DateTimeFormat('es-ES', { month: 'short', year: 'numeric' }).format(
          truncated,
        ),
        natural: truncated.getTime(),
      };
    }
    case 'quarter': {
      const q = Math.floor(month / 3) + 1;
      const truncated = new Date(year, (q - 1) * 3, 1);
      return {
        key: `${year}-Q${q}`,
        label: `T${q} ${year}`,
        natural: truncated.getTime(),
      };
    }
    case 'year':
      return {
        key: String(year),
        label: String(year),
        natural: new Date(year, 0, 1).getTime(),
      };
  }
}

function contributionOf(row: DataRow, spec: AggregateSpec): number | null {
  // `count` cuenta filas: cada fila válida aporta uno y no mira ninguna medida.
  if (!needsMeasure(spec.aggregation)) return 1;

  // La guarda de `aggregate` garantiza que aquí la medida no es null.
  const measure = spec.measure as ColumnProfile;
  const coerced = coerceValue(row[measure.name] ?? null, measure.type, measure.format);

  return typeof coerced === 'number' ? coerced : null;
}

function toValuedBucket(bucket: Bucket, aggregation: Aggregation): ValuedBucket {
  let value: number;
  switch (aggregation) {
    case 'sum':
      value = bucket.sum;
      break;
    case 'avg':
      // Como en SQL AVG: dividen solo las filas que aportaron valor.
      value = bucket.sum / bucket.count;
      break;
    case 'count':
      value = bucket.count;
      break;
    case 'min':
      value = bucket.min;
      break;
    case 'max':
      value = bucket.max;
      break;
  }
  return { ...bucket, value, isOthers: false };
}

/**
 * Se queda con las `topN` categorías de mayor valor y pliega el resto en
 * «Otros». El plegado combina los acumuladores, no los valores: la media de
 * «Otros» es la media ponderada de sus categorías, no la media de las medias.
 */
function foldIntoOthers(
  buckets: ValuedBucket[],
  topN: number,
  aggregation: Aggregation,
): ValuedBucket[] {
  const byValue = [...buckets].sort(
    (a, b) => b.value - a.value || compareNatural(a, b),
  );
  const kept = byValue.slice(0, topN);
  const folded = byValue.slice(topN);

  const others: Bucket = {
    label: OTHERS_LABEL,
    natural: '',
    sum: folded.reduce((total, bucket) => total + bucket.sum, 0),
    count: folded.reduce((total, bucket) => total + bucket.count, 0),
    min: Math.min(...folded.map((bucket) => bucket.min)),
    max: Math.max(...folded.map((bucket) => bucket.max)),
  };

  return [...kept, { ...toValuedBucket(others, aggregation), isOthers: true }];
}

function sortBuckets(buckets: ValuedBucket[], sort: CategorySort): void {
  buckets.sort((a, b) => {
    // «Otros» siempre al final, sea cual sea el orden elegido.
    if (a.isOthers !== b.isOthers) return a.isOthers ? 1 : -1;
    if (sort === 'natural') return compareNatural(a, b);
    const byValue = sort === 'value-asc' ? a.value - b.value : b.value - a.value;
    return byValue !== 0 ? byValue : compareNatural(a, b);
  });
}

function compareNatural(a: Bucket, b: Bucket): number {
  if (typeof a.natural === 'number' && typeof b.natural === 'number') {
    return a.natural - b.natural;
  }
  return String(a.natural).localeCompare(String(b.natural), 'es');
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}
