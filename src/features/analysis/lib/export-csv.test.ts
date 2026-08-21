import { describe, expect, it } from 'vitest';
import { explorationToCsv } from './export-csv';
import type { ExplorationResult } from '../types';

const mockBaseResult: ExplorationResult = {
  dim: 'Zona',
  window: { desde: '2026-07-01', hasta: '2026-07-31' },
  previousWindow: null,
  items: [
    {
      name: 'Norte',
      value: 1500.5,
      sharePct: 71.45236,
      previousValue: null,
      deltaPct: null,
    },
    {
      name: 'Sur',
      value: 600,
      sharePct: 28.54764,
      previousValue: null,
      deltaPct: null,
    },
  ],
  total: 2100.5,
  previousTotal: null,
  serie: null,
  subidas: [],
  caidas: [],
  desaparecidos: [],
  rowsMatched: 10,
  previousRowsMatched: null,
  previousItemsCount: null,
  rowsWithoutDate: 0,
};

describe('explorationToCsv', () => {
  it('starts with UTF-8 BOM and uses CRLF line endings', () => {
    const csv = explorationToCsv(mockBaseResult, 'Región', 'Ventas');
    expect(csv.startsWith('\uFEFF')).toBe(true);

    const content = csv.slice(1);
    expect(content.includes('\r\n')).toBe(true);
  });

  it('exports CSV without comparison window correctly', () => {
    const csv = explorationToCsv(mockBaseResult, 'Región', 'Ventas');
    const lines = csv.slice(1).split('\r\n');

    expect(lines[0]).toBe('Región;Ventas;Participación %');
    expect(lines[1]).toBe('Norte;1,500.5;71.4524');
    expect(lines[2]).toBe('Sur;600;28.5476');
  });

  it('exports CSV with comparison window including previous period and variation', () => {
    const resultWithComparison: ExplorationResult = {
      ...mockBaseResult,
      previousWindow: { desde: '2026-06-01', hasta: '2026-06-30' },
      items: [
        {
          name: 'Norte',
          value: 1500,
          sharePct: 60,
          previousValue: 2000,
          deltaPct: -25,
        },
      ],
    };

    const csv = explorationToCsv(resultWithComparison, 'Región', 'Ventas');
    const lines = csv.slice(1).split('\r\n');

    expect(lines[0]).toBe('Región;Ventas;Participación %;Período anterior;Variación %');
    expect(lines[1]).toBe('Norte;1,500;60;2,000;-25');
  });

  it('formats null values as empty string fields', () => {
    const resultWithNulls: ExplorationResult = {
      ...mockBaseResult,
      previousWindow: { desde: '2026-06-01', hasta: '2026-06-30' },
      items: [
        {
          name: 'Nuevos',
          value: 100,
          sharePct: null,
          previousValue: null,
          deltaPct: null,
        },
      ],
    };

    const csv = explorationToCsv(resultWithNulls, 'Categoría', 'Promedio');
    const lines = csv.slice(1).split('\r\n');

    expect(lines[0]).toBe('Categoría;Promedio;Participación %;Período anterior;Variación %');
    expect(lines[1]).toBe('Nuevos;100;;;');
  });

  it('escapes fields containing semicolons, double quotes, and line breaks', () => {
    const resultWithSpecialChars: ExplorationResult = {
      ...mockBaseResult,
      items: [
        {
          name: 'Zona; Centro "Norte"\nEspecial',
          value: 500,
          sharePct: 100,
          previousValue: null,
          deltaPct: null,
        },
      ],
    };

    const csv = explorationToCsv(
      resultWithSpecialChars,
      'Dimensión; Especial',
      'Métrica "Total"',
    );
    const contentWithoutBOM = csv.slice(1);

    expect(contentWithoutBOM).toContain('"Dimensión; Especial";"Métrica ""Total""";Participación %');
    expect(contentWithoutBOM).toContain('"Zona; Centro ""Norte""\nEspecial";500;100');
  });

  it('formats numbers using es-MX locale rules with maximum 4 fraction digits', () => {
    const resultWithDecimals: ExplorationResult = {
      ...mockBaseResult,
      items: [
        {
          name: 'Precisión',
          value: 1234567.891234,
          sharePct: 12.345678,
          previousValue: null,
          deltaPct: null,
        },
      ],
    };

    const csv = explorationToCsv(resultWithDecimals, 'Dim', 'Val');
    const lines = csv.slice(1).split('\r\n');

    expect(lines[1]).toBe('Precisión;1,234,567.8912;12.3457');
  });
});
