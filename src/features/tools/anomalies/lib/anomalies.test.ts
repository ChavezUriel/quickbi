import { describe, expect, it } from 'vitest';
import type { AnalysisRow } from '@/features/analysis/types';
import { computeAnomalies } from './anomalies';

function makeRow(values: Record<string, number>, day: string, dims: Record<string, string> = {}): AnalysisRow {
  return { values, day, dims };
}

describe('computeAnomalies', () => {
  it('returns null on empty rows', () => {
    const result = computeAnomalies([], {
      dateColumn: 'fecha',
      measure: 'ventas',
      grain: 'dia',
      method: 'rolling_zscore',
      sensitivity: 'alta',
      windowSize: 7,
    });
    expect(result).toBeNull();
  });

  it('detects spikes and drops in a daily time series', () => {
    const rows: AnalysisRow[] = [];
    // 20 regular days around 100
    for (let d = 1; d <= 20; d++) {
      const dayStr = `2024-05-${String(d).padStart(2, '0')}`;
      let val = 100;
      if (d === 5) val = 450; // Huge spike
      if (d === 15) val = 10; // Huge drop
      rows.push(makeRow({ ventas: val }, dayStr));
    }

    const result = computeAnomalies(rows, {
      dateColumn: 'fecha',
      measure: 'ventas',
      grain: 'dia',
      method: 'rolling_zscore',
      sensitivity: 'alta', // 2.0x
      windowSize: 7,
    });

    expect(result).not.toBeNull();
    if (!result) return;

    expect(result.summary.totalPoints).toBe(20);
    expect(result.summary.spikeCount).toBeGreaterThanOrEqual(1);
    expect(result.summary.dropCount).toBeGreaterThanOrEqual(1);

    const spike = result.points.find((p) => p.bucket === '2024-05-05');
    expect(spike?.isAnomaly).toBe(true);
    expect(spike?.type).toBe('pico');
    expect(spike?.actual).toBe(450);

    const drop = result.points.find((p) => p.bucket === '2024-05-15');
    expect(drop?.isAnomaly).toBe(true);
    expect(drop?.type).toBe('caida');
    expect(drop?.actual).toBe(10);
  });

  it('works with IQR and MAD methods', () => {
    const rows: AnalysisRow[] = [];
    for (let d = 1; d <= 15; d++) {
      const dayStr = `2024-06-${String(d).padStart(2, '0')}`;
      const val = d === 8 ? 500 : 50;
      rows.push(makeRow({ ventas: val }, dayStr));
    }

    const iqrResult = computeAnomalies(rows, {
      dateColumn: 'fecha',
      measure: 'ventas',
      grain: 'dia',
      method: 'iqr',
      sensitivity: 'muy_alta',
      windowSize: 7,
    });
    expect(iqrResult?.summary.spikeCount).toBeGreaterThanOrEqual(1);

    const madResult = computeAnomalies(rows, {
      dateColumn: 'fecha',
      measure: 'ventas',
      grain: 'dia',
      method: 'rolling_median',
      sensitivity: 'alta',
      windowSize: 7,
    });
    expect(madResult?.summary.spikeCount).toBeGreaterThanOrEqual(1);
  });

  it('does not detect false anomalies in a constant series', () => {
    const rows: AnalysisRow[] = [];
    for (let d = 1; d <= 10; d++) {
      const dayStr = `2024-07-${String(d).padStart(2, '0')}`;
      rows.push(makeRow({ ventas: 100 }, dayStr));
    }

    const result = computeAnomalies(rows, {
      dateColumn: 'fecha',
      measure: 'ventas',
      grain: 'dia',
      method: 'rolling_zscore',
      sensitivity: 'alta',
      windowSize: 7,
    });

    expect(result?.summary.anomalyCount).toBe(0);
  });
});
