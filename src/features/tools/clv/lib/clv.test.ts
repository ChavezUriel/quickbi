import { describe, expect, it } from 'vitest';
import type { AnalysisRow } from '@/features/analysis/types';
import { computeClv } from './clv';

function makeRow(
  dims: Record<string, string>,
  values: Record<string, number>,
  day: string,
): AnalysisRow {
  return { dims, values, day };
}

describe('computeClv', () => {
  it('returns null on empty rows', () => {
    const result = computeClv([], {
      customerDim: 'cliente',
      amountColumn: 'importe',
      dateColumn: 'fecha',
      orderDim: null,
      churnDays: 180,
      marginRate: 1.0,
      projectionYears: 1,
      referenceDay: null,
    });
    expect(result).toBeNull();
  });

  it('calculates CLV, AOV, frequency and deciles for customers correctly', () => {
    const rows: AnalysisRow[] = [
      // Cliente A: 2 compras (100 + 150 = 250)
      makeRow({ cliente: 'A' }, { importe: 100 }, '2024-01-10'),
      makeRow({ cliente: 'A' }, { importe: 150 }, '2024-02-10'),

      // Cliente B: 1 compra (50)
      makeRow({ cliente: 'B' }, { importe: 50 }, '2024-01-15'),

      // Cliente C: 3 compras (200 + 300 + 500 = 1000)
      makeRow({ cliente: 'C' }, { importe: 200 }, '2024-01-01'),
      makeRow({ cliente: 'C' }, { importe: 300 }, '2024-03-01'),
      makeRow({ cliente: 'C' }, { importe: 500 }, '2024-05-01'),
    ];

    const result = computeClv(rows, {
      customerDim: 'cliente',
      amountColumn: 'importe',
      dateColumn: 'fecha',
      orderDim: null,
      churnDays: 90,
      marginRate: 1.0,
      projectionYears: 1,
      referenceDay: '2024-05-01',
    });

    expect(result).not.toBeNull();
    if (!result) return;

    expect(result.summary.totalCustomers).toBe(3);
    expect(result.summary.totalRevenue).toBe(1300); // 250 + 50 + 1000
    expect(result.summary.totalOrders).toBe(6);
    expect(result.summary.avgClv).toBeCloseTo(1300 / 3, 2);
    expect(result.summary.avgAov).toBeCloseTo(1300 / 6, 2);

    const clientC = result.customers.find((c) => c.id === 'C');
    expect(clientC?.rank).toBe(1);
    expect(clientC?.totalSpend).toBe(1000);
    expect(clientC?.orderCount).toBe(3);
    expect(clientC?.aov).toBeCloseTo(1000 / 3, 2);
    expect(clientC?.status).toBe('activo'); // bought on 2024-05-01 (recency 0 days <= 90)

    const clientB = result.customers.find((c) => c.id === 'B');
    expect(clientB?.totalSpend).toBe(50);
    expect(clientB?.orderCount).toBe(1);
    expect(clientB?.aov).toBe(50);

    expect(result.deciles.length).toBe(10);
    const sumRevenueShares = result.deciles.reduce((s, d) => s + d.revenueShare, 0);
    expect(sumRevenueShares).toBeCloseTo(100, 1);
  });

  it('determines churned and at risk statuses properly based on churn threshold', () => {
    const rows: AnalysisRow[] = [
      makeRow({ cliente: 'Active' }, { importe: 100 }, '2024-06-01'), // recency 0 days -> activo
      makeRow({ cliente: 'AtRisk' }, { importe: 100 }, '2024-03-01'), // recency 92 days -> en_riesgo (90 < 92 <= 180)
      makeRow({ cliente: 'Inactive' }, { importe: 100 }, '2023-10-01'), // recency 244 days -> inactivo (> 180)
    ];

    const result = computeClv(rows, {
      customerDim: 'cliente',
      amountColumn: 'importe',
      dateColumn: 'fecha',
      orderDim: null,
      churnDays: 90,
      marginRate: 1.0,
      projectionYears: 1,
      referenceDay: '2024-06-01',
    });

    expect(result).not.toBeNull();
    if (!result) return;

    expect(result.customers.find((c) => c.id === 'Active')?.status).toBe('activo');
    expect(result.customers.find((c) => c.id === 'AtRisk')?.status).toBe('en_riesgo');
    expect(result.customers.find((c) => c.id === 'Inactive')?.status).toBe('inactivo');
  });
});
