import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { columnMetric } from '../lib/metrics';
import type { ExplorationResult } from '../types';
import { DetailTable } from './detail-table';

const result: ExplorationResult = {
  dim: 'Región',
  window: { desde: '2026-08-01', hasta: '2026-08-31' },
  previousWindow: null,
  items: [
    { name: 'Norte', value: 100, sharePct: 100, previousValue: null, deltaPct: null },
  ],
  total: 100,
  previousTotal: null,
  serie: null,
  subidas: [],
  caidas: [],
  desaparecidos: [],
  rowsMatched: 1,
  previousRowsMatched: null,
  previousItemsCount: null,
  rowsWithoutDate: 0,
};

const metric = columnMetric('ventas', 'sum', 'numero');

function renderTable(): string {
  return renderToString(
    createElement(DetailTable, {
      result,
      metric,
      currency: 'MXN',
      dimensionHeader: 'Región',
      selected: [],
      selectable: true,
      fileName: 'ventas',
      onSelect: () => undefined,
    }),
  );
}

describe('DetailTable accessibility', () => {
  it('exposes sort state, accessible names, and visible focus styles', () => {
    const html = renderTable();

    expect(html).toContain('aria-label="Ordenar por Región (ascendente)"');
    expect(html).toContain(
      'aria-label="Suma de ventas, orden actual descendente. Cambiar a ascendente"',
    );
    expect(html).toContain('aria-sort="descending"');
    expect(html).toContain('focus-visible:ring-2 focus-visible:ring-ring');
  });
});
