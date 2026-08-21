import { describe, expect, it } from 'vitest';
import { computeSeasonality } from './seasonality';

describe('computeSeasonality', () => {
  it('handles empty input gracefully', () => {
    const res = computeSeasonality([], {
      dateCol: 'fecha',
      measureCol: 'ventas',
    });
    expect(res.validRecords).toBe(0);
    expect(res.totalVolume).toBe(0);
    expect(res.daysOfWeek).toHaveLength(0);
    expect(res.peakDayOfWeek).toBeNull();
  });

  it('calculates day-of-week breakdown correctly', () => {
    // 2025-01-06 is Monday, 2025-01-07 is Tuesday, 2025-01-08 is Wednesday
    const rows = [
      { fecha: '2025-01-06', ventas: 100 }, // Lunes
      { fecha: '2025-01-07', ventas: 200 }, // Martes
      { fecha: '2025-01-08', ventas: 300 }, // Miércoles
      { fecha: '2025-01-13', ventas: 150 }, // Lunes siguiente
    ];

    const res = computeSeasonality(rows, {
      dateCol: 'fecha',
      measureCol: 'ventas',
    });

    expect(res.validRecords).toBe(4);
    expect(res.totalVolume).toBe(750);
    expect(res.daysOfWeek).toHaveLength(7);

    const lunes = res.daysOfWeek.find((d) => d.name === 'Lunes');
    expect(lunes?.total).toBe(250);
    expect(lunes?.occurrences).toBe(2);
    expect(lunes?.average).toBe(125);

    const martes = res.daysOfWeek.find((d) => d.name === 'Martes');
    expect(martes?.total).toBe(200);

    const miercoles = res.daysOfWeek.find((d) => d.name === 'Miércoles');
    expect(miercoles?.total).toBe(300);
    expect(miercoles?.average).toBe(300);

    expect(res.peakDayOfWeek?.name).toBe('Miércoles');
  });

  it('computes month-of-year and quarter patterns', () => {
    const rows = [
      { fecha: '2025-01-15', val: 50 },
      { fecha: '2025-02-15', val: 150 },
      { fecha: '2025-06-10', val: 300 },
      { fecha: '2025-12-20', val: 500 },
    ];

    const res = computeSeasonality(rows, {
      dateCol: 'fecha',
      measureCol: 'val',
    });

    expect(res.monthsOfYear).toHaveLength(12);
    const dic = res.monthsOfYear.find((m) => m.name === 'Diciembre');
    expect(dic?.total).toBe(500);
    expect(res.peakMonth?.name).toBe('Diciembre');

    expect(res.quarters).toHaveLength(4);
    const t4 = res.quarters.find((q) => q.name === 'T4');
    expect(t4?.total).toBe(500);
  });

  it('calculates moving average across continuous timeline', () => {
    const rows = [
      { fecha: '2025-01-01', val: 10 },
      { fecha: '2025-01-02', val: 20 },
      { fecha: '2025-01-03', val: 30 },
    ];

    const res = computeSeasonality(rows, {
      dateCol: 'fecha',
      measureCol: 'val',
      movingAvgWindow: 2,
    });

    expect(res.timeline).toHaveLength(3);
    expect(res.timeline[0]?.movingAvg).toBe(10);
    expect(res.timeline[1]?.movingAvg).toBe(15); // (10+20)/2
    expect(res.timeline[2]?.movingAvg).toBe(25); // (20+30)/2
  });
});
