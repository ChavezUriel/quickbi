import { describe, expect, it } from 'vitest';
import type { AnalysisRow } from '@/features/analysis/types';
import { computeChurn } from './churn';

function makeRow(cliente: string | null, fecha: string | null, importe?: number | null): AnalysisRow {
  const dims: Record<string, string> = {};
  if (cliente !== null) dims.cliente = cliente;
  const values: Record<string, number | null> = {};
  if (importe !== undefined) values.importe = importe;
  return {
    day: fecha,
    dims,
    values,
  };
}

describe('computeChurn', () => {
  it('handles empty rows cleanly', () => {
    const result = computeChurn([], {
      customerDim: 'cliente',
      dateColumn: 'fecha',
      amountColumn: 'importe',
    });

    expect(result.periods).toEqual([]);
    expect(result.customers).toEqual([]);
    expect(result.totalUniqueCustomers).toBe(0);
    expect(result.totalRevenue).toBe(0);
    expect(result.overallQuickRatio).toBeNull();
    expect(result.avgChurnRate).toBeNull();
    expect(result.avgRetentionRate).toBeNull();
    expect(result.ignoredRows).toBe(0);
  });

  it('ignores rows missing customer or date', () => {
    const rows: AnalysisRow[] = [
      makeRow(null, '2024-01-15', 100),
      makeRow('Alice', null, 100),
      makeRow('   ', '2024-01-15', 100),
      makeRow('Bob', '2024-01-20', 50),
    ];

    const result = computeChurn(rows, {
      customerDim: 'cliente',
      dateColumn: 'fecha',
      amountColumn: 'importe',
      grain: 'mes',
    });

    expect(result.ignoredRows).toBe(3);
    expect(result.totalUniqueCustomers).toBe(1);
    expect(result.periods).toHaveLength(1);
    expect(result.periods[0]?.activeCustomers).toBe(1);
    expect(result.periods[0]?.newCustomers).toBe(1);
  });

  it('computes correct movement for baseline single period', () => {
    const rows: AnalysisRow[] = [
      makeRow('Alice', '2024-01-10', 100),
      makeRow('Bob', '2024-01-15', 200),
    ];

    const result = computeChurn(rows, {
      customerDim: 'cliente',
      dateColumn: 'fecha',
      amountColumn: 'importe',
      grain: 'mes',
    });

    expect(result.periods).toHaveLength(1);
    const p1 = result.periods[0]!;
    expect(p1.activeCustomers).toBe(2);
    expect(p1.newCustomers).toBe(2);
    expect(p1.returningCustomers).toBe(0);
    expect(p1.reactivatedCustomers).toBe(0);
    expect(p1.churnedCustomers).toBe(0);
    expect(p1.churnRate).toBeNull();
    expect(p1.retentionRate).toBeNull();
    expect(p1.quickRatio).toBeNull();
    expect(p1.totalRevenue).toBe(300);
  });

  it('correctly tracks new, returning, reactivated, and churned dynamics across multi-periods', () => {
    const rows: AnalysisRow[] = [
      // Mes 1: Enero 2024 -> Alice y Bob
      makeRow('Alice', '2024-01-10', 100),
      makeRow('Bob', '2024-01-20', 200),

      // Mes 2: Febrero 2024 -> Alice (retorna) y Charlie (nuevo). Bob se pierde (churn).
      makeRow('Alice', '2024-02-05', 150),
      makeRow('Charlie', '2024-02-18', 300),

      // Mes 3: Marzo 2024 -> Bob (reactivado!) y Charlie (retorna). Alice se pierde.
      makeRow('Bob', '2024-03-12', 250),
      makeRow('Charlie', '2024-03-25', 350),
    ];

    const result = computeChurn(rows, {
      customerDim: 'cliente',
      dateColumn: 'fecha',
      amountColumn: 'importe',
      grain: 'mes',
    });

    expect(result.periods).toHaveLength(3);

    // Periodo 1 (2024-01)
    const p1 = result.periods[0]!;
    expect(p1.activeCustomers).toBe(2);
    expect(p1.newCustomers).toBe(2);
    expect(p1.totalRevenue).toBe(300);

    // Periodo 2 (2024-02)
    const p2 = result.periods[1]!;
    expect(p2.activeCustomers).toBe(2);
    expect(p2.newCustomers).toBe(1);
    expect(p2.returningCustomers).toBe(1);
    expect(p2.reactivatedCustomers).toBe(0);
    expect(p2.churnedCustomers).toBe(1);
    expect(p2.churnedRevenue).toBe(200);
    expect(p2.churnRate).toBe(50);
    expect(p2.retentionRate).toBe(50);
    expect(p2.quickRatio).toBe(1.0);
    expect(p2.totalRevenue).toBe(450);

    // Periodo 3 (2024-03)
    const p3 = result.periods[2]!;
    expect(p3.activeCustomers).toBe(2);
    expect(p3.newCustomers).toBe(0);
    expect(p3.returningCustomers).toBe(1);
    expect(p3.reactivatedCustomers).toBe(1);
    expect(p3.churnedCustomers).toBe(1);
    expect(p3.churnedRevenue).toBe(150);
    expect(p3.churnRate).toBe(50);
    expect(p3.retentionRate).toBe(50);
    expect(p3.quickRatio).toBe(1.0);
    expect(p3.totalRevenue).toBe(600);

    // Overall metrics
    expect(result.totalUniqueCustomers).toBe(3);
    expect(result.avgChurnRate).toBe(50);
    expect(result.avgRetentionRate).toBe(50);
    expect(result.overallQuickRatio).toBe(1.0);
  });

  it('works when amountColumn is omitted or null', () => {
    const rows: AnalysisRow[] = [
      makeRow('Alice', '2024-01-10'),
      makeRow('Alice', '2024-02-10'),
    ];

    const result = computeChurn(rows, {
      customerDim: 'cliente',
      dateColumn: 'fecha',
      amountColumn: null,
      grain: 'mes',
    });

    expect(result.periods).toHaveLength(2);
    expect(result.periods[1]?.returningCustomers).toBe(1);
    expect(result.periods[1]?.totalRevenue).toBe(0);
  });
});
