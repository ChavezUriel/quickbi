import { describe, expect, it } from 'vitest';
import type { AnalysisRow } from '@/features/analysis/types';
import { computeWaterfall } from './waterfall';

function makeRow(dims: Record<string, string>, values: Record<string, number>, day: string): AnalysisRow {
  return { dims, values, day };
}

describe('computeWaterfall', () => {
  it('returns null on empty rows', () => {
    const result = computeWaterfall([], {
      dimension: 'cat',
      measure: 'amount',
      splitMode: 'mitades',
      periodUnit: 'mes',
      maxCategories: 10,
    });
    expect(result).toBeNull();
  });

  it('correctly calculates growth, contraction, new, and lost categories across two periods', () => {
    const rows: AnalysisRow[] = [
      // Período 1: 2024-01-01 a 2024-01-15
      makeRow({ cat: 'A' }, { amount: 100 }, '2024-01-02'),
      makeRow({ cat: 'B' }, { amount: 200 }, '2024-01-05'),
      makeRow({ cat: 'D' }, { amount: 50 }, '2024-01-10'), // Perdido en P2

      // Período 2: 2024-01-16 a 2024-01-31
      makeRow({ cat: 'A' }, { amount: 150 }, '2024-01-20'), // Crecimiento +50
      makeRow({ cat: 'B' }, { amount: 80 }, '2024-01-25'), // Contracción -120
      makeRow({ cat: 'C' }, { amount: 70 }, '2024-01-28'), // Nuevo +70
    ];

    const result = computeWaterfall(rows, {
      dimension: 'cat',
      measure: 'amount',
      splitMode: 'mitades',
      periodUnit: 'mes',
      maxCategories: 10,
    });

    expect(result).not.toBeNull();
    if (!result) return;

    expect(result.totalP1).toBe(350); // 100 + 200 + 50
    expect(result.totalP2).toBe(300); // 150 + 80 + 70
    expect(result.netDiff).toBe(-50);
    expect(result.netDiffPct).toBeCloseTo((-50 / 350) * 100, 2);

    const catA = result.items.find((i) => i.category === 'A');
    expect(catA?.type).toBe('crecimiento');
    expect(catA?.diff).toBe(50);
    expect(catA?.diffPct).toBe(50);

    const catB = result.items.find((i) => i.category === 'B');
    expect(catB?.type).toBe('contraccion');
    expect(catB?.diff).toBe(-120);

    const catC = result.items.find((i) => i.category === 'C');
    expect(catC?.type).toBe('nuevo');
    expect(catC?.diff).toBe(70);

    const catD = result.items.find((i) => i.category === 'D');
    expect(catD?.type).toBe('perdido');
    expect(catD?.diff).toBe(-50);

    expect(result.buckets.newAmount).toBe(70);
    expect(result.buckets.growthAmount).toBe(50);
    expect(result.buckets.shrinkageAmount).toBe(-120);
    expect(result.buckets.lostAmount).toBe(-50);
  });

  it('aggregates excess categories into Resto when maxCategories is exceeded', () => {
    const rows: AnalysisRow[] = [
      makeRow({ cat: 'C1' }, { amount: 10 }, '2024-01-01'),
      makeRow({ cat: 'C2' }, { amount: 20 }, '2024-01-01'),
      makeRow({ cat: 'C3' }, { amount: 30 }, '2024-01-01'),
      makeRow({ cat: 'C4' }, { amount: 40 }, '2024-01-01'),

      makeRow({ cat: 'C1' }, { amount: 100 }, '2024-01-30'), // diff +90
      makeRow({ cat: 'C2' }, { amount: 10 }, '2024-01-30'), // diff -10
      makeRow({ cat: 'C3' }, { amount: 50 }, '2024-01-30'), // diff +20
      makeRow({ cat: 'C4' }, { amount: 45 }, '2024-01-30'), // diff +5
    ];

    const result = computeWaterfall(rows, {
      dimension: 'cat',
      measure: 'amount',
      splitMode: 'mitades',
      periodUnit: 'mes',
      maxCategories: 2,
    });

    expect(result).not.toBeNull();
    if (!result) return;

    // Limit 2 => 2 top categories + 1 'Resto'
    expect(result.items.length).toBe(3);
    expect(result.items[0]?.category).toBe('C1'); // |+90|
    expect(result.items[1]?.category).toBe('C3'); // |+20|
    expect(result.items[2]?.category).toContain('Resto');
  });

  it('generates correct ECharts bridge steps starting with P1 and ending with P2', () => {
    const rows: AnalysisRow[] = [
      makeRow({ cat: 'A' }, { amount: 100 }, '2024-01-01'),
      makeRow({ cat: 'A' }, { amount: 160 }, '2024-01-20'),
    ];

    const result = computeWaterfall(rows, {
      dimension: 'cat',
      measure: 'amount',
      splitMode: 'mitades',
      periodUnit: 'mes',
      maxCategories: 5,
    });

    expect(result).not.toBeNull();
    if (!result) return;

    expect(result.bridgeSteps[0]?.name).toBe('P1: Inicio');
    expect(result.bridgeSteps[0]?.barValue).toBe(100);
    expect(result.bridgeSteps[result.bridgeSteps.length - 1]?.name).toBe('P2: Final');
    expect(result.bridgeSteps[result.bridgeSteps.length - 1]?.barValue).toBe(160);
  });
});
