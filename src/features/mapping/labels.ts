import type { ColumnFormat, ColumnType } from '@/features/dataset/lib/column-types';
import type { Aggregation } from './types';

export const TYPE_LABEL: Record<ColumnType, string> = {
  number: 'Número',
  date: 'Fecha',
  boolean: 'Booleano',
  text: 'Texto',
  empty: 'Vacía',
};

/** `empty` queda fuera: no es una corrección que tenga sentido elegir. */
export const SELECTABLE_TYPES: ColumnType[] = ['number', 'date', 'boolean', 'text'];

export const AGGREGATION_LABEL: Record<Aggregation, string> = {
  sum: 'Suma',
  avg: 'Media',
  count: 'Recuento',
  min: 'Mínimo',
  max: 'Máximo',
};

export const AGGREGATIONS: Aggregation[] = ['sum', 'avg', 'count', 'min', 'max'];

/** Genitivo para la frase «la suma de…»; `count` cuenta filas, no una medida. */
export const AGGREGATION_PHRASE: Record<Aggregation, string> = {
  sum: 'la suma de',
  avg: 'la media de',
  count: 'el número de filas',
  min: 'el mínimo de',
  max: 'el máximo de',
};

/**
 * Hace visible cómo se está leyendo la columna. Un `1.234` interpretado como
 * 1,234 en vez de 1234 es un error silencioso salvo que se muestre.
 */
export function describeFormat(format: ColumnFormat): string | null {
  switch (format.kind) {
    case 'number':
      return format.decimal === ',' ? 'decimal con coma' : 'decimal con punto';
    case 'date':
      return format.order === 'iso'
        ? 'AAAA-MM-DD'
        : format.order === 'dmy'
          ? 'DD/MM/AAAA'
          : 'MM/DD/AAAA';
    case 'none':
      return null;
  }
}
