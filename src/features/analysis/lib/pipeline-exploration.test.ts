import { describe, expect, it } from 'vitest';
import { computeExploration, resolveWindows } from './explore';
import { columnMetric, countMetric } from './metrics';
import { formatMetric, formatDelta, formatShare } from './format';
import { EMPTY_FILTERS, lastPeriods, setDateCondition, setSelected } from './filters';
import { buildSyntheticAnalysisRows } from './synthetic-data';
import type { AnalysisRow, DateWindow } from '../types';

const ventasSum = columnMetric('ventas', 'sum', 'moneda');
const ventasAvg = columnMetric('ventas', 'avg', 'moneda');
const unidadesSum = columnMetric('unidades', 'sum', 'numero');
const filasCount = countMetric('Filas');

describe('Synthetic Exploration Analysis Engine Tests', () => {
  const rows = buildSyntheticAnalysisRows();
  const bounds: DateWindow = { desde: '2025-07-01', hasta: '2026-07-28' };

  it('calculates totals, category shares, and deltas correctly for current vs previous month (Sum & Currency)', () => {
    // Current period: July 2026 (last 1 month relative to 2026-07-28)
    const filters = setDateCondition(EMPTY_FILTERS, lastPeriods('fecha', 1, 'mes'));
    const windows = resolveWindows(filters, bounds, 'anterior');

    expect(windows.current).toEqual({ desde: '2026-07-01', hasta: '2026-07-28' });
    expect(windows.previous).toEqual({ desde: '2026-06-01', hasta: '2026-06-28' });

    const result = computeExploration(rows, {
      dim: 'categoria',
      metric: ventasSum,
      filters,
      window: windows.current,
      previousWindow: windows.previous,
      grano: 'mes',
    });

    // July 2026 total ventas:
    // Electrónica: 100 + 200 + 150 = 450
    // Hogar: 80 + 120 = 200
    // Ropa: 50 + 30 = 80
    // Total = 730
    expect(result.total).toBe(730);

    // June 2026 (previous window 2026-06-01 to 2026-06-28):
    // Electrónica: 250 + 100 = 350
    // Hogar: 100
    // Jardín: 90
    // Ropa: 40
    // Total = 580
    expect(result.previousTotal).toBe(580);

    // Category breakdown
    const elec = result.items.find((i) => i.name === 'Electrónica');
    expect(elec?.value).toBe(450);
    expect(elec?.previousValue).toBe(350);
    expect(elec?.sharePct).toBeCloseTo((450 / 730) * 100);
    expect(elec?.deltaPct).toBeCloseTo(((450 - 350) / 350) * 100); // +28.57%

    const hogar = result.items.find((i) => i.name === 'Hogar');
    expect(hogar?.value).toBe(200);
    expect(hogar?.previousValue).toBe(100);
    expect(hogar?.deltaPct).toBe(100); // +100%

    // Disappeared category: "Jardín" was present in June (90) but not in July
    expect(result.desaparecidos).toHaveLength(1);
    expect(result.desaparecidos[0]).toEqual({ name: 'Jardín', previousValue: 90 });

    // Formatting check
    expect(formatMetric(result.total, { format: ventasSum.format, currency: 'EUR' })).toContain('730');
    if (elec?.deltaPct !== undefined && elec.deltaPct !== null) {
      expect(formatDelta(elec.deltaPct)).toMatch(/\+28[,.]6\s*%/);
    }
  });

  it('handles average aggregation (non-cumulative) correctly without share percentage', () => {
    const filters = setDateCondition(EMPTY_FILTERS, lastPeriods('fecha', 1, 'mes'));
    const windows = resolveWindows(filters, bounds, 'ninguna');

    const result = computeExploration(rows, {
      dim: 'categoria',
      metric: ventasAvg,
      filters,
      window: windows.current,
      previousWindow: null,
      grano: 'mes',
    });

    // Electrónica July 2026 average: (100 + 200 + 150) / 3 = 150
    const elec = result.items.find((i) => i.name === 'Electrónica');
    expect(elec?.value).toBe(150);
    expect(elec?.sharePct).toBeNull(); // Non-cumulative metrics do not show share %

    // Overall average for July 2026: (100 + 200 + 150 + 80 + 120 + 50 + 30) / 7 = 730 / 7
    expect(result.total).toBeCloseTo(730 / 7);
  });

  it('compares against year-over-year period correctly', () => {
    const filters = setDateCondition(EMPTY_FILTERS, lastPeriods('fecha', 1, 'mes'));
    const windows = resolveWindows(filters, bounds, 'anio_anterior');

    expect(windows.current).toEqual({ desde: '2026-07-01', hasta: '2026-07-28' });
    expect(windows.previous).toEqual({ desde: '2025-07-01', hasta: '2025-07-28' });

    const result = computeExploration(rows, {
      dim: 'categoria',
      metric: ventasSum,
      filters,
      window: windows.current,
      previousWindow: windows.previous,
      grano: 'mes',
    });

    // July 2025 total: Electrónica (80) + Hogar (60) = 140
    expect(result.previousTotal).toBe(140);

    const elec = result.items.find((i) => i.name === 'Electrónica');
    expect(elec?.previousValue).toBe(80);
    expect(elec?.deltaPct).toBeCloseTo(((450 - 80) / 80) * 100); // +462.5%
  });

  it('filters rows by dimension and counts rows without dates separately', () => {
    const filters = setSelected(EMPTY_FILTERS, 'region', ['Norte']);

    const result = computeExploration(rows, {
      dim: 'categoria',
      metric: ventasSum,
      filters,
      window: bounds,
      previousWindow: null,
      grano: 'mes',
    });

    // Norte rows:
    // 2026-07-01 (100), 2026-07-05 (200), 2026-07-12 (80), 2026-06-01 (250), 2026-06-15 (100), 2026-06-20 (90), 2025-07-01 (80)
    // plus sinFecha (500) & nullVentas (null)
    expect(result.rowsWithoutDate).toBe(1); // The row with fecha: null and region: 'Norte'
  });
});
