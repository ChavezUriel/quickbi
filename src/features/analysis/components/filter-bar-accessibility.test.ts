import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { ExplorationState } from '../use-exploration';
import { FilterBar } from './filter-bar';

const mockResult = {
  dim: 'Categoria',
  window: { desde: '2026-07-01', hasta: '2026-08-01' },
  previousWindow: null,
  items: [],
  total: 0,
  previousTotal: null,
  serie: null,
  subidas: [],
  caidas: [],
  desaparecidos: [],
  rowsMatched: 0,
  previousRowsMatched: null,
  previousItemsCount: null,
  rowsWithoutDate: 0,
};

const mockState: ExplorationState = {
  dim: 'Categoria',
  setDim: () => undefined,
  metric: { id: 'ventas', label: 'Ventas', agg: 'sum', column: 'ventas', format: 'numero', cumulative: true },
  setMetricId: () => undefined,

  filters: { conditions: [] },
  rangeId: '30d',
  setRange: () => undefined,
  customRange: null,
  setCustomRange: () => undefined,
  comparison: 'anterior',
  setComparison: () => undefined,
  comparisonEffective: 'anterior',
  comparisonBlockedReason: null,
  customPrevious: null,
  setCustomPrevious: () => undefined,
  granoChoice: 'auto',
  setGranoChoice: () => undefined,
  dateMode: 'ultimos',
  setDateMode: () => undefined,

  window: { desde: '2026-07-01', hasta: '2026-08-01' },
  previousWindow: null,
  grano: 'dia',
  hasDateAxis: true,
  bounds: { desde: '2026-01-01', hasta: '2026-08-01' },

  result: mockResult,
  selected: [],
  setDimensionFilter: () => undefined,
  setMembershipFilter: () => undefined,
  setNumericFilter: () => undefined,
  clearFilters: () => undefined,
  filterCount: 0,
  isEmitter: () => false,
  resultFor: () => mockResult,
  select: () => undefined,
};

describe('FilterBar accessibility', () => {
  it('renders filter pills with visible focus indicators and accessible attributes', () => {
    const html = renderToString(
      createElement(FilterBar, {
        state: mockState,
        distinct: { Categoria: ['A', 'B'] },
        dimensions: ['Categoria'],
        numericColumns: ['Monto'],
        rows: [],
      }),
    );

    expect(html).toContain('focus-visible:ring-3');
    expect(html).toContain('Fecha');
    expect(html).toContain('Comparar');
    expect(html).toContain('Grano');
  });
});
