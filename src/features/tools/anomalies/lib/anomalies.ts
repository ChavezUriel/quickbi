import { bucketLabel, bucketOf, generateBuckets } from '@/features/analysis/lib/dates';
import type { AnalysisRow, DateWindow, Granularity } from '@/features/analysis/types';

export type AnomalyMethod = 'rolling_zscore' | 'iqr' | 'rolling_median';
export type AnomalySensitivity = 'muy_alta' | 'alta' | 'media' | 'baja';
export type AnomalyType = 'pico' | 'caida' | 'normal';
export type AnomalySeverity = 'critica' | 'alta' | 'moderada' | 'leve';

export interface AnomalyPoint {
  bucket: string;
  label: string;
  actual: number;
  expected: number;
  lowerBound: number;
  upperBound: number;
  isAnomaly: boolean;
  type: AnomalyType;
  severity: AnomalySeverity;
  score: number;
  diff: number;
  diffPct: number | null;
}

export interface AnomaliesSummary {
  totalPoints: number;
  anomalyCount: number;
  spikeCount: number;
  dropCount: number;
  anomalyRate: number;
  maxSpike: AnomalyPoint | null;
  maxDrop: AnomalyPoint | null;
}

export interface AnomaliesResult {
  points: AnomalyPoint[];
  summary: AnomaliesSummary;
  grain: Granularity;
  method: AnomalyMethod;
  windowSize: number;
  multiplier: number;
}

export interface AnomaliesParams {
  dateColumn: string;
  measure: string;
  dimensionFilter?: { dimension: string; value: string };
  grain: Granularity;
  method: AnomalyMethod;
  sensitivity: AnomalySensitivity;
  windowSize: number;
}

const SENSITIVITY_MULTIPLIER: Record<AnomalySensitivity, number> = {
  muy_alta: 1.5,
  alta: 2.0,
  media: 2.5,
  baja: 3.0,
};

/**
 * Detecta anomalías en una serie temporal mediante media móvil / Z-score, IQR o MAD.
 */
