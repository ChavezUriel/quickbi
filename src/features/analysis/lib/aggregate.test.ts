import { describe, expect, it } from 'vitest';
import {
  accumulate,
  bucketFor,
  newAccumulator,
  seriesValue,
  valueOf,
} from './aggregate';
import { columnMetric, countMetric } from './metrics';
import type { AnalysisRow, MetricDef } from '../types';

describe('valueOf', () => {
  it('devuelve la suma cuando agg es sum', () => {
    expect(valueOf({ sum: 150, count: 5 }, 'sum')).toBe(150);
    expect(valueOf({ sum: -42, count: 3 }, 'sum')).toBe(-42);
    expect(valueOf({ sum: 0, count: 0 }, 'sum')).toBe(0);
  });

  it('devuelve el recuento cuando agg es count', () => {
    expect(valueOf({ sum: 150, count: 5 }, 'count')).toBe(5);
    expect(valueOf({ sum: 0, count: 0 }, 'count')).toBe(0);
  });

  it('calcula la media cuando agg es avg', () => {
    expect(valueOf({ sum: 100, count: 4 }, 'avg')).toBe(25);
    expect(valueOf({ sum: -30, count: 3 }, 'avg')).toBe(-10);
    expect(valueOf({ sum: 10, count: 3 }, 'avg')).toBeCloseTo(3.3333, 4);
  });

  it('devuelve 0 al calcular la media con un recuento de 0', () => {
    expect(valueOf({ sum: 0, count: 0 }, 'avg')).toBe(0);
    expect(valueOf({ sum: 50, count: 0 }, 'avg')).toBe(0);
  });
});

describe('newAccumulator', () => {
  it('inicializa suma y recuento a cero', () => {
    expect(newAccumulator()).toEqual({ sum: 0, count: 0 });
  });
});

describe('bucketFor', () => {
  it('crea un nuevo acumulador si la clave no existe', () => {
    const map = new Map();
    const acc = bucketFor(map, 'Norte');

    expect(acc).toEqual({ sum: 0, count: 0 });
    expect(map.get('Norte')).toBe(acc);
  });

  it('recupera el acumulador existente si la clave ya existía', () => {
    const map = new Map();
    const existing = { sum: 100, count: 2 };
    map.set('Norte', existing);

    const acc = bucketFor(map, 'Norte');
    expect(acc).toBe(existing);
  });
});

describe('accumulate', () => {
  const row: AnalysisRow = {
    day: '2026-07-01',
    dims: { zona: 'Norte' },
    values: { ventas: 100, devoluciones: null },
  };

  it('incrementa recuento y suma en 1 si la columna de la métrica es null', () => {
    const acc = newAccumulator();
    const metric = countMetric();

    accumulate(acc, row, metric);
    expect(acc).toEqual({ sum: 1, count: 1 });
  });

  it('acumula el valor de la columna cuando no es nulo', () => {
    const acc = newAccumulator();
    const metric = columnMetric('ventas', 'sum', 'moneda');

    accumulate(acc, row, metric);
    expect(acc).toEqual({ sum: 100, count: 1 });
  });

  it('ignora filas con valor nulo o indefinido', () => {
    const acc = newAccumulator();
    const metricNull = columnMetric('devoluciones', 'sum', 'moneda');
    const metricMissing = columnMetric('inexistente', 'sum', 'moneda');

    accumulate(acc, row, metricNull);
    expect(acc).toEqual({ sum: 0, count: 0 });

    accumulate(acc, row, metricMissing);
    expect(acc).toEqual({ sum: 0, count: 0 });
  });
});

describe('seriesValue', () => {
  const metricSum: MetricDef = columnMetric('ventas', 'sum', 'moneda');
  const metricCumulative: MetricDef = {
    ...metricSum,
    cumulative: true,
  };

  it('devuelve null para recuento 0 en métricas no acumulativas', () => {
    const metricNonCumulative = columnMetric('ventas', 'avg', 'moneda');
    expect(seriesValue({ sum: 0, count: 0 }, metricNonCumulative)).toBeNull();
  });

  it('devuelve 0 para recuento 0 en métricas acumulativas', () => {
    expect(seriesValue({ sum: 0, count: 0 }, metricCumulative)).toBe(0);
  });

  it('devuelve el resultado de valueOf cuando recuento > 0', () => {
    expect(seriesValue({ sum: 200, count: 2 }, metricSum)).toBe(200);
  });
});
