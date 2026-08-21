import { describe, expect, it } from 'vitest';
import type { AnalysisRow } from '@/features/analysis/types';
import { computeCohorts } from './cohorts';

function makeRow(
  dims: Record<string, string>,
  values: Record<string, number>,
  day: string,
): AnalysisRow {
  return { dims, values, day };
}

describe('computeCohorts', () => {
  it('returns null on empty rows', () => {
    const result = computeCohorts([], {
      customerDim: 'cliente',
      dateColumn: 'fecha',
      amountColumn: 'importe',
      grain: 'mes',
    });
    expect(result).toBeNull();
  });

  it('correctly builds monthly cohort matrix and retention rates', () => {
    const rows: AnalysisRow[] = [
      // Cohorte 2024-01: Cliente 1 y Cliente 2
      makeRow({ cliente: 'C1' }, { importe: 100 }, '2024-01-15'),
      makeRow({ cliente: 'C2' }, { importe: 100 }, '2024-01-20'),

      // En 2024-02: solo C1 vuelve a comprar (M1 = 1 de 2 = 50%)
      makeRow({ cliente: 'C1' }, { importe: 120 }, '2024-02-10'),

      // En 2024-03: tanto C1 como C2 vuelven a comprar (M2 = 2 de 2 = 100%)
      makeRow({ cliente: 'C1' }, { importe: 80 }, '2024-03-05'),
      makeRow({ cliente: 'C2' }, { importe: 150 }, '2024-03-25'),

      // Cohorte 2024-02: Cliente 3
      makeRow({ cliente: 'C3' }, { importe: 200 }, '2024-02-05'),
      // En 2024-03: C3 repite (M1 = 1 de 1 = 100%)
      makeRow({ cliente: 'C3' }, { importe: 250 }, '2024-03-12'),
    ];

    const result = computeCohorts(rows, {
      customerDim: 'cliente',
      dateColumn: 'fecha',
      amountColumn: 'importe',
      grain: 'mes',
    });

    expect(result).not.toBeNull();
    if (!result) return;

    expect(result.summary.totalCohorts).toBe(2);
    expect(result.summary.totalCustomers).toBe(3);

    const c1 = result.cohorts.find((c) => c.cohort === '2024-01');
    expect(c1).toBeDefined();
    expect(c1?.initialCustomers).toBe(2);
    expect(c1?.initialRevenue).toBe(200);

    // M0
    expect(c1?.periods[0]?.activeCustomers).toBe(2);
    expect(c1?.periods[0]?.customerRetentionRate).toBe(100);

    // M1 (Feb) -> 1 customer (50%)
    expect(c1?.periods[1]?.activeCustomers).toBe(1);
    expect(c1?.periods[1]?.customerRetentionRate).toBe(50);
    expect(c1?.periods[1]?.revenue).toBe(120);

    // M2 (Mar) -> 2 customers (100%)
    expect(c1?.periods[2]?.activeCustomers).toBe(2);
    expect(c1?.periods[2]?.customerRetentionRate).toBe(100);

    const c2 = result.cohorts.find((c) => c.cohort === '2024-02');
    expect(c2?.initialCustomers).toBe(1);
    expect(c2?.periods[1]?.customerRetentionRate).toBe(100); // M1

    // Average Curve at M1: (50% + 100%) / 2 = 75%
    const avgM1 = result.averageCurve.find((p) => p.periodIndex === 1);
    expect(avgM1?.avgCustomerRetentionRate).toBeCloseTo(75, 1);
  });
});
