import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ToolGallery } from './tool-gallery';
import type { DatasetCapabilities } from '../types';

const sampleCapabilities: DatasetCapabilities = {
  rowCount: 100,
  columnCount: 5,
  dates: 1,
  measures: 2,
  dimensions: 2,
  identifiers: 0,
  dateColumnNames: ['fecha'],
  dimensionNames: ['categoria', 'region'],
  measureNames: ['ventas', 'cantidad'],
  identifierNames: [],
  semantics: {
    hasCustomer: false,
    customerColumn: null,
    hasProduct: false,
    productColumn: null,
    hasOrder: false,
    orderColumn: null,
    hasGeo: false,
    geoColumn: null,
    hasInventory: false,
    inventoryColumn: null,
    hasFunnelStage: false,
    funnelColumn: null,
    hasPrice: false,
    priceColumn: null,
    hasVolume: false,
    volumeColumn: null,
    hasReconciliation: false,
    reconciliationColumns: [],
  },
};

describe('ToolGallery accessibility hints', () => {
  it('provides an explicit aria-label for the search input', () => {
    const html = renderToString(
      createElement(ToolGallery, {
        capabilities: sampleCapabilities,
        selected: null,
        onSelect: () => {},
      }),
    );

    expect(html).toContain('aria-label="Buscar herramienta de análisis"');
    expect(html).toContain('aria-hidden="true"');
  });
});
