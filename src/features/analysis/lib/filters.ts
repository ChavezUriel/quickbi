import type {
  AnalysisRow,
  Condition,
  DateFilterMode,
  FilterSet,
  Granularity,
} from '../types';

/**
 * El conjunto de filtros es el estado compartido de toda la sección: los
 * widgets no se hablan entre ellos, escriben aquí. Todas las funciones
 * devuelven un conjunto nuevo (nada se muta) para que React vea el cambio.
 */

export const EMPTY_FILTERS: FilterSet = { conditions: [] };

export const MAX_MEMBERSHIP_VALUES = 200;

/** Valores seleccionados de una columna; vacío significa «todos». */
export function getSelected(filters: FilterSet, column: string): string[] {
  for (const condition of filters.conditions) {
    if (condition.op === 'in' && condition.column === column) return condition.values;
  }
  return [];
}

export function getMembership(
  filters: FilterSet,
  column: string,
): Extract<Condition, { op: 'in' | 'not_in' }> | null {
  return (
    filters.conditions.find(
      (condition): condition is Extract<Condition, { op: 'in' | 'not_in' }> =>
        (condition.op === 'in' || condition.op === 'not_in') && condition.column === column,
    ) ?? null
  );
}

export function setSelected(
  filters: FilterSet,
  column: string,
  values: readonly string[],
): FilterSet {
  const rest = filters.conditions.filter(
    (condition) =>
      !(
        (condition.op === 'in' || condition.op === 'not_in') && condition.column === column
      ),
  );

  return {
    conditions:
      values.length === 0 ? rest : [...rest, { op: 'in', column, values: [...values] }],
  };
}

export function setMembership(
  filters: FilterSet,
  column: string,
  op: 'in' | 'not_in',
  values: readonly string[],
): FilterSet {
  const rest = filters.conditions.filter(
    (condition) =>
      !(
        (condition.op === 'in' || condition.op === 'not_in') && condition.column === column
      ),
  );
  const bounded = [...new Set(values)].slice(0, MAX_MEMBERSHIP_VALUES);

  return {
    conditions:
      bounded.length === 0 ? rest : [...rest, { op, column, values: bounded }],
  };
}

export function toggleMembership(
  filters: FilterSet,
  column: string,
  value: string,
  op: 'in' | 'not_in' = getMembership(filters, column)?.op ?? 'in',
): FilterSet {
  const current = getMembership(filters, column);
  const values = current?.values ?? [];
  return setMembership(
    filters,
    column,
    op,
    values.includes(value) ? values.filter((item) => item !== value) : [...values, value],
  );
}

export function setRange(
  filters: FilterSet,
  column: string,
  min: number | null,
  max: number | null,
): FilterSet {
  const rest = filters.conditions.filter(
    (condition) => !(condition.op === 'rango' && condition.column === column),
  );
  if (min === null && max === null) return { conditions: rest };
  return { conditions: [...rest, { op: 'rango', column, min, max }] };
}

/** Ctrl/Cmd + clic: añade o quita sin perder el resto de la selección. */
export function toggleSelected(filters: FilterSet, column: string, value: string): FilterSet {
  const current = getSelected(filters, column);
  const next = current.includes(value)
    ? current.filter((item) => item !== value)
    : [...current, value];

  return setSelected(filters, column, next);
}

/**
 * Clic simple: si el elemento era la única selección, la limpia; si no, la
 * sustituye. Volver a pulsar lo que ya está filtrado deshace el filtro, que es
 * lo que espera quien acaba de pulsarlo.
 */
export function selectSingle(filters: FilterSet, column: string, value: string): FilterSet {
  const current = getSelected(filters, column);
  const isOnlySelection = current.length === 1 && current[0] === value;

  return setSelected(filters, column, isOnlySelection ? [] : [value]);
}

/**
 * El conjunto sin la condición de una columna. Es lo que hace de un widget un
 * «emisor»: se ve entero para poder cambiar la selección, mientras el resto de
 * la sección ya está filtrada.
 */
export function withoutColumn(filters: FilterSet, column: string): FilterSet {
  return {
    conditions: filters.conditions.filter(
      (condition) => {
        if ('column' in condition && condition.column === column) {
          return condition.op === 'entre_fechas' || condition.op === 'ultimos_periodos';
        }
        return true;
      },
    ),
  };
}

export type DateCondition = Extract<
  Condition,
  { op: 'entre_fechas' } | { op: 'ultimos_periodos' }
>;

export function getDateCondition(filters: FilterSet): DateCondition | null {
  for (const condition of filters.conditions) {
    if (condition.op === 'entre_fechas' || condition.op === 'ultimos_periodos') {
      return condition;
    }
  }
  return null;
}

export function setDateCondition(
  filters: FilterSet,
  condition: DateCondition | null,
): FilterSet {
  const rest = filters.conditions.filter(
    (existing) => existing.op !== 'entre_fechas' && existing.op !== 'ultimos_periodos',
  );

  return { conditions: condition === null ? rest : [...rest, condition] };
}

export function lastPeriods(column: string, n: number, unit: Granularity): DateCondition {
  return { op: 'ultimos_periodos', column, n, unit, modo: 'ultimos' };
}

export function lastPeriodsWithMode(
  column: string,
  n: number,
  unit: Granularity,
  modo: DateFilterMode,
): DateCondition {
  return { op: 'ultimos_periodos', column, n, unit, modo };
}

/** Filtros de dimensión activos, para pintarlos y poder quitarlos uno a uno. */
export function activeSelections(filters: FilterSet): { column: string; values: string[] }[] {
  return filters.conditions
    .filter((condition): condition is Extract<Condition, { op: 'in' }> => condition.op === 'in')
    .map(({ column, values }) => ({ column, values }));
}

export function hasSelections(filters: FilterSet): boolean {
  return filters.conditions.some(
    (condition) => condition.op === 'in' || condition.op === 'not_in',
  );
}

export function clearSelections(filters: FilterSet): FilterSet {
  return {
    conditions: filters.conditions.filter(
      (condition) => condition.op !== 'in' && condition.op !== 'not_in' && condition.op !== 'rango',
    ),
  };
}

/**
 * `AND` de las condiciones de dimensión. La ventana temporal no se comprueba
 * aquí: la resuelve el motor una sola vez y particiona las filas por fecha.
 */
export function matchesSelections(row: AnalysisRow, filters: FilterSet): boolean {
  for (const condition of filters.conditions) {
    if (condition.op === 'in') {
      if (condition.values.length === 0) continue;
      const value = row.dims[condition.column];
      if (value === undefined || !condition.values.includes(value)) return false;
    }

    if (condition.op === 'not_in') {
      const value = row.dims[condition.column];
      if (value !== undefined && condition.values.includes(value)) return false;
    }

    if (condition.op === 'rango') {
      const value = row.values[condition.column];
      if (value === null || value === undefined) return false;
      if (condition.min !== null && value < condition.min) return false;
      if (condition.max !== null && value > condition.max) return false;
    }
  }

  return true;
}
