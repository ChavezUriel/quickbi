import { describe, expect, it } from 'vitest';
import { columnMetric, countMetric } from '@/features/analysis/lib/metrics';
import type { AnalysisRow } from '@/features/analysis/types';
import { computePivot, OTHERS_LABEL, type PivotAxis } from './pivot';

function row(zona: string, canal: string, importe: number | null): AnalysisRow {
  return { day: null, dims: { zona, canal }, values: { importe } };
}

function axis(dim: string, max = 10, sort: PivotAxis['sort'] = 'total'): PivotAxis {
  return {
    keyOf: (item) => item.dims[dim] ?? '',
    labelOf: (key) => key,
    sort,
    max,
  };
}

const ROWS: AnalysisRow[] = [
  row('Norte', 'Web', 100),
  row('Norte', 'Tienda', 50),
  row('Sur', 'Web', 30),
  row('Sur', 'Web', 20),
];

const SUM = columnMetric('importe', 'sum', 'numero');

describe('computePivot', () => {
  it('cruza dos dimensiones y cuadra los totales', () => {
    const table = computePivot(ROWS, { row: axis('zona'), col: axis('canal'), metric: SUM });

    expect(table.rows.map((header) => header.label)).toEqual(['Norte', 'Sur']);
    expect(table.grandTotal).toBe(200);
    expect(table.rowTotals).toEqual([150, 50]);

    const web = table.cols.findIndex((header) => header.label === 'Web');
    expect(table.cells[0]?.[web]).toBe(100);
    expect(table.cells[1]?.[web]).toBe(50);
  });

  it('deja en blanco el cruce sin ninguna fila', () => {
    const table = computePivot(ROWS, { row: axis('zona'), col: axis('canal'), metric: SUM });
    const tienda = table.cols.findIndex((header) => header.label === 'Tienda');

    expect(table.cells[1]?.[tienda]).toBeNull();
  });

  it('sin eje de columnas deja una sola columna con el total', () => {
    const table = computePivot(ROWS, { row: axis('zona'), col: null, metric: SUM });

    expect(table.cols).toHaveLength(1);
    expect(table.cells[0]?.[0]).toBe(150);
  });

  it('ordena por total descendente', () => {
    const table = computePivot(ROWS, { row: axis('zona'), col: null, metric: SUM });
    expect(table.rows[0]?.label).toBe('Norte');
  });

  it('ordena por clave cuando se le pide', () => {
    const table = computePivot(
      [row('Sur', 'Web', 100), row('Norte', 'Web', 1)],
      { row: axis('zona', 10, 'clave'), col: null, metric: SUM },
    );
    expect(table.rows.map((header) => header.label)).toEqual(['Norte', 'Sur']);
  });

  it('pliega en «Otros» lo que no cabe, sin perder el total', () => {
    const table = computePivot(ROWS, { row: axis('zona', 1), col: null, metric: SUM });

    expect(table.rows.map((header) => header.label)).toEqual(['Norte', OTHERS_LABEL]);
    expect(table.cells[1]?.[0]).toBe(50);
    expect(table.hiddenRows).toBe(0);
    expect(table.rowTotals.reduce((sum, value) => sum + value, 0)).toBe(200);
  });

  it('no pliega una media: la deja fuera y avisa', () => {
    const avg = columnMetric('importe', 'avg', 'numero');
    const table = computePivot(ROWS, { row: axis('zona', 1), col: null, metric: avg });

    expect(table.rows).toHaveLength(1);
    expect(table.hiddenRows).toBe(1);
  });

  it('cuenta filas cuando la métrica no mira ninguna columna', () => {
    const table = computePivot(ROWS, {
      row: axis('zona'),
      col: null,
      metric: countMetric(),
    });

    expect(table.grandTotal).toBe(4);
    expect(table.rowTotals).toEqual([2, 2]);
  });

  it('ignora las celdas sin valor al promediar', () => {
    const rows = [row('Norte', 'Web', 100), row('Norte', 'Web', null)];
    const avg = columnMetric('importe', 'avg', 'numero');
    const table = computePivot(rows, { row: axis('zona'), col: null, metric: avg });

    expect(table.cells[0]?.[0]).toBe(100);
  });

  it('devuelve una tabla vacía sin filas', () => {
    const table = computePivot([], { row: axis('zona'), col: null, metric: SUM });

    expect(table.rows).toHaveLength(0);
    expect(table.grandTotal).toBe(0);
    expect(table.min).toBe(0);
    expect(table.max).toBe(0);
  });
});
