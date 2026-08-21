import { describe, expect, it } from 'vitest';
import type { AnalysisRow } from '@/features/analysis/types';
import { computeConcentration } from './concentration';

function makeRow(cliente: string | null, importe: number | null): AnalysisRow {
  const dims: Record<string, string> = {};
  if (cliente !== null) dims.cliente = cliente;
  const values: Record<string, number | null> = {};
  if (importe !== null) values.importe = importe;
  return {
    day: null,
    dims,
    values,
  };
}

describe('computeConcentration', () => {
  it('handles empty rows gracefully', () => {
    const result = computeConcentration([], {
      customerDim: 'cliente',
      amountColumn: 'importe',
    });

    expect(result.customerCount).toBe(0);
    expect(result.totalRevenue).toBe(0);
    expect(result.gini).toBe(0);
    expect(result.hhi).toBe(0);
    expect(result.riskLevel).toBe('bajo');
    expect(result.topCustomers).toEqual([]);
    expect(result.ignoredRows).toBe(0);
  });

  it('ignores invalid rows or non-positive revenues', () => {
    const rows: AnalysisRow[] = [
      makeRow(null, 100),
      makeRow('Alice', -50),
      makeRow('Bob', 0),
      makeRow('   ', 200),
      makeRow('Charlie', 500),
    ];

    const result = computeConcentration(rows, {
      customerDim: 'cliente',
      amountColumn: 'importe',
    });

    expect(result.ignoredRows).toBe(4);
    expect(result.customerCount).toBe(1);
    expect(result.totalRevenue).toBe(500);
  });

  it('computes exact Gini and HHI for perfect equality', () => {
    const rows: AnalysisRow[] = [
      makeRow('A', 100),
      makeRow('B', 100),
      makeRow('C', 100),
      makeRow('D', 100),
    ];

    const result = computeConcentration(rows, {
      customerDim: 'cliente',
      amountColumn: 'importe',
    });

    expect(result.customerCount).toBe(4);
    expect(result.totalRevenue).toBe(400);
    expect(result.gini).toBeCloseTo(0, 4);
    expect(result.top1Share).toBe(25);
    expect(result.hhi).toBe(2500);
  });

  it('evaluates extreme concentration and critical risk accurately', () => {
    const rows: AnalysisRow[] = [
      makeRow('Gigante', 910),
      ...Array.from({ length: 9 }, (_, i) => makeRow(`Pequeño_${i + 1}`, 10)),
    ];

    const result = computeConcentration(rows, {
      customerDim: 'cliente',
      amountColumn: 'importe',
    });

    expect(result.customerCount).toBe(10);
    expect(result.totalRevenue).toBe(1000);
    expect(result.top1Share).toBeCloseTo(91.0);
    expect(result.hhi).toBeGreaterThan(8000);
    expect(result.gini).toBeGreaterThan(0.8);
    expect(result.riskLevel).toBe('critico');
    expect(result.topCustomers[0]?.riskCategory).toBe('critico');
  });

  it('generates a valid Lorenz curve from 0% to 100%', () => {
    const rows: AnalysisRow[] = [
      makeRow('C1', 10),
      makeRow('C2', 20),
      makeRow('C3', 70),
    ];

    const result = computeConcentration(rows, {
      customerDim: 'cliente',
      amountColumn: 'importe',
    });

    expect(result.lorenzCurve[0]).toEqual({
      customerPercent: 0,
      revenuePercent: 0,
      equalityPercent: 0,
    });

    const lastPoint = result.lorenzCurve[result.lorenzCurve.length - 1]!;
    expect(lastPoint.customerPercent).toBe(100);
    expect(lastPoint.revenuePercent).toBe(100);
  });
});
