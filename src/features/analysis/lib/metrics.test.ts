import { describe, expect, it } from 'vitest';
import { columnMetric, countMetric, findMetric } from './metrics';
import { COUNT_METRIC_ID, type MetricDef } from '../types';

describe('countMetric', () => {
  it('returns default count metric definition', () => {
    const metric = countMetric();
    expect(metric).toEqual({
      id: COUNT_METRIC_ID,
      label: 'Número de filas',
      agg: 'count',
      column: null,
      format: 'numero',
      cumulative: true,
    });
  });
});

describe('columnMetric', () => {
  it('creates metric definition for non-avg aggregation with cumulative set to true', () => {
    const metric = columnMetric('ventas', 'sum', 'moneda');
    expect(metric).toEqual({
      id: 'sum:ventas',
      label: 'Suma de ventas',
      agg: 'sum',
      column: 'ventas',
      format: 'moneda',
      cumulative: true,
    });
  });

  it('creates metric definition for avg aggregation with cumulative set to false', () => {
    const metric = columnMetric('precio', 'avg', 'numero');
    expect(metric).toEqual({
      id: 'avg:precio',
      label: 'Media de precio',
      agg: 'avg',
      column: 'precio',
      format: 'numero',
      cumulative: false,
    });
  });
});

describe('findMetric', () => {
  const count = countMetric();
  const sales = columnMetric('ventas', 'sum', 'moneda');
  const metricsList: MetricDef[] = [count, sales];

  it('returns null when id is null', () => {
    expect(findMetric(metricsList, null)).toBeNull();
  });

  it('returns matching metric when id exists', () => {
    expect(findMetric(metricsList, COUNT_METRIC_ID)).toEqual(count);
    expect(findMetric(metricsList, 'sum:ventas')).toEqual(sales);
  });

  it('returns null when id is not in metrics list', () => {
    expect(findMetric(metricsList, 'non_existent_id')).toBeNull();
  });

  it('returns null when searching in an empty metrics array', () => {
    expect(findMetric([], COUNT_METRIC_ID)).toBeNull();
  });
});
