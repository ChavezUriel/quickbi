import { describe, expect, it } from 'vitest';
import { computePivot } from '../../tools/pivot/lib/pivot';
import { computeRfm } from '../../tools/rfm/lib/rfm';
import { profileDataset } from '../../tools/profile/lib/profile-stats';
import { columnMetric } from './metrics';
import { buildSyntheticAnalysisRows, buildSyntheticParsedDataset, generateSyntheticRows } from './synthetic-data';

const ventasSum = columnMetric('ventas', 'sum', 'moneda');
const ventasAvg = columnMetric('ventas', 'avg', 'moneda');

describe('Synthetic Analytical Tools Pipeline Tests', () => {
  const analysisRows = buildSyntheticAnalysisRows();
  const rawDataset = buildSyntheticParsedDataset();
  const rawSpecs = generateSyntheticRows();

  describe('Pivot Table Analysis', () => {
    it('computes 2D matrix cross-tabulation totals accurately', () => {
      // Row dimension: Categoría, Column dimension: Región
      const pivot = computePivot(analysisRows, {
        row: {
          keyOf: (r) => r.dims['categoria'] ?? 'Sin Categoria',
          labelOf: (k) => k,
          sort: 'total',
          max: 10,
        },
        col: {
          keyOf: (r) => r.dims['region'] ?? 'Sin Region',
          labelOf: (k) => k,
          sort: 'total',
          max: 10,
        },
        metric: ventasSum,
      });

      // Total grand total should match sum of all non-null ventas across all rows:
      // July 2026: 100 + 200 + 150 + 80 + 120 + 50 + 30 = 730
      // June 2026: 250 + 100 + 100 + 90 + 40 = 580
      // July 2025: 80 + 60 = 140
      // SinFecha: 500
      // Grand total = 730 + 580 + 140 + 500 = 1950
      expect(pivot.grandTotal).toBe(1950);

      // Check row totals for Electrónica: 100+200+150+250+100+80 = 880
      const elecRowIndex = pivot.rows.findIndex((r) => r.key === 'Electrónica');
      expect(elecRowIndex).not.toBe(-1);
      expect(pivot.rowTotals[elecRowIndex]).toBe(880);

      // Check column totals for Norte:
      // July 2026: 100 + 200 + 80 = 380
      // June 2026: 250 + 100 + 90 = 440
      // July 2025: 80
      // SinFecha: 500
      // Total Norte = 380 + 440 + 80 + 500 = 1400
      const norteColIndex = pivot.cols.findIndex((c) => c.key === 'Norte');
      expect(norteColIndex).not.toBe(-1);
      expect(pivot.colTotals[norteColIndex]).toBe(1400);
    });
  });

  describe('RFM Customer Segmentation Analysis', () => {
    it('segmentates customers into correct RFM quintiles and segments', () => {
      const rfmResult = computeRfm(analysisRows, {
        customerDim: 'cliente_id',
        amountColumn: 'ventas',
        orderDim: null,
        referenceDay: '2026-07-28',
      });

      // Valid customers: C001, C002, C003, C004, C005, C006, C007
      // (C099 ignored because fecha is null; C010 ignored because ventas is null)
      expect(rfmResult.customers.length).toBeGreaterThan(0);
      expect(rfmResult.ignoredRows).toBe(2); // row with fecha null and row with null ventas

      const c001 = rfmResult.customers.find((c) => c.id === 'C001');
      expect(c001).toBeDefined();
      // C001 purchases: 2026-07-01 (100), 2026-07-05 (200), 2026-06-01 (250), 2025-07-01 (80)
      // Total monetary = 630
      // Frequency = 4 unique purchase days
      // Last day = 2026-07-05 -> Recency days from 2026-07-28 = 23 days
      expect(c001?.monetary).toBe(630);
      expect(c001?.frequency).toBe(4);
      expect(c001?.recencyDays).toBe(23);

      // Verify grid matrix covers 25 cells (5x5)
      expect(rfmResult.grid).toHaveLength(25);
    });
  });

  describe('Dataset Profile Stats', () => {
    it('profiles dataset completeness, nulls, duplicates and numerical distribution', () => {
      const profile = profileDataset(rawDataset.rows, rawDataset.columns);

      expect(profile.rowCount).toBe(rawSpecs.length);
      expect(profile.columnCount).toBe(7);
      expect(profile.duplicateRows).toBe(0);

      const ventasStats = profile.columns.find((c) => c.name === 'Ventas');
      expect(ventasStats?.nulls).toBe(1);
      expect(ventasStats?.valid).toBe(15);
      expect(ventasStats?.numeric?.sum).toBe(1950);
      expect(ventasStats?.numeric?.min).toBe(30);
      expect(ventasStats?.numeric?.max).toBe(500);
    });
  });
});
