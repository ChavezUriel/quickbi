import type { AnalysisRow } from '@/features/analysis/types';

export interface FiveNumberSummary {
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  mean: number;
  stdDev: number;
  iqr: number;
  lowerFence: number;
  upperFence: number;
  outliers: number[];
  count: number;
  skewness: number | null;
}

export interface HistogramBin {
  x0: number;
  x1: number;
  label: string;
  count: number;
  relativeFrequency: number; // 0 to 100 %
}

export interface HistogramData {
  bins: HistogramBin[];
  binWidth: number;
  totalCount: number;
  min: number;
  max: number;
}

export interface GroupDistribution {
  group: string;
  count: number;
  summary: FiveNumberSummary;
}

export interface DistributionResult {
  measureName: string;
  groupDimName: string | null;
  overall: FiveNumberSummary;
  histogram: HistogramData;
  groups: GroupDistribution[] | null;
  totalRows: number;
}

/**
 * Calcula cuantil mediante interpolación lineal (método tipo 7 estándar).
 */
export function quantile(sortedValues: readonly number[], p: number): number {
  if (sortedValues.length === 0) return 0;
  if (sortedValues.length === 1) return sortedValues[0]!;
  if (p <= 0) return sortedValues[0]!;
  if (p >= 1) return sortedValues[sortedValues.length - 1]!;

  const index = p * (sortedValues.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;

  const valLower = sortedValues[lower]!;
  const valUpper = sortedValues[upper]!;

  return valLower + weight * (valUpper - valLower);
}

/**
 * Resumen de 5 números (Min, Q1, Mediana, Q3, Max) + Media, Desviación típica,
 * Rango Intercuartílico (IQR), detección de atípicos y Asimetría.
 */
export function calculateFiveNumberSummary(
  values: readonly (number | null | undefined)[],
): FiveNumberSummary {
  const clean = values.filter(
    (v): v is number => v !== null && v !== undefined && Number.isFinite(v),
  );

  const n = clean.length;
  if (n === 0) {
    return {
      min: 0,
      q1: 0,
      median: 0,
      q3: 0,
      max: 0,
      mean: 0,
      stdDev: 0,
      iqr: 0,
      lowerFence: 0,
      upperFence: 0,
      outliers: [],
      count: 0,
      skewness: null,
    };
  }

  const sorted = [...clean].sort((a, b) => a - b);
  const min = sorted[0]!;
  const max = sorted[sorted.length - 1]!;
  const q1 = quantile(sorted, 0.25);
  const median = quantile(sorted, 0.5);
  const q3 = quantile(sorted, 0.75);

  let sum = 0;
  for (let i = 0; i < n; i++) sum += sorted[i]!;
  const mean = sum / n;

  let sumSqDiff = 0;
  for (let i = 0; i < n; i++) {
    const diff = sorted[i]! - mean;
    sumSqDiff += diff * diff;
  }
  const stdDev = n > 1 ? Math.sqrt(sumSqDiff / (n - 1)) : 0;

  const iqr = q3 - q1;
  const lowerFence = q1 - 1.5 * iqr;
  const upperFence = q3 + 1.5 * iqr;

  const outliers: number[] = [];
  for (let i = 0; i < n; i++) {
    const val = sorted[i]!;
    if (val < lowerFence || val > upperFence) {
      outliers.push(val);
    }
  }

  // Coeficiente de asimetría muestral (Fisher-Pearson)
  let skewness: number | null = null;
  if (n >= 3 && stdDev > 1e-9) {
    let sumCubedDiff = 0;
    for (let i = 0; i < n; i++) {
      const z = (sorted[i]! - mean) / stdDev;
      sumCubedDiff += z * z * z;
    }
    skewness = (n / ((n - 1) * (n - 2))) * sumCubedDiff;
  }

  return {
    min,
    q1,
    median,
    q3,
    max,
    mean,
    stdDev,
    iqr,
    lowerFence,
    upperFence,
    outliers,
    count: n,
    skewness: Number.isFinite(skewness) ? skewness : null,
  };
}

/**
 * Genera intervalos y frecuencias dinámicas para el histograma.
 */
export function calculateHistogramBins(
  values: readonly (number | null | undefined)[],
  targetBinCount: number | 'auto' = 'auto',
): HistogramData {
  const clean = values.filter(
    (v): v is number => v !== null && v !== undefined && Number.isFinite(v),
  );

  const n = clean.length;
  if (n === 0) {
    return { bins: [], binWidth: 0, totalCount: 0, min: 0, max: 0 };
  }

  const sorted = [...clean].sort((a, b) => a - b);
  const min = sorted[0]!;
  const max = sorted[sorted.length - 1]!;

  if (min === max) {
    return {
      bins: [
        {
          x0: min,
          x1: max,
          label: `${min.toLocaleString('es-MX')}`,
          count: n,
          relativeFrequency: 100,
        },
      ],
      binWidth: 0,
      totalCount: n,
      min,
      max,
    };
  }

  let binCount: number;
  if (targetBinCount === 'auto') {
    const q1 = quantile(sorted, 0.25);
    const q3 = quantile(sorted, 0.75);
    const iqr = q3 - q1;

    // Regla de Freedman-Diaconis: h = 2 * IQR / n^(1/3)
    if (iqr > 0) {
      const h = (2 * iqr) / Math.cbrt(n);
      binCount = Math.round((max - min) / h);
    } else {
      // Sturges fallback: k = log2(n) + 1
      binCount = Math.round(Math.log2(n) + 1);
    }
    // Clamp to reasonable defaults
    binCount = Math.max(5, Math.min(30, binCount));
  } else {
    binCount = Math.max(2, Math.min(100, targetBinCount));
  }

  const range = max - min;
  const binWidth = range / binCount;
  const bins: HistogramBin[] = [];

  for (let i = 0; i < binCount; i++) {
    const x0 = min + i * binWidth;
    const x1 = i === binCount - 1 ? max : min + (i + 1) * binWidth;
    const label = `${formatCompact(x0)} – ${formatCompact(x1)}`;
    bins.push({
      x0,
      x1,
      label,
      count: 0,
      relativeFrequency: 0,
    });
  }

  for (const v of clean) {
    let index = Math.floor((v - min) / binWidth);
    if (index >= binCount) index = binCount - 1;
    if (index < 0) index = 0;
    bins[index]!.count++;
  }

  for (const b of bins) {
    b.relativeFrequency = (b.count / n) * 100;
  }

  return {
    bins,
    binWidth,
    totalCount: n,
    min,
    max,
  };
}

function formatCompact(val: number): string {
  if (Math.abs(val) >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
  if (Math.abs(val) >= 1000) return `${(val / 1000).toFixed(1)}k`;
  if (Number.isInteger(val)) return val.toString();
  return val.toFixed(1);
}

/**
 * Calcula la distribución global y opcionalmente desglosada por grupos de dimensión.
 */
export function computeDistributions(
  rows: readonly AnalysisRow[],
  measure: string,
  groupDim?: string | null,
  binCount: number | 'auto' = 'auto',
): DistributionResult {
  const overallValues = rows.map((r) => r.values[measure] ?? null);
  const overall = calculateFiveNumberSummary(overallValues);
  const histogram = calculateHistogramBins(overallValues, binCount);

  let groups: GroupDistribution[] | null = null;

  if (groupDim) {
    const map = new Map<string, number[]>();
    for (const row of rows) {
      const g = row.dims[groupDim] ?? '(Sin grupo)';
      const val = row.values[measure];
      if (val !== null && val !== undefined && Number.isFinite(val)) {
        let arr = map.get(g);
        if (!arr) {
          arr = [];
          map.set(g, arr);
        }
        arr.push(val);
      }
    }

    groups = [];
    for (const [groupName, groupVals] of map.entries()) {
      if (groupVals.length > 0) {
        groups.push({
          group: groupName,
          count: groupVals.length,
          summary: calculateFiveNumberSummary(groupVals),
        });
      }
    }

    // Ordenar grupos por número de elementos o mediana descendente
    groups.sort((a, b) => b.summary.median - a.summary.median);
  }

  return {
    measureName: measure,
    groupDimName: groupDim ?? null,
    overall,
    histogram,
    groups,
    totalRows: rows.length,
  };
}
