import { describe, expect, it } from 'vitest';
import type { AnalysisRow } from '@/features/analysis/types';
import { computeBasket } from './basket';

function makeRow(producto: string | null, pedido: string | null, cantidad?: number | null): AnalysisRow {
  const dims: Record<string, string> = {};
  if (producto !== null) dims.producto = producto;
  if (pedido !== null) dims.pedido = pedido;
  const values: Record<string, number | null> = {};
  if (cantidad !== undefined) values.cantidad = cantidad;
  return {
    day: null,
    dims,
    values,
  };
}

describe('computeBasket', () => {
  it('handles empty rows gracefully', () => {
    const result = computeBasket([], {
      itemDim: 'producto',
      basketDim: 'pedido',
    });

    expect(result.totalBaskets).toBe(0);
    expect(result.uniqueItems).toBe(0);
    expect(result.avgBasketSize).toBe(0);
    expect(result.rules).toEqual([]);
    expect(result.items).toEqual([]);
    expect(result.matrix.topItems).toEqual([]);
    expect(result.ignoredRows).toBe(0);
  });

  it('ignores rows missing item or basket ID', () => {
    const rows: AnalysisRow[] = [
      makeRow(null, 'T-1'),
      makeRow('Café', null),
      makeRow('   ', 'T-1'),
      makeRow('Café', 'T-1'),
      makeRow('Leche', 'T-1'),
    ];

    const result = computeBasket(rows, {
      itemDim: 'producto',
      basketDim: 'pedido',
    });

    expect(result.ignoredRows).toBe(3);
    expect(result.totalBaskets).toBe(1);
    expect(result.uniqueItems).toBe(2);
    expect(result.avgBasketSize).toBe(2);
  });

  it('correctly calculates support, confidence, and lift for a known market basket', () => {
    const rows: AnalysisRow[] = [
      makeRow('Leche', 'T1'),
      makeRow('Pan', 'T1'),

      makeRow('Pan', 'T2'),
      makeRow('Mantequilla', 'T2'),

      makeRow('Leche', 'T3'),
      makeRow('Pan', 'T3'),
      makeRow('Mantequilla', 'T3'),

      makeRow('Leche', 'T4'),
      makeRow('Galletas', 'T4'),

      makeRow('Leche', 'T5'),
      makeRow('Pan', 'T5'),
      makeRow('Mantequilla', 'T5'),
      makeRow('Galletas', 'T5'),
    ];

    const result = computeBasket(rows, {
      itemDim: 'producto',
      basketDim: 'pedido',
      minSupport: 0.1,
      minConfidence: 0.1,
      minLift: 0.1,
    });

    expect(result.totalBaskets).toBe(5);
    expect(result.uniqueItems).toBe(4);

    const leche = result.items.find((i) => i.item === 'Leche')!;
    expect(leche.count).toBe(4);
    expect(leche.support).toBeCloseTo(0.8);

    const pan = result.items.find((i) => i.item === 'Pan')!;
    expect(pan.count).toBe(4);

    const mantequilla = result.items.find((i) => i.item === 'Mantequilla')!;
    expect(mantequilla.count).toBe(3);

    const ruleMantPan = result.rules.find(
      (r) => r.antecedent === 'Mantequilla' && r.consequent === 'Pan',
    );
    expect(ruleMantPan).toBeDefined();
    expect(ruleMantPan!.supportCount).toBe(3);
    expect(ruleMantPan!.support).toBeCloseTo(0.6);
    expect(ruleMantPan!.confidence).toBeCloseTo(1.0);
    expect(ruleMantPan!.expectedConfidence).toBeCloseTo(0.8);
    expect(ruleMantPan!.lift).toBeCloseTo(1.25);

    const rulePanMant = result.rules.find(
      (r) => r.antecedent === 'Pan' && r.consequent === 'Mantequilla',
    );
    expect(rulePanMant).toBeDefined();
    expect(rulePanMant!.confidence).toBeCloseTo(0.75);
    expect(rulePanMant!.lift).toBeCloseTo(1.25);

    expect(result.matrix.topItems).toHaveLength(4);
    expect(result.matrix.cells.length).toBe(16);
  });

  it('produces 0 rules when baskets only have 1 item', () => {
    const rows: AnalysisRow[] = [
      makeRow('Leche', 'T1'),
      makeRow('Pan', 'T2'),
      makeRow('Agua', 'T3'),
    ];

    const result = computeBasket(rows, {
      itemDim: 'producto',
      basketDim: 'pedido',
    });

    expect(result.totalBaskets).toBe(3);
    expect(result.rules).toEqual([]);
    expect(result.avgBasketSize).toBe(1);
  });
});
