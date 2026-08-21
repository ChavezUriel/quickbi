import { describe, expect, it } from 'vitest';
import type { AnalysisRow } from '@/features/analysis/types';
import { computeInventory } from './inventory';

function makeRow(dims: Record<string, string>, values: Record<string, number> = {}): AnalysisRow {
  return {
    dims,
    values,
    day: '2024-01-01',
  };
}

describe('computeInventory', () => {
  it('returns empty summary for empty dataset', () => {
    const res = computeInventory([], { productDim: 'sku', stockColumn: 'stock' });
    expect(res.items).toEqual([]);
    expect(res.summary.totalStock).toBe(0);
    expect(res.summary.skuCount).toBe(0);
    expect(res.summary.avgTurnover).toBe(0);
    expect(res.summary.deadStockValue).toBe(0);
  });

  it('calculates turnover, DSI, and aging buckets correctly', () => {
    const rows: AnalysisRow[] = [
      // Fast-moving item: Stock 50, Sales 600 -> Turnover = 12, DSI = 30.4 -> <30 or 31-60
      makeRow({ sku: 'SKU-FAST', categoria: 'Electrónica' }, { stock: 50, ventas: 600 }),
      // Normal item: Stock 100, Sales 600 -> Turnover = 6, DSI = 60.8 -> 61-90
      makeRow({ sku: 'SKU-MED', categoria: 'Ropa' }, { stock: 100, ventas: 600 }),
      // Dead stock item: Stock 200, Sales 0 -> Turnover = 0, DSI = 999 -> over_90
      makeRow({ sku: 'SKU-DEAD', categoria: 'Hogar' }, { stock: 200, ventas: 0 }),
    ];

    const res = computeInventory(rows, {
      productDim: 'sku',
      stockColumn: 'stock',
      salesColumn: 'ventas',
      categoryDim: 'categoria',
      periodDays: 365,
    });

    expect(res.summary.totalStock).toBe(350);
    expect(res.summary.totalSales).toBe(1200);
    expect(res.summary.skuCount).toBe(3);

    const fast = res.items.find((i) => i.id === 'SKU-FAST');
    expect(fast?.turnover).toBe(12);
    expect(fast?.velocityCategory).toBe('alta');

    const dead = res.items.find((i) => i.id === 'SKU-DEAD');
    expect(dead?.turnover).toBe(0);
    expect(dead?.agingBucket).toBe('over_90');
    expect(dead?.velocityCategory).toBe('muerto');

    // Dead stock metrics
    expect(res.summary.deadStockValue).toBe(200);
    expect(res.summary.deadStockSkuCount).toBe(1);
    expect(res.summary.deadStockShare).toBe(57.14); // 200 / 350 * 100
  });

  it('uses explicit days column when available', () => {
    const rows: AnalysisRow[] = [
      makeRow({ sku: 'A' }, { stock: 100, ventas: 100, dias: 15 }), // < 30 days
      makeRow({ sku: 'B' }, { stock: 100, ventas: 100, dias: 45 }), // 31-60 days
      makeRow({ sku: 'C' }, { stock: 100, ventas: 100, dias: 75 }), // 61-90 days
      makeRow({ sku: 'D' }, { stock: 100, ventas: 100, dias: 120 }), // > 90 days
    ];

    const res = computeInventory(rows, {
      productDim: 'sku',
      stockColumn: 'stock',
      salesColumn: 'ventas',
      daysOrDateColumn: 'dias',
    });

    expect(res.items.find((i) => i.id === 'A')?.agingBucket).toBe('under_30');
    expect(res.items.find((i) => i.id === 'B')?.agingBucket).toBe('31_to_60');
    expect(res.items.find((i) => i.id === 'C')?.agingBucket).toBe('61_to_90');
    expect(res.items.find((i) => i.id === 'D')?.agingBucket).toBe('over_90');
  });

  it('calculates aging from date differences with reference day', () => {
    const rows: AnalysisRow[] = [
      makeRow({ sku: 'A', fecha_ingreso: '2024-01-01' }, { stock: 10 }),
    ];

    const res = computeInventory(rows, {
      productDim: 'sku',
      stockColumn: 'stock',
      daysOrDateColumn: 'fecha_ingreso',
      referenceDay: '2024-01-20', // 19 days difference -> under_30
    });

    const item = res.items[0];
    expect(item?.agingDays).toBe(19);
    expect(item?.agingBucket).toBe('under_30');
  });
});
