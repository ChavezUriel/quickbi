import { describe, expect, it } from 'vitest';
import type { ColumnProfile } from '@/features/dataset/lib/column-types';
import type { ColumnMappingState } from '@/features/mapping/use-column-mapping';
import { datasetCapabilities, detectSemantics } from '../capabilities';
import { TOOLS, availabilityOf } from '../registry';

function makeColumn(
  name: string,
  type: ColumnProfile['type'],
  distinctCount = 10,
  samples: string[] = [],
): ColumnProfile {
  return {
    name,
    type,
    format: { kind: 'none' },
    role: type === 'number' ? 'measure' : 'dimension',
    nullCount: 0,
    invalidCount: 0,
    distinctCount,
    distinctCountExact: true,
    samples,
  };
}

function makeMapping(columns: ColumnProfile[], effectiveRowCount = 100): ColumnMappingState {
  return {
    columns,
    dimensions: columns.filter((c) => c.type === 'text' || c.type === 'boolean'),
    measures: columns.filter((c) => c.type === 'number'),
    dateColumns: columns.filter((c) => c.type === 'date'),
    preserveInvalid: {},
    effectiveRowCount,
    setColumnType: () => {},
    setPreserveInvalid: () => {},
  };
}

describe('Intelligent Capability & Semantic Detection', () => {
  it('detects customer, product, order, price and volume semantics in sales datasets', () => {
    const mapping = makeMapping([
      makeColumn('Fecha_Pedido', 'date', 50),
      makeColumn('ID_Cliente', 'text', 120),
      makeColumn('Nombre_Producto', 'text', 40),
      makeColumn('Num_Ticket', 'text', 200),
      makeColumn('Precio_Unitario', 'number', 30),
      makeColumn('Cantidad', 'number', 15),
      makeColumn('Importe_Total', 'number', 80),
    ]);

    const caps = datasetCapabilities(mapping);
    const semantics = caps.semantics;

    expect(semantics.hasCustomer).toBe(true);
    expect(semantics.customerColumn).toBe('ID_Cliente');
    expect(semantics.hasProduct).toBe(true);
    expect(semantics.productColumn).toBe('Nombre_Producto');
    expect(semantics.hasOrder).toBe(true);
    expect(semantics.orderColumn).toBe('Num_Ticket');
    expect(semantics.hasPrice).toBe(true);
    expect(semantics.priceColumn).toBe('Precio_Unitario');
    expect(semantics.hasVolume).toBe(true);
    expect(semantics.volumeColumn).toBe('Cantidad');

    // Geo and Inventory should NOT be detected
    expect(semantics.hasGeo).toBe(false);
    expect(semantics.hasInventory).toBe(false);
    expect(semantics.hasFunnelStage).toBe(false);
  });

  it('detects geographic columns and country samples', () => {
    const mappingWithGeoCol = makeMapping([
      makeColumn('Pais', 'text', 15),
      makeColumn('Ventas', 'number', 50),
    ]);
    expect(detectSemantics(mappingWithGeoCol).hasGeo).toBe(true);
    expect(detectSemantics(mappingWithGeoCol).geoColumn).toBe('Pais');

    const mappingWithGeoSamples = makeMapping([
      makeColumn('Ubicacion', 'text', 10, ['España', 'Francia', 'México']),
      makeColumn('Total', 'number', 50),
    ]);
    expect(detectSemantics(mappingWithGeoSamples).hasGeo).toBe(true);
  });

  it('detects inventory and warehouse stock metrics', () => {
    const mapping = makeMapping([
      makeColumn('SKU', 'text', 200),
      makeColumn('Stock_Disponible', 'number', 50),
      makeColumn('Coste_Unitario', 'number', 20),
    ]);

    const semantics = detectSemantics(mapping);
    expect(semantics.hasInventory).toBe(true);
    expect(semantics.inventoryColumn).toBe('Stock_Disponible');
  });

  it('detects conversion funnel stage dimensions', () => {
    const mapping = makeMapping([
      makeColumn('Etapa_Pipeline', 'text', 5, ['Lead', 'Contacto', 'Ganado']),
      makeColumn('Oportunidades', 'number', 10),
    ]);

    const semantics = detectSemantics(mapping);
    expect(semantics.hasFunnelStage).toBe(true);
    expect(semantics.funnelColumn).toBe('Etapa_Pipeline');
  });
});

