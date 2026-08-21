import { describe, expect, it } from 'vitest';
import type { AnalysisRow } from '@/features/analysis/types';
import { computeMixShift, computeSegmentComparison } from './segments';

describe('computeSegmentComparison', () => {
  const rows: AnalysisRow[] = [
    { day: null, dims: { canal: 'Online' }, values: { ventas: 100, margen: 20 } },
    { day: null, dims: { canal: 'Online' }, values: { ventas: 150, margen: 30 } },
    { day: null, dims: { canal: 'Tienda' }, values: { ventas: 200, margen: 50 } },
    { day: null, dims: { canal: 'Tienda' }, values: { ventas: 300, margen: 70 } },
  ];

  it('correctly aggregates Segment A vs Segment B sums and means', () => {
    const res = computeSegmentComparison(rows, {
      segmentDim: 'canal',
      segmentAValues: ['Online'],
      segmentBValues: ['Tienda'],
      primaryMeasure: 'ventas',
      allMeasures: ['ventas', 'margen'],
    });

    expect(res.countA).toBe(2);
    expect(res.countB).toBe(2);

    const ventas = res.metrics.find((m) => m.metric === 'ventas');
    expect(ventas).toBeDefined();
    expect(ventas!.sumA).toBe(250);
    expect(ventas!.sumB).toBe(500);
    expect(ventas!.meanA).toBe(125);
    expect(ventas!.meanB).toBe(250);
    expect(ventas!.deltaSumAbs).toBe(250);
    expect(ventas!.deltaSumPct).toBe(100); // +100%
  });

  it('handles empty segments without crashing', () => {
    const res = computeSegmentComparison(rows, {
      segmentDim: 'canal',
      segmentAValues: ['Inexistente'],
      segmentBValues: ['Online'],
      primaryMeasure: 'ventas',
    });

    expect(res.countA).toBe(0);
    expect(res.countB).toBe(2);
    expect(res.metrics[0]!.sumA).toBe(0);
    expect(res.metrics[0]!.deltaSumPct).toBeNull();
  });
});

describe('computeMixShift', () => {
  // Setup where Segment A has high share of low-ticket (60% A1@100, 40% A2@200) -> Mean = 140
  // Segment B shifts to high-ticket (20% A1@100, 80% A2@200) -> Mean = 180
  // Rate effect is 0 (rates inside categories don't change), Mix effect is +40
  it('correctly isolates mix effect when category rates are constant', () => {
    const rowsA: AnalysisRow[] = [
      { day: null, dims: { cat: 'Bajo' }, values: { precio: 100 } },
      { day: null, dims: { cat: 'Bajo' }, values: { precio: 100 } },
      { day: null, dims: { cat: 'Bajo' }, values: { precio: 100 } },
      { day: null, dims: { cat: 'Alto' }, values: { precio: 200 } },
      { day: null, dims: { cat: 'Alto' }, values: { precio: 200 } },
    ]; // 3 Bajo @ 100, 2 Alto @ 200 -> mean = 700/5 = 140

    const rowsB: AnalysisRow[] = [
      { day: null, dims: { cat: 'Bajo' }, values: { precio: 100 } },
      { day: null, dims: { cat: 'Alto' }, values: { precio: 200 } },
      { day: null, dims: { cat: 'Alto' }, values: { precio: 200 } },
      { day: null, dims: { cat: 'Alto' }, values: { precio: 200 } },
      { day: null, dims: { cat: 'Alto' }, values: { precio: 200 } },
    ]; // 1 Bajo @ 100, 4 Alto @ 200 -> mean = 900/5 = 180

    const mix = computeMixShift(rowsA, rowsB, 'cat', 'precio');

    expect(mix.meanA).toBe(140);
    expect(mix.meanB).toBe(180);
    expect(mix.totalMeanDelta).toBe(40);

    // Sum of mix and rate effect must equal total mean delta
    expect(mix.totalMixEffect + mix.totalRateEffect).toBeCloseTo(40, 4);
    expect(mix.totalMixEffect).toBeCloseTo(40, 4);
    expect(mix.totalRateEffect).toBeCloseTo(0, 4);
  });
});
