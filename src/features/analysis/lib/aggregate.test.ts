import { describe, expect, it } from 'vitest';
import {
  accumulate,
  bucketFor,
  newAccumulator,
  seriesValue,
  valueOf,
  type Accumulator,
} from './aggregate';
import { columnMetric, countMetric } from './metrics';
import type { AnalysisRow, MetricDef } from '../types';

describe('aggregate lib', () => {
  describe('newAccumulator', () => {
    it('creates an accumulator initialized to sum 0 and count 0', () => {
      expect(newAccumulator()).toEqual({ sum: 0, count: 0 });
    });
  });

  describe('bucketFor', () => {
    it('creates and returns a new accumulator if key does not exist in map', () => {
      const map = new Map<string, Accumulator>();
      const acc = bucketFor(map, 'norte');

      expect(acc).toEqual({ sum: 0, count: 0 });
      expect(map.get('norte')).toBe(acc);
    });

    it('returns existing accumulator if key already exists in map', () => {
      const map = new Map<string, Accumulator>();
      const existing = { sum: 10, count: 2 };
      map.set('norte', existing);

      const acc = bucketFor(map, 'norte');
      expect(acc).toBe(existing);
      expect(acc).toEqual({ sum: 10, count: 2 });
    });
  });

  describe('accumulate', () => {
    const row: AnalysisRow = {
      day: '2026-07-01',
      dims: { zona: 'Norte' },
      values: { ventas: 100, devoluciones: null, importe: 50 },
    };

    it('increments sum and count by 1 when metric column is null (count metric)', () => {
      const acc = newAccumulator();
      const metric = countMetric();

      accumulate(acc, row, metric);
      expect(acc).toEqual({ sum: 1, count: 1 });

      accumulate(acc, row, metric);
      expect(acc).toEqual({ sum: 2, count: 2 });
    });

    it('adds value to sum and increments count by 1 for valid numeric column values', () => {
      const acc = newAccumulator();
      const metric = columnMetric('ventas', 'sum', 'moneda');

      accumulate(acc, row, metric);
      expect(acc).toEqual({ sum: 100, count: 1 });
    });

    it('handles zero values correctly by adding 0 to sum and incrementing count', () => {
      const acc: Accumulator = { sum: 100, count: 5 };
      const zeroRow: AnalysisRow = { day: '2026-07-01', dims: {}, values: { importe: 0 } };
      const sumMetric = columnMetric('importe', 'sum', 'moneda');

      accumulate(acc, zeroRow, sumMetric);
      expect(acc).toEqual({ sum: 100, count: 6 });
    });

    it('handles negative values correctly', () => {
      const acc: Accumulator = { sum: 100, count: 2 };
      const negRow: AnalysisRow = { day: '2026-07-01', dims: {}, values: { importe: -25 } };
      const sumMetric = columnMetric('importe', 'sum', 'moneda');

      accumulate(acc, negRow, sumMetric);
      expect(acc).toEqual({ sum: 75, count: 3 });
    });

    it('handles floating point values correctly', () => {
      const acc: Accumulator = { sum: 10.5, count: 1 };
      const floatRow: AnalysisRow = { day: '2026-07-01', dims: {}, values: { importe: 4.25 } };
      const sumMetric = columnMetric('importe', 'sum', 'moneda');

      accumulate(acc, floatRow, sumMetric);
      expect(acc.sum).toBeCloseTo(14.75);
      expect(acc.count).toBe(2);
    });

    it('does nothing when row value is null', () => {
      const acc = newAccumulator();
      const metricNull = columnMetric('devoluciones', 'sum', 'moneda');

      accumulate(acc, row, metricNull);
      expect(acc).toEqual({ sum: 0, count: 0 });
    });

    it('does nothing when row value is undefined or column missing from values', () => {
      const acc = newAccumulator();
      const metricMissing = columnMetric('inexistente', 'sum', 'moneda');

      accumulate(acc, row, metricMissing);
      expect(acc).toEqual({ sum: 0, count: 0 });
    });
  });

  describe('valueOf', () => {
    it('returns sum when aggregation is sum', () => {
      expect(valueOf({ sum: 150, count: 5 }, 'sum')).toBe(150);
      expect(valueOf({ sum: -42, count: 3 }, 'sum')).toBe(-42);
      expect(valueOf({ sum: 0, count: 0 }, 'sum')).toBe(0);
    });

    it('returns count when aggregation is count', () => {
      expect(valueOf({ sum: 150, count: 5 }, 'count')).toBe(5);
      expect(valueOf({ sum: 0, count: 0 }, 'count')).toBe(0);
    });

    it('calculates average when aggregation is avg', () => {
      expect(valueOf({ sum: 100, count: 4 }, 'avg')).toBe(25);
      expect(valueOf({ sum: -30, count: 3 }, 'avg')).toBe(-10);
      expect(valueOf({ sum: 10, count: 3 }, 'avg')).toBeCloseTo(3.3333, 4);
    });

    it('returns 0 for avg when count is 0', () => {
      expect(valueOf({ sum: 0, count: 0 }, 'avg')).toBe(0);
      expect(valueOf({ sum: 50, count: 0 }, 'avg')).toBe(0);
    });
  });

  describe('seriesValue', () => {
    const metricSum: MetricDef = columnMetric('ventas', 'sum', 'moneda');
    const metricCumulative: MetricDef = {
      ...metricSum,
      cumulative: true,
    };

    it('returns null for count 0 in non-cumulative metrics', () => {
      const metricNonCumulative = columnMetric('ventas', 'avg', 'moneda');
      expect(seriesValue({ sum: 0, count: 0 }, metricNonCumulative)).toBeNull();
    });

    it('returns 0 for count 0 in cumulative metrics', () => {
      expect(seriesValue({ sum: 0, count: 0 }, metricCumulative)).toBe(0);
    });

    it('returns aggregated value when count is > 0', () => {
      expect(seriesValue({ sum: 200, count: 2 }, metricSum)).toBe(200);
    });
  });
});
