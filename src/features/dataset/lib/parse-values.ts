import type { DateOrder, DecimalSeparator } from './column-types';

/**
 * Un número completo, con separador de miles opcional y el decimal indicado.
 * Anclado por ambos extremos: `"12abc"` no es un número, y aceptarlo como 12
 * escondería datos sucios en lugar de señalarlos.
 */
const NUMBER_PATTERN: Record<DecimalSeparator, RegExp> = {
  '.': /^[+-]?\d+(?:,\d{3})*(?:\.\d+)?$/,
  ',': /^[+-]?\d+(?:\.\d{3})*(?:,\d+)?$/,
};

export function parseNumber(text: string, decimal: DecimalSeparator): number | null {
  const trimmed = text.trim();
  if (!NUMBER_PATTERN[decimal].test(trimmed)) return null;

  const thousands = decimal === '.' ? ',' : '.';
  const normalized = trimmed.split(thousands).join('').replace(decimal, '.');
  const value = Number(normalized);

  return Number.isFinite(value) ? value : null;
}

const ISO_PATTERN = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/;
const SLASHED_PATTERN = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/;

/**
 * Fechas en ISO (siempre) o con separadores, según el orden de la columna.
 * Nunca se delega en `new Date(texto)`: su comportamiento con formatos no ISO
 * depende del navegador y convierte silenciosamente basura en fechas.
 */
export function parseDate(text: string, order: DateOrder): Date | null {
  const trimmed = text.trim();

  const iso = ISO_PATTERN.exec(trimmed);
  if (iso) return buildDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  if (order === 'iso') return null;

  const parts = SLASHED_PATTERN.exec(trimmed);
  if (!parts) return null;

  const first = Number(parts[1]);
  const second = Number(parts[2]);
  const [day, month] = order === 'dmy' ? [first, second] : [second, first];

  return buildDate(Number(parts[3]), month, day);
}

/**
 * `new Date(2026, 1, 31)` no falla: desborda al 3 de marzo. Comprobamos que los
 * componentes sobreviven al viaje de ida y vuelta para rechazar el 31 de febrero.
 */
function buildDate(year: number, month: number, day: number): Date | null {
  const date = new Date(year, month - 1, day);

  const survives =
    date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;

  return survives ? date : null;
}

// `1`/`0` quedan fuera a propósito: son números, y tratarlos como booleanos
// convertiría cualquier columna de cantidades binarias en categórica.
const TRUE_WORDS = new Set(['true', 'verdadero', 'sí', 'si', 'yes']);
const FALSE_WORDS = new Set(['false', 'falso', 'no']);

export function parseBoolean(text: string): boolean | null {
  const normalized = text.trim().toLowerCase();

  if (TRUE_WORDS.has(normalized)) return true;
  if (FALSE_WORDS.has(normalized)) return false;

  return null;
}
