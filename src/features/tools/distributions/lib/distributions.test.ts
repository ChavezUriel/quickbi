import { describe, expect, it } from 'vitest';
import type { AnalysisRow } from '@/features/analysis/types';
import {
  calculateFiveNumberSummary,
  calculateHistogramBins,
  computeDistributions,
  quantile,
} from './distributions';

describe('quantile', () => {
  it('calculates exact percentiles on simple array', () => {
    const arr = [10, 20, 30, 40, 50];
    expect(quantile(arr, 0)).toBe(10);
    expect(quantile(arr, 0.5)).toBe(30);
    expect(quantile(arr, 1)).toBe(50);
    expect(quantile(arr, 0.25)).toBe(20);
    expect(quantile(arr, 0.75)).toBe(40);
  });

  it('handles empty and single element', () => {
    expect(quantile([], 0.5)).toBe(0);
    expect(quantile([42], 0.5)).toBe(42);
  });
});

describe('calculateFiveNumberSummary', () => {
  it('handles empty input gracefully', () => {
    const res = calculateFiveNumberSummary([]);
    expect(res.count).toBe(0);
    expect(res.median).toBe(0);
    expect(res.outliers).toEqual([]);
    expect(res.skewness).toBeNull();
  });

  it('computes 5-number summary correctly for uniform array', () => {
    const data = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    const res = calculateFiveNumberSummary(data);

    expect(res.min).toBe(1);
    expect(res.max).toBe(9);
    expect(res.median).toBe(5);
    expect(res.q1).toBe(3);
    expect(res.q3).toBe(7);
    expect(res.iqr).toBe(4);
    expect(res.mean).toBe(5);
    expect(res.outliers).toEqual([]);
    expect(res.skewness).not.toBeNull();
    expect(Math.abs(res.skewness!)).toBeLessThan(0.01); // Symmetric -> skewness ~ 0
  });

  it('identifies outliers beyond 1.5 * IQR', () => {
    const data = [10, 12, 12, 13, 14, 15, 15, 16, 18, 100]; // 100 is outlier
    const res = calculateFiveNumberSummary(data);

    expect(res.outliers).toContain(100);
    expect(res.skewness).toBeGreaterThan(1); // Right-skewed
  });

  it('filters null, undefined, and NaNs', () => {
    const data = [10, null, 20, undefined, NaN, 30];
    const res = calculateFiveNumberSummary(data);

    expect(res.count).toBe(3);
    expect(res.median).toBe(20);
  });
});

describe('calculateHistogramBins', () => {
  it('handles empty data', () => {
    const res = calculateHistogramBins([]);
    expect(res.bins.length).toBe(0);
  });

  it('creates bins covering the full range', () => {
    const data = [1, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50];
    const res = calculateHistogramBins(data, 5);

    expect(res.bins.length).toBe(5);
    const totalCount = res.bins.reduce((sum, b) => sum + b.count, 0);
    expect(totalCount).toBe(data.length);
    const totalPct = res.bins.reduce((sum, b) => sum + b.relativeFrequency, 0);
    expect(totalPct).toBeCloseTo(100, 2);
  });

  it('handles single unique value array', () => {
    const data = [5, 5, 5, 5];
    const res = calculateHistogramBins(data);
    expect(res.bins.length).toBe(1);
    expect(res.bins[0]!.count).toBe(4);
  });
});

describe('computeDistributions', () => {
  const rows: AnalysisRow[] = [
    { day: null, dims: { region: 'Norte' }, values: { ventas: 100 } },
    { day: null, dims: { region: 'Norte' }, values: { ventas: 120 } },
    { day: null, dims: { region: 'Sur' }, values: { ventas: 200 } },
    { day: null, dims: { region: 'Sur' }, values: { ventas: 300 } },
    { day: null, dims: { region: 'Sur' }, values: { ventas: 800 } }, // Sur outlier
  ];

  it('computes overall and group breakdown', () => {
    const res = computeDistributions(rows, 'ventas', 'region', 5);

    expect(res.overall.count).toBe(5);
    expect(res.groups).not.toBeNull();
    expect(res.groups!.length).toBe(2);

    const sur = res.groups!.find((g) => g.group === 'Sur');
    expect(sur).toBeDefined();
    expect(sur!.count).toBe(3);
    expect(sur!.summary.median).toBe(300);
  });
});
