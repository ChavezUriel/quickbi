import {
  roleForType,
  type ColumnFormat,
  type ColumnProfile,
  type ColumnType,
  type DateOrder,
  type DecimalSeparator,
} from './column-types';
import { parseBoolean, parseDate, parseNumber } from './parse-values';
import type { CellValue, DataRow } from '../types';

/**
 * Fracción de valores no vacíos que debe encajar para aceptar un tipo.
 * No es 1 a propósito: una sola celda sucia («N/D» en una columna de importes)
 * no debería degradar toda la columna a texto y dejarla fuera de los gráficos.
 */
const TYPE_CONFIDENCE = 0.9;

/** Tope de valores distintos que contamos, para no retener un Set gigante. */
const DISTINCT_CAP = 1000;

const SAMPLE_COUNT = 3;

export function profileColumns(
  names: readonly string[],
  rows: readonly DataRow[],
): ColumnProfile[] {
  return names.map((name) => profileColumn(name, rows));
}

/**
 * Describe una columna: qué tipo tiene, cómo hay que leerla y en qué estado
 * están sus datos.
 *
 * `forcedType` permite reperfilar cuando el usuario corrige el tipo inferido,
 * de modo que vea inmediatamente cuántos valores no sobrevivirán a su elección.
 */
export function profileColumn(
  name: string,
  rows: readonly DataRow[],
  forcedType?: ColumnType,
): ColumnProfile {
  const present: CellValue[] = [];
  const distinct = new Set<string>();
  const samples: string[] = [];
  let nullCount = 0;
  let distinctCountExact = true;

  for (const row of rows) {
    const value = row[name];

    if (value === null || value === undefined) {
      nullCount += 1;
      continue;
    }

    present.push(value);

    if (samples.length < SAMPLE_COUNT) samples.push(displayValue(value));

    if (distinct.size < DISTINCT_CAP) distinct.add(displayValue(value));
    else distinctCountExact = false;
  }

  const detected = forcedType
    ? { type: forcedType, format: formatFor(forcedType, present) }
    : detectType(present);

  const invalidCount = present.reduce<number>(
    (invalid, value) =>
      coerceValue(value, detected.type, detected.format) === null ? invalid + 1 : invalid,
    0,
  );

  return {
    name,
    type: detected.type,
    format: detected.format,
    role: roleForType(detected.type),
    nullCount,
    invalidCount,
    distinctCount: distinct.size,
    distinctCountExact,
    samples,
  };
}

/**
 * Convierte un valor al tipo indicado, o `null` si no encaja.
 * Es también el puente hacia la agregación: el gráfico consumirá exactamente
 * los valores que esta función acepte.
 */
export function coerceValue(
  value: CellValue,
  type: ColumnType,
  format: ColumnFormat,
): CellValue | null {
  if (value === null) return null;

  switch (type) {
    case 'number':
      if (typeof value === 'number') return value;
      return parseNumber(displayValue(value), format.kind === 'number' ? format.decimal : '.');

    case 'date':
      if (value instanceof Date) return value;
      return parseDate(displayValue(value), format.kind === 'date' ? format.order : 'iso');

    case 'boolean':
      if (typeof value === 'boolean') return value;
      return parseBoolean(displayValue(value));

    case 'text':
      return displayValue(value);

    case 'empty':
      return null;
  }
}

interface Detection {
  type: ColumnType;
  format: ColumnFormat;
}

function detectType(present: readonly CellValue[]): Detection {
  if (present.length === 0) return { type: 'empty', format: { kind: 'none' } };

  // Excel entrega los valores ya tipados: el propio fichero declara el tipo,
  // así que no hay nada que adivinar.
  const native = detectNativeType(present);
  if (native) return native;

  return detectTextType(present);
}

function detectNativeType(present: readonly CellValue[]): Detection | null {
  let numbers = 0;
  let dates = 0;
  let booleans = 0;

  for (const value of present) {
    if (typeof value === 'number') numbers += 1;
    else if (value instanceof Date) dates += 1;
    else if (typeof value === 'boolean') booleans += 1;
  }

  if (meetsConfidence(numbers, present.length)) {
    return { type: 'number', format: { kind: 'number', decimal: '.' } };
  }
  if (meetsConfidence(dates, present.length)) {
    return { type: 'date', format: { kind: 'date', order: 'iso' } };
  }
  if (meetsConfidence(booleans, present.length)) {
    return { type: 'boolean', format: { kind: 'none' } };
  }

  return null;
}

/** Ruta del CSV, donde todo llega como texto y sí hay que inferir. */
function detectTextType(present: readonly CellValue[]): Detection {
  const texts = present.map(displayValue);

  // Booleanos primero: `parseBoolean` rechaza `1`/`0`, así que una columna
  // numérica no puede colarse aquí.
  if (meetsConfidence(countMatching(texts, (t) => parseBoolean(t) !== null), texts.length)) {
    return { type: 'boolean', format: { kind: 'none' } };
  }

  const decimal = bestDecimalSeparator(texts);
  if (meetsConfidence(countMatching(texts, (t) => parseNumber(t, decimal) !== null), texts.length)) {
    return { type: 'number', format: { kind: 'number', decimal } };
  }

  const order = bestDateOrder(texts);
  if (meetsConfidence(countMatching(texts, (t) => parseDate(t, order) !== null), texts.length)) {
    return { type: 'date', format: { kind: 'date', order } };
  }

  return { type: 'text', format: { kind: 'none' } };
}

function formatFor(type: ColumnType, present: readonly CellValue[]): ColumnFormat {
  const texts = present.map(displayValue);

  if (type === 'number') return { kind: 'number', decimal: bestDecimalSeparator(texts) };
  if (type === 'date') return { kind: 'date', order: bestDateOrder(texts) };

  return { kind: 'none' };
}

/**
 * `"1,5"` solo es número con coma decimal y `"1.5"` solo con punto, así que
 * contar aciertos basta para decidir. Empatan las columnas completamente
 * ambiguas (todo `"1.234"`), y ahí se opta por el punto: es la convención de
 * los ficheros exportados por herramientas.
 */
function bestDecimalSeparator(texts: readonly string[]): DecimalSeparator {
  const dot = countMatching(texts, (t) => parseNumber(t, '.') !== null);
  const comma = countMatching(texts, (t) => parseNumber(t, ',') !== null);

  return comma > dot ? ',' : '.';
}

/**
 * `dmy` y `mdy` aceptan también ISO, así que si ninguno supera al recuento de
 * ISO es que no había fechas con barras que desambiguar. Entre día-mes y
 * mes-día decide qué orden encaja en más filas (`13/01` solo puede ser D/M);
 * en caso de empate se prefiere el orden local español.
 */
function bestDateOrder(texts: readonly string[]): DateOrder {
  const iso = countMatching(texts, (t) => parseDate(t, 'iso') !== null);
  const dmy = countMatching(texts, (t) => parseDate(t, 'dmy') !== null);
  const mdy = countMatching(texts, (t) => parseDate(t, 'mdy') !== null);

  if (dmy === iso && mdy === iso) return 'iso';

  return mdy > dmy ? 'mdy' : 'dmy';
}

function meetsConfidence(matches: number, total: number): boolean {
  return total > 0 && matches / total >= TYPE_CONFIDENCE;
}

function countMatching(texts: readonly string[], matches: (text: string) => boolean): number {
  return texts.reduce((total, text) => (matches(text) ? total + 1 : total), 0);
}

/** Representación textual estable de una celda (las fechas en ISO, no en local). */
function displayValue(value: CellValue): string {
  if (value === null) return '';
  return value instanceof Date ? value.toISOString() : String(value);
}
