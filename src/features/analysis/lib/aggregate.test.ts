import { describe, expect, it } from 'vitest';
import {
  accumulate,
  bucketFor,
  newAccumulator,
  seriesValue,
  valueOf,
  type Accumulator,
} from './aggregate';
import type { AnalysisRow, MetricDef } from '../types';

describe('aggregate lib', () => {
  describe('newAccumulator', () => {
    it('creates an accumulator initialized to sum 0 and count 0', () => {
      const acc = newAccumulator();
      expect(acc).toEqual({ sum: 0, count: 0 });
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
    const countMetric: MetricDef = {
      id: '__filas__',
      label: 'Recuento',
      agg: 'count',
      column: null,
      format: 'numero',
      cumulative: true,
    };

    const sumMetric: MetricDef = {
      id: 'importe',
      label: 'Importe',
      agg: 'sum',
      column: 'importe',
      format: 'moneda',
      cumulative: true,
    };

    it('increments sum and count by 1 when metric column is null (count metric)', () => {
      const acc: Accumulator = { sum: 0, count: 0 };
      const row: AnalysisRow = { day: '2026-07-01', dims: {}, values: {} };

      accumulate(acc, row, countMetric);
      expect(acc).toEqual({ sum: 1, count: 1 });

      accumulate(acc, row, countMetric);
      expect(acc).toEqual({ sum: 2, count: 2 });
    });

    it('adds value to sum and increments count by 1 for valid numeric column values', () => {
      const acc: Accumulator = { sum: 10, count: 1 };
      const row: AnalysisRow = { day: '2026-07-01', dims: {}, values: { importe: 50 } };

      accumulate(acc, row, sumMetric);
      expect(acc).toEqual({ sum: 60, count: 2 });
    });

    it('handles zero values correctly by adding 0 to sum and incrementing count', () => {
      const acc: Accumulator = { sum: 100, count: 5 };
      const row: AnalysisRow = { day: '2026-07-01', dims: {}, values: { importe: 0 } };

      accumulate(acc, row, sumMetric);
      expect(acc).toEqual({ sum: 100, count: 6 });
    });

    it('handles negative values correctly', () => {
      const acc: Accumulator = { sum: 100, count: 2 };
      const row: AnalysisRow = { day: '2026-07-01', dims: {}, values: { importe: -25 } };

      accumulate(acc, row, sumMetric);
      expect(acc).toEqual({ sum: 75, count: 3 });
    });

    it('handles floating point values correctly', () => {
      const acc: Accumulator = { sum: 10.5, count: 1 };
      const row: AnalysisRow = { day: '2026-07-01', dims: {}, values: { importe: 4.25 } };

      accumulate(acc, row, sumMetric);
      expect(acc.sum).toBeCloseTo(14.75);
      expect(acc.count).toBe(2);
    });

    it('does nothing when row value is null', () => {
      const acc: Accumulator = { sum: 100, count: 2 };
      const row: AnalysisRow = { day: '2026-07-01', dims: {}, values: { importe: null } };

      accumulate(acc, row, sumMetric);
      expect(acc).toEqual({ sum: 100, count: 2 });
    });

    it('does nothing when row value is undefined or column missing from values', () => {
      const acc: Accumulator = { sum: 100, count: 2 };
      const row: AnalysisRow = { day: '2026-07-01', dims: {}, values: {} };

      accumulate(acc, row, sumMetric);
      expect(acc).toEqual({ sum: 100, count: 2 });
    });
  });

  describe('valueOf', () => {
    it('returns sum when aggregation is sum', () => {
      const acc: Accumulator = { sum: 150, count: 3 };
      expect(valueOf(acc, 'sum')).toBe(150);
    });

    it('returns count when aggregation is count', () => {
      const acc: Accumulator = { sum: 150, count: 3 };
      expect(valueOf(acc, 'count')).toBe(3);
    });

    it('returns average when aggregation is avg', () => {
      const acc: Accumulator = { sum: 150, count: 3 };
      expect(valueOf(acc, 'avg')).toBe(50);
    });

    it('returns 0 for avg when count is 0', () => {
      const acc: Accumulator = { sum: 0, count: 0 };
      expect(valueOf(acc, 'avg')).toBe(0);
    });
  });

  describe('seriesValue', () => {
    const cumulativeMetric: MetricDef = {
      id: 'importe',
      label: 'Importe',
      agg: 'sum',
      column: 'importe',
      format: 'moneda',
      cumulative: true,
    };

    const nonCumulativeMetric: MetricDef = {
      id: 'promedio',
      label: 'Promedio',
      agg: 'avg',
      column: 'importe',
      format: 'moneda',
      cumulative: false,
    };

    it('returns 0 for cumulative metrics when count is 0', () => {
      const acc: Accumulator = { sum: 0, count: 0 };
      expect(seriesValue(acc, cumulativeMetric)).toBe(0);
    });

    it('returns null for non-cumulative metrics when count is 0', () => {
      const acc: Accumulator = { sum: 0, count: 0 };
      expect(seriesValue(acc, nonCumulativeMetric)).toBeNull();
    });

    it('returns aggregated value when count is > 0', () => {
      const acc: Accumulator = { sum: 100, count: 4 };
      expect(seriesValue(acc, cumulativeMetric)).toBe(100);
      expect(seriesValue(acc, nonCumulativeMetric)).toBe(25);
    });
  });
});
