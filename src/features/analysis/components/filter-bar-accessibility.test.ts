import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FilterBar } from './filter-bar';
import type { ExplorationState } from '../use-exploration';

const dummyState: ExplorationState = {
  dim: 'Categoria',
  setDim: () => undefined,
  metric: { id: 'count', label: 'Registros', agg: 'count', column: null, format: 'numero', cumulative: true },
  setMetricId: () => undefined,
  hasDateAxis: true,
  rangeId: '30d',
  setRange: () => undefined,
  dateMode: 'ultimos',
  setDateMode: () => undefined,
  customRange: null,
  setCustomRange: () => undefined,
  comparison: 'anterior',
  setComparison: () => undefined,
  comparisonEffective: 'anterior',
  customPrevious: null,
  setCustomPrevious: () => undefined,
  comparisonBlockedReason: null,
  granoChoice: 'auto',
  setGranoChoice: () => undefined,
  grano: 'dia',
  filters: { conditions: [] },
  window: { desde: '2026-07-01', hasta: '2026-07-31' },
  previousWindow: null,
  bounds: { desde: '2026-01-01', hasta: '2026-12-31' },
  result: {
    dim: 'Categoria',
    window: { desde: '2026-07-01', hasta: '2026-07-31' },
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
  },
  selected: [],
  setDimensionFilter: () => undefined,
  setMembershipFilter: () => undefined,
  setNumericFilter: () => undefined,
  clearFilters: () => undefined,
  filterCount: 0,
  isEmitter: () => false,
  resultFor: () => ({
    dim: 'Categoria',
    window: { desde: '2026-07-01', hasta: '2026-07-31' },
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
  }),
  select: () => undefined,
};

describe('FilterBar accessibility', () => {
  it('includes focus-visible ring styles on filter popover interactive elements', () => {
    const html = renderToString(
      createElement(FilterBar, {
        state: dummyState,
        distinct: { Categoria: ['A', 'B'] },
        dimensions: ['Categoria'],
        numericColumns: ['Ventas'],
        rows: [],
      }),
    );

    expect(html).toContain('focus-visible:ring-3 focus-visible:ring-ring/50');
  });
});
