import { describe, expect, it } from 'vitest';
import { computeForecast } from './forecast';

describe('computeForecast', () => {
  it('handles empty data gracefully', () => {
    const res = computeForecast([], {
      dateCol: 'fecha',
      measureCol: 'monto',
      horizon: 6,
    });

    expect(res.totalHistoricalPeriods).toBe(0);
    expect(res.forecast).toHaveLength(0);
    expect(res.historical).toHaveLength(0);
  });

  it('projects simple linear trend on short series', () => {
    const rows = [
      { fecha: '2025-01-01', monto: 100 },
      { fecha: '2025-02-01', monto: 110 },
      { fecha: '2025-03-01', monto: 120 },
      { fecha: '2025-04-01', monto: 130 },
      { fecha: '2025-05-01', monto: 140 },
    ];

    const res = computeForecast(rows, {
      dateCol: 'fecha',
      measureCol: 'monto',
      grain: 'mes',
      horizon: 3,
    });

    expect(res.totalHistoricalPeriods).toBe(5);
    expect(res.forecast).toHaveLength(3);
    // Projection should continue upwards around 150, 160, 170
    expect(res.forecast[0]?.forecast).toBeGreaterThan(140);
    const f0 = res.forecast[0]?.forecast ?? 0;
    expect(res.forecast[1]?.forecast).toBeGreaterThan(f0);
  });

  it('calculates confidence intervals correctly', () => {
    const rows = [
      { fecha: '2025-01-01', monto: 100 },
      { fecha: '2025-02-01', monto: 120 },
      { fecha: '2025-03-01', monto: 110 },
      { fecha: '2025-04-01', monto: 130 },
      { fecha: '2025-05-01', monto: 140 },
      { fecha: '2025-06-01', monto: 135 },
    ];

    const res = computeForecast(rows, {
      dateCol: 'fecha',
      measureCol: 'monto',
      grain: 'mes',
      horizon: 4,
      confidenceLevel: 95,
    });

    for (const point of res.forecast) {
      expect(point.lowerBound).toBeLessThanOrEqual(point.forecast);
      expect(point.upperBound).toBeGreaterThanOrEqual(point.forecast);
    }
  });

  it('computes backtesting metrics (MAPE, RMSE, MAE, R²)', () => {
    const rows = [
      { fecha: '2025-01-01', monto: 50 },
      { fecha: '2025-02-01', monto: 60 },
      { fecha: '2025-03-01', monto: 70 },
      { fecha: '2025-04-01', monto: 80 },
      { fecha: '2025-05-01', monto: 90 },
      { fecha: '2025-06-01', monto: 100 },
      { fecha: '2025-07-01', monto: 110 },
      { fecha: '2025-08-01', monto: 120 },
    ];

    const res = computeForecast(rows, {
      dateCol: 'fecha',
      measureCol: 'monto',
      grain: 'mes',
      horizon: 3,
    });

    expect(res.metrics.mape).toBeDefined();
    expect(res.metrics.rmse).toBeDefined();
    expect(res.metrics.mae).toBeDefined();
    expect(res.metrics.r2).toBeGreaterThanOrEqual(0);
    expect(res.metrics.accuracyRating).toBeDefined();
  });
});
