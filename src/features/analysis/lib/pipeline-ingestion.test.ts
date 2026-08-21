import { describe, expect, it } from 'vitest';
import { profileColumns, profileColumn } from '../../dataset/lib/infer-columns';
import { prepareRows } from './prepare-rows';
import { buildSyntheticParsedDataset, generateSyntheticRows } from './synthetic-data';

describe('End-to-end synthetic pipeline - Ingestion & Profiling', () => {
  const dataset = buildSyntheticParsedDataset();

  it('correctly profiles synthetic dataset columns', () => {
    const columnNames = dataset.columns.map((c) => c.name);
    const profiles = profileColumns(columnNames, dataset.rows);

    expect(profiles).toHaveLength(7);

    const fechaProf = profiles.find((p) => p.name === 'Fecha');
    expect(fechaProf?.type).toBe('date');
    expect(fechaProf?.nullCount).toBe(1);

    const ventasProf = profiles.find((p) => p.name === 'Ventas');
    expect(ventasProf?.type).toBe('number');
    expect(ventasProf?.nullCount).toBe(1);

    const catProf = profiles.find((p) => p.name === 'Categoría');
    expect(catProf?.type).toBe('text');
    expect(catProf?.distinctCount).toBe(5); // Electrónica, Hogar, Ropa, Jardín, SinFechaCat
  });

  it('prepares normalized analysis rows with proper date bounds and distinct dimension sets', () => {
    const rawSpecs = generateSyntheticRows();
    const profiles = profileColumns(dataset.columns.map((c) => c.name), dataset.rows);

    const config = { dateColumn: 'Fecha' };
    const prepared = prepareRows(dataset.rows, profiles, config);

    expect(prepared.rows).toHaveLength(rawSpecs.length);
    expect(prepared.dropped).toBe(0);

    // Bounds should range from minimum date 2025-07-01 to max date 2026-07-28
    expect(prepared.bounds).toEqual({
      desde: '2025-07-01',
      hasta: '2026-07-28',
    });

    // Check distinct set for dimension "Categoría"
    expect(prepared.distinct['Categoría']).toContain('Electrónica');
    expect(prepared.distinct['Categoría']).toContain('Hogar');
    expect(prepared.distinct['Categoría']).toContain('Ropa');
    expect(prepared.distinct['Categoría']).toContain('Jardín');
    expect(prepared.distinct['Categoría']).toContain('SinFechaCat');

    // Verify row without date preserves day: null
    const noDateRow = prepared.rows.find((r) => r.dims['Categoría'] === 'SinFechaCat');
    expect(noDateRow).toBeDefined();
    expect(noDateRow?.day).toBeNull();
    expect(noDateRow?.values['Ventas']).toBe(500);

    // Verify null ventas is coerced to null
    const nullVentasRow = prepared.rows.find((r) => r.dims['ClienteID'] === 'C010');
    expect(nullVentasRow).toBeDefined();
    expect(nullVentasRow?.values['Ventas']).toBeNull();
  });
});
