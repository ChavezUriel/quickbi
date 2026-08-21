import { describe, expect, it } from 'vitest';
import type { AnalysisRow } from '@/features/analysis/types';
import { computePriceVolume } from './price_volume';

function makeRow(
  producto: string | null,
  volumen: number | null,
  importe: number | null,
  fecha?: string | null,
): AnalysisRow {
  const dims: Record<string, string> = {};
  if (producto !== null) dims.producto = producto;
  if (fecha) dims.fecha = fecha;
  const values: Record<string, number | null> = {};
  if (volumen !== null) values.volumen = volumen;
  if (importe !== null) values.importe = importe;
  return {
    day: fecha ?? null,
    dims,
    values,
  };
}

describe('computePriceVolume', () => {
  it('handles empty rows gracefully', () => {
    const result = computePriceVolume([], {
      productDim: 'producto',
      volumeColumn: 'volumen',
      amountColumn: 'importe',
    });

    expect(result.points).toEqual([]);
    expect(result.totalRevenue).toBe(0);
    expect(result.totalVolume).toBe(0);
    expect(result.elasticity).toBeNull();
    expect(result.elasticityType).toBe('indeterminada');
    expect(result.ignoredRows).toBe(0);
  });

  it('ignores rows with non-positive volume or amount', () => {
    const rows: AnalysisRow[] = [
      makeRow(null, 10, 100),
      makeRow('P1', 0, 100),
      makeRow('P2', -5, 100),
      makeRow('P3', 10, 0),
      makeRow('Valido', 10, 200),
    ];

    const result = computePriceVolume(rows, {
      productDim: 'producto',
      volumeColumn: 'volumen',
      amountColumn: 'importe',
    });

    expect(result.ignoredRows).toBe(4);
    expect(result.points).toHaveLength(1);
    expect(result.totalRevenue).toBe(200);
    expect(result.totalVolume).toBe(10);
    expect(result.avgRealizedPrice).toBe(20);
  });

  it('calculates price elasticity of demand with linear regression fit', () => {
    // 4 productos con precios: 10, 20, 30, 40 y volumen: 100, 80, 60, 40
    // Q = 120 - 2 * P (b = -2). Media P = 25, Media Q = 70. Elasticidad = -2 * (25/70) = -0.714
    const rows: AnalysisRow[] = [
      makeRow('Prod A', 100, 1000), // P = 10
      makeRow('Prod B', 80, 1600),  // P = 20
      makeRow('Prod C', 60, 1800),  // P = 30
      makeRow('Prod D', 40, 1600),  // P = 40
    ];

    const result = computePriceVolume(rows, {
      productDim: 'producto',
      volumeColumn: 'volumen',
      amountColumn: 'importe',
      priceInputType: 'importe_total',
    });

    expect(result.points).toHaveLength(4);
    expect(result.totalVolume).toBe(280);
    expect(result.totalRevenue).toBe(6000);
    expect(result.elasticity).toBeCloseTo(-0.714, 2);
    expect(result.elasticityType).toBe('inelastica');
    expect(result.rSquared).toBeCloseTo(1.0, 2);
    expect(result.trendLine).not.toBeNull();
    expect(result.trendLine?.slope).toBeCloseTo(-2.0, 2);
  });

  it('computes Price-Volume-Mix (PVM) decomposition satisfying exact sum identity', () => {
    const rows: AnalysisRow[] = [
      // Período 0 (fecha 2024-01-01)
      makeRow('Zapato', 100, 5000, '2024-01-01'), // P = 50
      makeRow('Camisa', 200, 4000, '2024-01-01'), // P = 20

      // Período 1 (fecha 2024-02-01)
      makeRow('Zapato', 120, 7200, '2024-02-01'), // P = 60 (+10 precio, +20 vol)
      makeRow('Camisa', 180, 3600, '2024-02-01'), // P = 20 (0 precio, -20 vol)
    ];

    const result = computePriceVolume(rows, {
      productDim: 'producto',
      volumeColumn: 'volumen',
      amountColumn: 'importe',
      dateColumn: 'fecha',
    });

    expect(result.hasTimeComparison).toBe(true);
    expect(result.pvm).not.toBeNull();

    const pvm = result.pvm!;
    expect(pvm.revenue0).toBe(9000);
    expect(pvm.revenue1).toBe(10800);
    expect(pvm.deltaRevenue).toBe(1800);

    const sumPvm = pvm.priceEffect + pvm.volumeEffect + pvm.mixEffect;
    expect(sumPvm).toBeCloseTo(pvm.deltaRevenue, 2);
  });
});
