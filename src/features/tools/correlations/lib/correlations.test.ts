import { describe, expect, it } from 'vitest';
import type { AnalysisRow } from '@/features/analysis/types';
import {
  classifyStrength,
  computeCorrelationMatrix,
  computePairDetails,
  correlationLabel,
  linearRegression,
  pearsonCorrelation,
} from './correlations';

describe('pearsonCorrelation', () => {
  it('returns null for empty, single point, or mismatched arrays', () => {
    expect(pearsonCorrelation([], [])).toBeNull();
    expect(pearsonCorrelation([1], [2])).toBeNull();
    expect(pearsonCorrelation([1, 2], [1])).toBeNull();
  });

  it('calculates perfect positive correlation (r = 1)', () => {
    const x = [1, 2, 3, 4, 5];
    const y = [2, 4, 6, 8, 10];
    const r = pearsonCorrelation(x, y);
    expect(r).not.toBeNull();
    expect(r!).toBeCloseTo(1, 6);
  });

  it('calculates perfect negative correlation (r = -1)', () => {
    const x = [1, 2, 3, 4, 5];
    const y = [10, 8, 6, 4, 2];
    const r = pearsonCorrelation(x, y);
    expect(r).not.toBeNull();
    expect(r!).toBeCloseTo(-1, 6);
  });

  it('handles zero variance by returning null', () => {
    const x = [5, 5, 5, 5];
    const y = [1, 2, 3, 4];
    expect(pearsonCorrelation(x, y)).toBeNull();
  });

  it('filters out null, undefined, and NaN values', () => {
    const x = [1, 2, null, 3, 4, 5, NaN];
    const y = [2, 4, 10, 6, 8, 10, 20];
    const r = pearsonCorrelation(x, y);
    expect(r).not.toBeNull();
    expect(r!).toBeCloseTo(1, 6);
  });

  it('calculates known intermediate correlation', () => {
    const x = [1, 2, 3, 4, 5];
    const y = [1, 3, 2, 5, 4];
    const r = pearsonCorrelation(x, y);
    expect(r).not.toBeNull();
    expect(r!).toBeCloseTo(0.8, 2);
  });
});

describe('linearRegression', () => {
  it('returns null for insufficient data or zero variance', () => {
    expect(linearRegression([], [])).toBeNull();
    expect(linearRegression([1], [2])).toBeNull();
    expect(linearRegression([3, 3, 3], [1, 2, 3])).toBeNull();
  });

  it('calculates slope, intercept, and R2 correctly', () => {
    const x = [1, 2, 3, 4, 5];
    const y = [3, 5, 7, 9, 11]; // y = 2x + 1
    const res = linearRegression(x, y);
    expect(res).not.toBeNull();
    expect(res!.slope).toBeCloseTo(2, 6);
    expect(res!.intercept).toBeCloseTo(1, 6);
    expect(res!.r2).toBeCloseTo(1, 6);
    expect(res!.r).toBeCloseTo(1, 6);
    expect(res!.equation).toBe('y = 2.00x + 1.00');
  });

  it('calculates negative slope and negative intercept correctly', () => {
    const x = [1, 2, 3, 4, 5];
    const y = [-3, -5, -7, -9, -11]; // y = -2x - 1
    const res = linearRegression(x, y);
    expect(res).not.toBeNull();
    expect(res!.slope).toBeCloseTo(-2, 6);
    expect(res!.intercept).toBeCloseTo(-1, 6);
    expect(res!.equation).toBe('y = -2.00x - 1.00');
  });
});

describe('computeCorrelationMatrix & computePairDetails', () => {
  const rows: AnalysisRow[] = [
    { day: null, dims: { cliente: 'A' }, values: { ventas: 100, coste: 60, visitas: 10 } },
    { day: null, dims: { cliente: 'B' }, values: { ventas: 200, coste: 110, visitas: 15 } },
    { day: null, dims: { cliente: 'C' }, values: { ventas: 300, coste: 170, visitas: 25 } },
    { day: null, dims: { cliente: 'D' }, values: { ventas: 400, coste: 240, visitas: 30 } },
  ];

  it('builds full symmetric matrix with 1s on diagonal', () => {
    const matrix = computeCorrelationMatrix(rows, ['ventas', 'coste', 'visitas']);
    expect(matrix.measures).toEqual(['ventas', 'coste', 'visitas']);
    expect(matrix.cells.length).toBe(3);
    expect(matrix.cells[0]![0]!.r).toBe(1);
    expect(matrix.cells[1]![1]!.r).toBe(1);
    expect(matrix.cells[2]![2]!.r).toBe(1);

    // Symmetric check
    const rVentasCoste = matrix.cells[0]![1]!.r;
    const rCosteVentas = matrix.cells[1]![0]!.r;
    expect(rVentasCoste).toBeCloseTo(rCosteVentas!, 6);
    expect(rVentasCoste).toBeGreaterThan(0.99);
  });

  it('computes pair details with points and label dimension', () => {
    const pair = computePairDetails(rows, 'ventas', 'visitas', 'cliente');
    expect(pair.count).toBe(4);
    expect(pair.points.length).toBe(4);
    expect(pair.points[0]!.label).toBe('A');
    expect(pair.points[0]!.x).toBe(100);
    expect(pair.points[0]!.y).toBe(10);
    expect(pair.r).toBeGreaterThan(0.95);
    expect(pair.regression).not.toBeNull();
  });
});

describe('classification & label helpers', () => {
  it('classifies strengths properly', () => {
    expect(classifyStrength(0.85)).toBe('muy_fuerte');
    expect(classifyStrength(0.65)).toBe('fuerte');
    expect(classifyStrength(0.45)).toBe('moderada');
    expect(classifyStrength(0.25)).toBe('debil');
    expect(classifyStrength(0.1)).toBe('nula');
  });

  it('generates descriptive correlation labels', () => {
    expect(correlationLabel(0.92)).toContain('muy fuerte');
    expect(correlationLabel(-0.75)).toContain('negativa');
    expect(correlationLabel(null)).toBe('Sin correlación calculable');
  });
});
