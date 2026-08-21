import { describe, expect, it } from 'vitest';
import type { AnalysisRow } from '@/features/analysis/types';
import { calculateGini, computePareto } from './pareto';

describe('calculateGini', () => {
  it('returns 0 for empty, single item, or all equal values', () => {
    expect(calculateGini([])).toBe(0);
    expect(calculateGini([100])).toBe(0);
    expect(calculateGini([50, 50, 50, 50])).toBe(0);
  });

  it('calculates high Gini coefficient for extreme inequality', () => {
    const data = [1, 1, 1, 1, 1000]; // 1 person has almost everything
    const gini = calculateGini(data);
    expect(gini).toBeGreaterThan(0.7);
  });

  it('calculates standard Gini on known small array', () => {
    const data = [1, 2, 3, 4, 5];
    const gini = calculateGini(data);
    // (2*(1*1 + 2*2 + 3*3 + 4*4 + 5*5) - (5+1)*15) / (5*15) = (2*55 - 90)/75 = 20/75 = 0.2667
    expect(gini).toBeCloseTo(0.2667, 3);
  });
});

describe('computePareto', () => {
  const rows: AnalysisRow[] = [
    { day: null, dims: { producto: 'P1' }, values: { ventas: 800 } }, // 80%
    { day: null, dims: { producto: 'P2' }, values: { ventas: 150 } }, // 15% (cum 95%)
    { day: null, dims: { producto: 'P3' }, values: { ventas: 30 } },  // 3% (cum 98%)
    { day: null, dims: { producto: 'P4' }, values: { ventas: 20 } },  // 2% (cum 100%)
  ];

  it('correctly ranks items, assigns ABC classes, and calculates shares', () => {
    const res = computePareto(rows, 'producto', 'ventas', { thresholdA: 80, thresholdB: 95 });

    expect(res.totalEntities).toBe(4);
    expect(res.totalValue).toBe(1000);

    expect(res.items[0]!.entity).toBe('P1');
    expect(res.items[0]!.share).toBe(80);
    expect(res.items[0]!.cumulativeShare).toBe(80);
    expect(res.items[0]!.classABC).toBe('A');

    expect(res.items[1]!.entity).toBe('P2');
    expect(res.items[1]!.share).toBe(15);
    expect(res.items[1]!.cumulativeShare).toBe(95);
    expect(res.items[1]!.classABC).toBe('B');

    expect(res.items[2]!.classABC).toBe('C');
    expect(res.items[3]!.classABC).toBe('C');

    expect(res.summaryABC.A.count).toBe(1);
    expect(res.summaryABC.A.valueShare).toBe(80);

    expect(res.summaryABC.B.count).toBe(1);
    expect(res.summaryABC.B.valueShare).toBe(15);

    expect(res.summaryABC.C.count).toBe(2);
    expect(res.summaryABC.C.valueShare).toBe(5);

    expect(res.concentration.entitiesFor80).toBe(1);
    expect(res.concentration.entitiesFor80Share).toBe(25); // 1 out of 4 = 25%
  });

  it('handles empty rows gracefully', () => {
    const res = computePareto([], 'producto', 'ventas');
    expect(res.totalEntities).toBe(0);
    expect(res.totalValue).toBe(0);
    expect(res.items).toEqual([]);
    expect(res.concentration.gini).toBe(0);
  });
});
