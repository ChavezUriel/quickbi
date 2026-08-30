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

describe('DetailTable export accessibility', () => {
  it('gives the CSV export button a contextual accessible name and tooltip', () => {
    const html = renderToString(
      createElement(DetailTable, {
        result,
        metric: columnMetric('ventas', 'sum', 'numero'),
        currency: 'MXN',
        dimensionHeader: 'Región',
        selected: [],
        selectable: false,
        fileName: 'ventas',
        onSelect: () => undefined,
      }),
    );

    expect(html).toContain('aria-label="Exportar datos del detalle a CSV"');
    expect(html).toContain('title="Exportar datos del detalle a CSV"');
  });
});
