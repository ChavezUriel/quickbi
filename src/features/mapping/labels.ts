import type { ColumnFormat, ColumnSubtype, ColumnType } from '@/features/dataset/lib/column-types';
export { SUBTYPE_LABEL } from '@/components/icons/data-type-icons';

export const TYPE_LABEL: Record<ColumnType, string> = {
  number: 'Número',
  date: 'Fecha',
  boolean: 'Booleano',
  text: 'Texto',
  empty: 'Vacía',
};

/** `empty` queda fuera: no es una corrección que tenga sentido elegir. */
export const SELECTABLE_TYPES: ColumnType[] = ['number', 'date', 'boolean', 'text'];

/** Subtipos / características semánticas disponibles según el tipo base de dato. */
export const SELECTABLE_SUBTYPES_BY_TYPE: Record<ColumnType, ColumnSubtype[]> = {
  number: ['decimal', 'currency', 'percentage', 'integer', 'duration'],
  text: ['text', 'geo', 'product', 'customer', 'identifier', 'funnel_stage'],
  date: ['date', 'datetime', 'period'],
  boolean: ['boolean'],
  empty: ['empty'],
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

