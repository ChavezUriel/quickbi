import { describe, expect, it } from 'vitest';
import { computeExecutiveSummary } from './executive';

describe('computeExecutiveSummary', () => {
  it('handles empty rows gracefully', () => {
    const res = computeExecutiveSummary([], { measureCol: 'monto' });
    expect(res.validCount).toBe(0);
    expect(res.totalValue).toBe(0);
    expect(res.meanValue).toBe(0);
    expect(res.trend.direction).toBe('estable');
    expect(res.pareto.totalCategories).toBe(0);
    expect(res.narrative.headline).toBeDefined();
  });

  it('computes basic statistical metrics accurately', () => {
    const rows = [
      { monto: 10 },
      { monto: 20 },
      { monto: 30 },
      { monto: 40 },
      { monto: 50 },
    ];
    const res = computeExecutiveSummary(rows, { measureCol: 'monto' });
    expect(res.validCount).toBe(5);
    expect(res.totalValue).toBe(150);
    expect(res.meanValue).toBe(30);
    expect(res.medianValue).toBe(30);
    expect(res.minValue).toBe(10);
    expect(res.maxValue).toBe(50);
    expect(res.stdDev).toBeCloseTo(15.811, 2);
    expect(res.cv).toBeCloseTo(52.7, 1);
  });

  it('evaluates upward trend and seasonality peaks', () => {
    const rows = [
      { fecha: '2025-01-10', ventas: 100 },
      { fecha: '2025-02-15', ventas: 150 },
      { fecha: '2025-03-20', ventas: 220 },
      { fecha: '2025-04-10', ventas: 350 },
    ];
    const res = computeExecutiveSummary(rows, {
      measureCol: 'ventas',
      dateCol: 'fecha',
      grain: 'mes',
    });

    expect(res.trend.direction).toBe('creciente');
    expect(res.trend.percentageChange).toBe(250);
    expect(res.trend.peakBucket?.value).toBe(350);
    expect(res.trend.troughBucket?.value).toBe(100);
    expect(res.narrative.headline).toContain('trayectoria alcista');
  });

  it('calculates Pareto concentration correctly', () => {
    const rows = [
      { cat: 'A', monto: 800 },
      { cat: 'B', monto: 100 },
      { cat: 'C', monto: 50 },
      { cat: 'D', monto: 30 },
      { cat: 'E', monto: 20 },
    ];
    const res = computeExecutiveSummary(rows, {
      measureCol: 'monto',
      dimensionCol: 'cat',
    });

    expect(res.pareto.totalCategories).toBe(5);
    // Top 20% is 1 category ('A' with 800 out of 1000 = 80%)
    expect(res.pareto.top20PercentShare).toBe(80);
    expect(res.pareto.isParetoConcentrated).toBe(true);
    expect(res.pareto.topCategories[0]?.name).toBe('A');
    expect(res.pareto.topCategories[0]?.share).toBe(80);
    expect(res.narrative.concentrationText).toContain('80.0%');
  });

  it('detects temporal anomalies (outliers)', () => {
    // 10 normal months + 1 massive spike outlier
    const rows = [
      { fecha: '2025-01-01', val: 100 },
      { fecha: '2025-02-01', val: 102 },
      { fecha: '2025-03-01', val: 98 },
      { fecha: '2025-04-01', val: 101 },
      { fecha: '2025-05-01', val: 99 },
      { fecha: '2025-06-01', val: 103 },
      { fecha: '2025-07-01', val: 97 },
      { fecha: '2025-08-01', val: 100 },
      { fecha: '2025-09-01', val: 101 },
      { fecha: '2025-10-01', val: 900 }, // Anomaly
    ];
    const res = computeExecutiveSummary(rows, {
      measureCol: 'val',
      dateCol: 'fecha',
      grain: 'mes',
    });

    expect(res.anomalies.length).toBeGreaterThan(0);
    expect(res.anomalies.some((a) => a.value === 900)).toBe(true);
  });
});