describe('Tool Compatibility Matrix', () => {
  it('correctly rejects tools when dataset lacks basic required column types', () => {
    // Dataset with ONLY measures: [Presupuesto, Gasto] (0 dimensions)
    const mappingOnlyMeasures = makeMapping([
      makeColumn('Presupuesto', 'number', 8),
      makeColumn('Gasto', 'number', 8),
    ]);
    const capsMeasuresOnly = datasetCapabilities(mappingOnlyMeasures);

    const geoTool = TOOLS.find((t) => t.id === 'geo_map')!;
    const invTool = TOOLS.find((t) => t.id === 'inventory')!;
    const funnelTool = TOOLS.find((t) => t.id === 'funnel')!;
    const rfmTool = TOOLS.find((t) => t.id === 'rfm')!;

    expect(availabilityOf(geoTool, capsMeasuresOnly).available).toBe(false); // Needs dimensions
    expect(availabilityOf(invTool, capsMeasuresOnly).available).toBe(false); // Needs dimensions
    expect(availabilityOf(funnelTool, capsMeasuresOnly).available).toBe(false); // Needs dimensions
    expect(availabilityOf(rfmTool, capsMeasuresOnly).available).toBe(false); // Needs dates
  });

  it('marks tools as compatible when column types exist but domain is generic', () => {
    // Dataset with generic dimensions and measures: [Departamento, Presupuesto]
    const mapping = makeMapping([
      makeColumn('Departamento', 'text', 8),
      makeColumn('Presupuesto', 'number', 8),
    ]);
    const caps = datasetCapabilities(mapping);

    const geoTool = TOOLS.find((t) => t.id === 'geo_map')!;
    const invTool = TOOLS.find((t) => t.id === 'inventory')!;
    const funnelTool = TOOLS.find((t) => t.id === 'funnel')!;
    const pivotTool = TOOLS.find((t) => t.id === 'tabla-dinamica')!;

    expect(availabilityOf(geoTool, caps).available).toBe(true);
    expect(availabilityOf(geoTool, caps).score).toBe('compatible');
    expect(availabilityOf(invTool, caps).available).toBe(true);
    expect(availabilityOf(invTool, caps).score).toBe('compatible');
    expect(availabilityOf(funnelTool, caps).available).toBe(true);
    expect(availabilityOf(funnelTool, caps).score).toBe('compatible');
    expect(availabilityOf(pivotTool, caps).available).toBe(true);
  });

  it('recommends specialized tools when domain columns match and maps needed fields to detected columns', () => {
    const geoMapping = makeMapping([
      makeColumn('Ciudad', 'text', 20),
      makeColumn('Ingresos', 'number', 40),
    ]);
    const geoCaps = datasetCapabilities(geoMapping);
    const geoTool = TOOLS.find((t) => t.id === 'geo_map')!;
    const avail = availabilityOf(geoTool, geoCaps);

    expect(avail.available).toBe(true);
    expect(avail.score).toBe('recommended');
    expect(avail.matchedColumns).toContain('Ciudad');
    expect(avail.matchedFields).toBeDefined();
    expect(avail.matchedFields).toEqual([
      { need: 'Una columna de territorio o país', column: 'Ciudad' },
      { need: 'Una columna de importe o métrica', column: 'Ingresos' },
    ]);
  });

  it('maps needed fields to found columns in RFM analysis', () => {
    const rfmMapping = makeMapping([
      makeColumn('ID_Cliente', 'text', 50),
      makeColumn('Fecha_Compra', 'date', 30),
      makeColumn('Total_Venta', 'number', 40),
    ]);
    const rfmCaps = datasetCapabilities(rfmMapping);
    const rfmTool = TOOLS.find((t) => t.id === 'rfm')!;
    const avail = availabilityOf(rfmTool, rfmCaps);

    expect(avail.available).toBe(true);
    expect(avail.matchedFields).toEqual([
      { need: 'Una columna de cliente', column: 'ID_Cliente' },
      { need: 'Una fecha', column: 'Fecha_Compra' },
      { need: 'Un importe', column: 'Total_Venta' },
    ]);
  });
});