export function computeAnomalies(
  rows: readonly AnalysisRow[],
  params: AnomaliesParams,
): AnomaliesResult | null {
  const { measure, dimensionFilter, grain, method, sensitivity, windowSize } = params;

  if (rows.length === 0) return null;

  // Filtrar filas aplicables
  let minDay: string | null = null;
  let maxDay: string | null = null;
  const bucketTotals = new Map<string, number>();

  for (const row of rows) {
    if (row.day === null) continue;

    if (dimensionFilter && dimensionFilter.dimension) {
      if (row.dims[dimensionFilter.dimension] !== dimensionFilter.value) {
        continue;
      }
    }

    const val = row.values[measure];
    if (val === null || val === undefined || !Number.isFinite(val)) continue;

    if (minDay === null || row.day < minDay) minDay = row.day;
    if (maxDay === null || row.day > maxDay) maxDay = row.day;

    const b = bucketOf(row.day, grain);
    bucketTotals.set(b, (bucketTotals.get(b) ?? 0) + val);
  }

  if (minDay === null || maxDay === null) return null;

  const window: DateWindow = { desde: minDay, hasta: maxDay };
  const allBuckets = generateBuckets(window, grain);
  if (allBuckets.length === 0) return null;

  const seriesData: { bucket: string; label: string; value: number }[] = allBuckets.map((b) => ({
    bucket: b,
    label: bucketLabel(b, grain),
    value: bucketTotals.get(b) ?? 0,
  }));

  const multiplier = SENSITIVITY_MULTIPLIER[sensitivity] ?? 2.0;
  const values = seriesData.map((d) => d.value);
  const n = values.length;

  const points: AnomalyPoint[] = [];
  let spikeCount = 0;
  let dropCount = 0;
  let maxSpike: AnomalyPoint | null = null;
  let maxDrop: AnomalyPoint | null = null;

  for (let i = 0; i < n; i++) {
    const actual = values[i] ?? 0;
    const bucket = seriesData[i]?.bucket ?? '';
    const label = seriesData[i]?.label ?? '';

    // Ventana centrada o precedente
    const halfWin = Math.max(1, Math.floor(windowSize / 2));
    const startIdx = Math.max(0, i - halfWin);
    const endIdx = Math.min(n, i + halfWin + 1);
    const winValues = values.slice(startIdx, endIdx);

    let expected = actual;
    let lowerBound = actual;
    let upperBound = actual;
    let score = 0;

    if (method === 'rolling_zscore') {
      const mean = winValues.reduce((s, v) => s + v, 0) / winValues.length;
      const variance =
        winValues.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / Math.max(1, winValues.length - 1);
      const stdDev = Math.sqrt(variance);

      expected = mean;
      score = stdDev > 1e-6 ? (actual - mean) / stdDev : 0;
      upperBound = mean + multiplier * stdDev;
      lowerBound = mean - multiplier * stdDev;
    } else if (method === 'iqr') {
      const sorted = [...winValues].sort((a, b) => a - b);
      const q1 = percentile(sorted, 0.25);
      const medianVal = percentile(sorted, 0.5);
      const q3 = percentile(sorted, 0.75);
      const iqrVal = q3 - q1;

      expected = medianVal;
      score = iqrVal > 1e-6 ? (actual - medianVal) / iqrVal : 0;
      upperBound = q3 + multiplier * iqrVal;
      lowerBound = q1 - multiplier * iqrVal;
    } else {
      // rolling_median con MAD
      const sorted = [...winValues].sort((a, b) => a - b);
      const med = percentile(sorted, 0.5);
      const absDevs = winValues.map((v) => Math.abs(v - med)).sort((a, b) => a - b);
      const mad = percentile(absDevs, 0.5);
      const robustStd = 1.4826 * mad;

      expected = med;
      score = robustStd > 1e-6 ? (actual - med) / robustStd : 0;
      upperBound = med + multiplier * robustStd;
      lowerBound = med - multiplier * robustStd;
    }

    const isSpike = actual > upperBound;
    const isDrop = actual < lowerBound;
    const isAnomaly = isSpike || isDrop;

    let type: AnomalyType = 'normal';
    if (isSpike) type = 'pico';
    else if (isDrop) type = 'caida';

    const absScore = Math.abs(score);
    let severity: AnomalySeverity = 'leve';
    if (absScore >= 3.5) severity = 'critica';
    else if (absScore >= 2.5) severity = 'alta';
    else if (absScore >= 1.5) severity = 'moderada';

    const diff = actual - expected;
    const diffPct = expected !== 0 ? (diff / Math.abs(expected)) * 100 : null;

    const point: AnomalyPoint = {
      bucket,
      label,
      actual,
      expected,
      lowerBound,
      upperBound,
      isAnomaly,
      type,
      severity,
      score,
      diff,
      diffPct,
    };

    if (isSpike) {
      spikeCount += 1;
      if (maxSpike === null || diff > maxSpike.diff) {
        maxSpike = point;
      }
    } else if (isDrop) {
      dropCount += 1;
      if (maxDrop === null || diff < maxDrop.diff) {
        maxDrop = point;
      }
    }

    points.push(point);
  }

  const anomalyCount = spikeCount + dropCount;
  const anomalyRate = n > 0 ? (anomalyCount / n) * 100 : 0;

  const summary: AnomaliesSummary = {
    totalPoints: n,
    anomalyCount,
    spikeCount,
    dropCount,
    anomalyRate,
    maxSpike,
    maxDrop,
  };

  return {
    points,
    summary,
    grain,
    method,
    windowSize,
    multiplier,
  };
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0] ?? 0;
  const idx = (sorted.length - 1) * p;
  const low = Math.floor(idx);
  const high = Math.ceil(idx);
  const weight = idx - low;
  const lowVal = sorted[low] ?? 0;
  const highVal = sorted[high] ?? 0;
  return lowVal + weight * (highVal - lowVal);
}
