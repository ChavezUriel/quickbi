import { describe, expect, it } from 'vitest';
import {
  EMPTY_FILTERS,
  getSelected,
  lastPeriods,
  matchesSelections,
  selectSingle,
  setDateCondition,
  setSelected,
  toggleSelected,
  withoutColumn,
} from './filters';
import type { AnalysisRow } from '../types';

const row = (dims: Record<string, string>): AnalysisRow => ({ day: null, dims, values: {} });

describe('selección de valores', () => {
  it('sustituye la selección con un clic simple', () => {
    const filters = selectSingle(EMPTY_FILTERS, 'zona', 'Norte');
    expect(getSelected(filters, 'zona')).toEqual(['Norte']);

    const replaced = selectSingle(filters, 'zona', 'Sur');
    expect(getSelected(replaced, 'zona')).toEqual(['Sur']);
  });

  it('limpia al volver a pulsar lo que ya era la única selección', () => {
    const filters = selectSingle(EMPTY_FILTERS, 'zona', 'Norte');
    expect(getSelected(selectSingle(filters, 'zona', 'Norte'), 'zona')).toEqual([]);
  });

  it('no limpia si había más de un valor seleccionado', () => {
    const filters = setSelected(EMPTY_FILTERS, 'zona', ['Norte', 'Sur']);
    expect(getSelected(selectSingle(filters, 'zona', 'Norte'), 'zona')).toEqual(['Norte']);
  });

  it('añade y quita con ctrl + clic', () => {
    let filters = toggleSelected(EMPTY_FILTERS, 'zona', 'Norte');
    filters = toggleSelected(filters, 'zona', 'Sur');
    expect(getSelected(filters, 'zona')).toEqual(['Norte', 'Sur']);

    filters = toggleSelected(filters, 'zona', 'Norte');
    expect(getSelected(filters, 'zona')).toEqual(['Sur']);
  });

  it('elimina la condición cuando la selección queda vacía', () => {
    const filters = setSelected(setSelected(EMPTY_FILTERS, 'zona', ['Norte']), 'zona', []);
    expect(filters.conditions).toEqual([]);
  });
});

describe('withoutColumn', () => {
  it('quita solo la condición de esa columna y conserva la fecha', () => {
    let filters = setSelected(EMPTY_FILTERS, 'zona', ['Norte']);
    filters = setSelected(filters, 'linea', ['A']);
    filters = setDateCondition(filters, lastPeriods('fecha', 3, 'mes'));

    const emitter = withoutColumn(filters, 'zona');

    expect(getSelected(emitter, 'zona')).toEqual([]);
    expect(getSelected(emitter, 'linea')).toEqual(['A']);
    expect(emitter.conditions.some((condition) => condition.op === 'ultimos_periodos')).toBe(
      true,
    );
  });
});

describe('matchesSelections', () => {
  it('exige que se cumplan todas las condiciones', () => {
    let filters = setSelected(EMPTY_FILTERS, 'zona', ['Norte']);
    filters = setSelected(filters, 'linea', ['A', 'B']);

    expect(matchesSelections(row({ zona: 'Norte', linea: 'A' }), filters)).toBe(true);
    expect(matchesSelections(row({ zona: 'Norte', linea: 'C' }), filters)).toBe(false);
    expect(matchesSelections(row({ zona: 'Sur', linea: 'A' }), filters)).toBe(false);
  });

  it('ignora la condición temporal, que resuelve el motor', () => {
    const filters = setDateCondition(EMPTY_FILTERS, lastPeriods('fecha', 3, 'mes'));
    expect(matchesSelections(row({ zona: 'Norte' }), filters)).toBe(true);
  });
});
