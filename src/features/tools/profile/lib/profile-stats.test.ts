import { describe, expect, it } from 'vitest';
import type { ColumnProfile } from '@/features/dataset/lib/column-types';
import type { DataRow } from '@/features/dataset/types';
import { numericStats, percentile, profileDataset } from './profile-stats';

function column(overrides: Partial<ColumnProfile> & { name: string }): ColumnProfile {
  return {
    type: 'text',
    format: { kind: 'none' },
    role: 'dimension',
    nullCount: 0,
    invalidCount: 0,
    distinctCount: 0,
    distinctCountExact: true,
    samples: [],
    ...overrides,
  };
}

describe('percentile', () => {
  it('interpola entre los dos valores centrales', () => {
    expect(percentile([1, 2, 3, 4], 0.5)).toBe(2.5);
  });

  it('devuelve los extremos en 0 y 1', () => {
    expect(percentile([1, 2, 3], 0)).toBe(1);
    expect(percentile([1, 2, 3], 1)).toBe(3);
  });

  it('resuelve los casos degenerados sin fallar', () => {
    expect(percentile([], 0.5)).toBe(0);
    expect(percentile([7], 0.25)).toBe(7);
  });
});

describe('numericStats', () => {
  it('resume una columna numérica', () => {
    const stats = numericStats([0, -2, 4, 6]);

    expect(stats.min).toBe(-2);
    expect(stats.max).toBe(6);
    expect(stats.sum).toBe(8);
    expect(stats.mean).toBe(2);
    expect(stats.median).toBe(2);
    expect(stats.zeros).toBe(1);
    expect(stats.negatives).toBe(1);
  });

  it('reparte los valores en barras y no pierde ninguno', () => {
    const stats = numericStats([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const total = stats.histogram.reduce((sum, bin) => sum + bin.count, 0);

    expect(total).toBe(10);
    // El máximo cae dentro de la última barra, no fuera del histograma.
    expect(stats.histogram[stats.histogram.length - 1]?.count).toBeGreaterThan(0);
  });

  it('da una sola barra cuando la columna es constante', () => {
    const stats = numericStats([5, 5, 5]);

    expect(stats.histogram).toHaveLength(1);
    expect(stats.histogram[0]?.count).toBe(3);
    expect(stats.stdDev).toBe(0);
  });
});

describe('profileDataset', () => {
  const columns = [
    column({ name: 'zona', distinctCount: 2 }),
    column({
      name: 'importe',
      type: 'number',
      role: 'measure',
      format: { kind: 'number', decimal: '.' },
      distinctCount: 3,
    }),
  ];

  const rows: DataRow[] = [
    { zona: 'Norte', importe: '10' },
    { zona: 'Sur', importe: '20' },
    { zona: 'Norte', importe: null },
    { zona: 'Norte', importe: 'no es número' },
  ];

  it('separa vacíos, inválidos y válidos', () => {
    const profile = profileDataset(rows, columns);
    const importe = profile.columns.find((item) => item.name === 'importe');

    expect(importe?.nulls).toBe(1);
    expect(importe?.invalid).toBe(1);
    expect(importe?.valid).toBe(2);
  });

  it('cuenta los valores más frecuentes de una categoría', () => {
    const profile = profileDataset(rows, columns);
    const zona = profile.columns.find((item) => item.name === 'zona');

    expect(zona?.top?.[0]).toEqual({ value: 'Norte', count: 3, share: 75 });
  });

  it('detecta filas idénticas', () => {
    const duplicated: DataRow[] = [
      { zona: 'Norte', importe: '10' },
      { zona: 'Norte', importe: '10' },
      { zona: 'Sur', importe: '10' },
    ];
    const profile = profileDataset(duplicated, columns);

    expect(profile.duplicateRows).toBe(1);
    expect(profile.duplicatesExact).toBe(true);
  });

  it('no confunde el reparto de los valores entre columnas', () => {
    const ambiguous: DataRow[] = [
      { zona: 'ab', importe: 'c' },
      { zona: 'a', importe: 'bc' },
    ];
    const profile = profileDataset(ambiguous, columns);

    expect(profile.duplicateRows).toBe(0);
  });

  it('mide lo completo que está el dataset', () => {
    const profile = profileDataset(rows, columns);

    // 8 celdas, 6 con contenido convertible.
    expect(profile.completeness).toBe(75);
  });

  it('sobrevive a un dataset vacío', () => {
    const profile = profileDataset([], columns);

    expect(profile.rowCount).toBe(0);
    expect(profile.completeness).toBe(0);
    expect(profile.emptyColumns).toBe(2);
  });
});
