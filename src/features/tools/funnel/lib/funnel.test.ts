import { describe, expect, it } from 'vitest';
import type { AnalysisRow } from '@/features/analysis/types';
import { computeFunnel } from './funnel';

function makeRow(dims: Record<string, string>, values: Record<string, number> = {}): AnalysisRow {
  return {
    dims,
    values,
    day: '2024-01-01',
  };
}

describe('computeFunnel', () => {
  it('returns empty result for empty rows', () => {
    const res = computeFunnel([], { stageDim: 'etapa' });
    expect(res.stages).toEqual([]);
    expect(res.summary.topVolume).toBe(0);
    expect(res.summary.bottomVolume).toBe(0);
    expect(res.summary.overallConversionRate).toBe(0);
    expect(res.summary.bottleneckStage).toBeNull();
  });

  it('calculates standard funnel with row count', () => {
    const rows: AnalysisRow[] = [
      makeRow({ etapa: 'Visita' }),
      makeRow({ etapa: 'Visita' }),
      makeRow({ etapa: 'Visita' }),
      makeRow({ etapa: 'Visita' }),
      makeRow({ etapa: 'Registro' }),
      makeRow({ etapa: 'Registro' }),
      makeRow({ etapa: 'Carrito' }),
    ];

    const res = computeFunnel(rows, {
      stageDim: 'etapa',
      customOrder: ['Visita', 'Registro', 'Carrito'],
    });

    expect(res.stages).toHaveLength(3);
    expect(res.stages[0]?.stage).toBe('Visita');
    expect(res.stages[0]?.volume).toBe(4);
    expect(res.stages[0]?.conversionFromTop).toBe(100);
    expect(res.stages[0]?.stepConversionRate).toBe(100);
    expect(res.stages[0]?.dropOff).toBe(0);

    expect(res.stages[1]?.stage).toBe('Registro');
    expect(res.stages[1]?.volume).toBe(2);
    expect(res.stages[1]?.conversionFromTop).toBe(50);
    expect(res.stages[1]?.stepConversionRate).toBe(50);
    expect(res.stages[1]?.dropOff).toBe(2);
    expect(res.stages[1]?.dropOffRate).toBe(50);

    expect(res.stages[2]?.stage).toBe('Carrito');
    expect(res.stages[2]?.volume).toBe(1);
    expect(res.stages[2]?.conversionFromTop).toBe(25);
    expect(res.stages[2]?.stepConversionRate).toBe(50);
    expect(res.stages[2]?.dropOff).toBe(1);
    expect(res.stages[2]?.dropOffRate).toBe(50);

    expect(res.summary.topVolume).toBe(4);
    expect(res.summary.bottomVolume).toBe(1);
    expect(res.summary.overallConversionRate).toBe(25);
  });

  it('aggregates sum of measure value', () => {
    const rows: AnalysisRow[] = [
      makeRow({ paso: 'Prospecto' }, { monto: 1000 }),
      makeRow({ paso: 'Prospecto' }, { monto: 500 }),
      makeRow({ paso: 'Cualificado' }, { monto: 900 }),
      makeRow({ paso: 'Cerrado' }, { monto: 300 }),
    ];

    const res = computeFunnel(rows, {
      stageDim: 'paso',
      valueColumn: 'monto',
      aggregation: 'sum',
      customOrder: ['Prospecto', 'Cualificado', 'Cerrado'],
    });

    expect(res.stages[0]?.volume).toBe(1500);
    expect(res.stages[1]?.volume).toBe(900);
    expect(res.stages[1]?.conversionFromTop).toBe(60);
    expect(res.stages[1]?.stepConversionRate).toBe(60);
    expect(res.stages[1]?.dropOff).toBe(600);
    expect(res.stages[1]?.dropOffRate).toBe(40);

    expect(res.stages[2]?.volume).toBe(300);
    expect(res.stages[2]?.conversionFromTop).toBe(20);
    expect(res.stages[2]?.stepConversionRate).toBe(33.33);
    expect(res.stages[2]?.dropOff).toBe(600);
    expect(res.stages[2]?.dropOffRate).toBe(66.67);

    // Bottleneck should be Cerrado since drop-off rate is 66.67% vs 40%
    expect(res.summary.bottleneckStage).toBe('Cerrado');
    expect(res.stages[2]?.isBottleneck).toBe(true);
    expect(res.stages[1]?.isBottleneck).toBe(false);
  });

  it('aggregates distinct entity count', () => {
    const rows: AnalysisRow[] = [
      makeRow({ etapa: 'Landing', user_id: 'u1' }),
      makeRow({ etapa: 'Landing', user_id: 'u1' }), // duplicate
      makeRow({ etapa: 'Landing', user_id: 'u2' }),
      makeRow({ etapa: 'Checkout', user_id: 'u1' }),
    ];

    const res = computeFunnel(rows, {
      stageDim: 'etapa',
      idDim: 'user_id',
      aggregation: 'count_distinct',
      customOrder: ['Landing', 'Checkout'],
    });

    expect(res.stages[0]?.volume).toBe(2);
    expect(res.stages[1]?.volume).toBe(1);
    expect(res.stages[1]?.conversionFromTop).toBe(50);
  });

  it('ignores empty stage values and tracks ignored rows', () => {
    const rows: AnalysisRow[] = [
      makeRow({ etapa: '' }),
      makeRow({ etapa: '(sin valor)' }),
      makeRow({ etapa: 'Lead' }),
    ];

    const res = computeFunnel(rows, { stageDim: 'etapa' });
    expect(res.ignoredRows).toBe(2);
    expect(res.stages).toHaveLength(1);
    expect(res.stages[0]?.stage).toBe('Lead');
    expect(res.stages[0]?.volume).toBe(1);
  });
});
