import type { AnalysisRow } from '@/features/analysis/types';

export interface SegmentMetricSummary {
  metric: string;
  label: string;
  countA: number;
  countB: number;
  sumA: number;
  sumB: number;
  meanA: number;
  meanB: number;
  deltaSumAbs: number;
  deltaSumPct: number | null;
  deltaMeanAbs: number;
  deltaMeanPct: number | null;
}

export interface MixShiftRow {
  category: string;
  countA: number;
  countB: number;
  shareA: number; // 0 to 1
  shareB: number; // 0 to 1
  deltaShare: number; // shareB - shareA
  meanA: number;
  meanB: number;
  deltaMean: number;
  mixEffect: number; // (shareB - shareA) * meanA
  rateEffect: number; // shareB * (meanB - meanA)
  totalEffect: number; // mixEffect + rateEffect
}

export interface MixShiftAnalysis {
  breakdownDim: string;
  measure: string;
  rows: MixShiftRow[];
  totalMixEffect: number;
  totalRateEffect: number;
  totalMeanDelta: number;
  meanA: number;
  meanB: number;
}

export interface SegmentComparisonResult {
  segmentDim: string;
  segmentAName: string;
  segmentBName: string;
  segmentAValues: string[];
  segmentBValues: string[];
  countA: number;
  countB: number;
  totalRows: number;
  metrics: SegmentMetricSummary[];
  primaryMetric: SegmentMetricSummary | null;
  mixShift: MixShiftAnalysis | null;
}

export interface SegmentConfig {
  segmentDim: string;
  segmentAValues: string[];
  segmentBValues: string[];
  segmentAName?: string;
  segmentBName?: string;
  primaryMeasure: string;
  allMeasures?: string[];
  breakdownDim?: string | null;
}

/**
 * Compara todas las métricas entre el Segmento A y el Segmento B.
 */
export function computeSegmentComparison(
  rows: readonly AnalysisRow[],
  config: SegmentConfig,
): SegmentComparisonResult {
  const {
    segmentDim,
    segmentAValues,
    segmentBValues,
    segmentAName = 'Segmento A',
    segmentBName = 'Segmento B',
    primaryMeasure,
    allMeasures = [primaryMeasure],
    breakdownDim = null,
  } = config;

  const setA = new Set(segmentAValues);
  const setB = new Set(segmentBValues);

  const rowsA: AnalysisRow[] = [];
  const rowsB: AnalysisRow[] = [];

  for (const row of rows) {
    const val = row.dims[segmentDim];
    if (val !== undefined) {
      if (setA.has(val)) rowsA.push(row);
      if (setB.has(val)) rowsB.push(row);
    }
  }

  const countA = rowsA.length;
  const countB = rowsB.length;

  const metricSummaries: SegmentMetricSummary[] = [];

  for (const metric of allMeasures) {
    let sumA = 0;
    let validA = 0;
    for (const r of rowsA) {
      const v = r.values[metric];
      if (v !== null && v !== undefined && Number.isFinite(v)) {
        sumA += v;
        validA++;
      }
    }

    let sumB = 0;
    let validB = 0;
    for (const r of rowsB) {
      const v = r.values[metric];
      if (v !== null && v !== undefined && Number.isFinite(v)) {
        sumB += v;
        validB++;
      }
    }

    const meanA = validA > 0 ? sumA / validA : 0;
    const meanB = validB > 0 ? sumB / validB : 0;

    const deltaSumAbs = sumB - sumA;
    const deltaSumPct =
      Math.abs(sumA) > 1e-9 ? ((sumB - sumA) / Math.abs(sumA)) * 100 : null;

    const deltaMeanAbs = meanB - meanA;
    const deltaMeanPct =
      Math.abs(meanA) > 1e-9 ? ((meanB - meanA) / Math.abs(meanA)) * 100 : null;

    metricSummaries.push({
      metric,
      label: metric,
      countA: validA,
      countB: validB,
      sumA,
      sumB,
      meanA,
      meanB,
      deltaSumAbs,
      deltaSumPct,
      deltaMeanAbs,
      deltaMeanPct,
    });
  }

  const primaryMetricSummary =
    metricSummaries.find((m) => m.metric === primaryMeasure) ??
    metricSummaries[0] ??
    null;

  let mixShift: MixShiftAnalysis | null = null;
  if (breakdownDim && primaryMeasure) {
    mixShift = computeMixShift(rowsA, rowsB, breakdownDim, primaryMeasure);
  }

  return {
    segmentDim,
    segmentAName,
    segmentBName,
    segmentAValues: [...segmentAValues],
    segmentBValues: [...segmentBValues],
    countA,
    countB,
    totalRows: rows.length,
    metrics: metricSummaries,
    primaryMetric: primaryMetricSummary,
    mixShift,
  };
}

/**
 * Descomposición Mix-Shift estándar (Kittredge decomposition):
 * Variación de la media global Δ = MeanB - MeanA
 * Efecto Mix = Σ (ShareB_k - ShareA_k) * MeanA_k
 * Efecto Tasa/Rendimiento = Σ ShareB_k * (MeanB_k - MeanA_k)
 * Verificación: Efecto Mix + Efecto Tasa = Δ
 */
export function computeMixShift(
  rowsA: readonly AnalysisRow[],
  rowsB: readonly AnalysisRow[],
  breakdownDim: string,
  measure: string,
): MixShiftAnalysis {
  // Aggregate stats per category for A
  const catMapA = new Map<string, { count: number; sum: number }>();
  let totalValidA = 0;
  let totalSumA = 0;

  for (const r of rowsA) {
    const cat = r.dims[breakdownDim] ?? '(Sin categoría)';
    const v = r.values[measure];
    if (v !== null && v !== undefined && Number.isFinite(v)) {
      totalValidA++;
      totalSumA += v;
      const cur = catMapA.get(cat) ?? { count: 0, sum: 0 };
      cur.count++;
      cur.sum += v;
      catMapA.set(cat, cur);
    }
  }

  // Aggregate stats per category for B
  const catMapB = new Map<string, { count: number; sum: number }>();
  let totalValidB = 0;
  let totalSumB = 0;

  for (const r of rowsB) {
    const cat = r.dims[breakdownDim] ?? '(Sin categoría)';
    const v = r.values[measure];
    if (v !== null && v !== undefined && Number.isFinite(v)) {
      totalValidB++;
      totalSumB += v;
      const cur = catMapB.get(cat) ?? { count: 0, sum: 0 };
      cur.count++;
      cur.sum += v;
      catMapB.set(cat, cur);
    }
  }

  const overallMeanA = totalValidA > 0 ? totalSumA / totalValidA : 0;
  const overallMeanB = totalValidB > 0 ? totalSumB / totalValidB : 0;
  const totalMeanDelta = overallMeanB - overallMeanA;

  const allCategories = new Set([...catMapA.keys(), ...catMapB.keys()]);
  const rows: MixShiftRow[] = [];

  let totalMixEffect = 0;
  let totalRateEffect = 0;

  for (const cat of allCategories) {
    const statA = catMapA.get(cat) ?? { count: 0, sum: 0 };
    const statB = catMapB.get(cat) ?? { count: 0, sum: 0 };

    const shareA = totalValidA > 0 ? statA.count / totalValidA : 0;
    const shareB = totalValidB > 0 ? statB.count / totalValidB : 0;
    const deltaShare = shareB - shareA;

    const meanA = statA.count > 0 ? statA.sum / statA.count : overallMeanA;
    const meanB = statB.count > 0 ? statB.sum / statB.count : overallMeanB;
    const deltaMean = meanB - meanA;

    const mixEffect = deltaShare * meanA;
    const rateEffect = shareB * deltaMean;
    const totalEffect = mixEffect + rateEffect;

    totalMixEffect += mixEffect;
    totalRateEffect += rateEffect;

    rows.push({
      category: cat,
      countA: statA.count,
      countB: statB.count,
      shareA,
      shareB,
      deltaShare,
      meanA,
      meanB,
      deltaMean,
      mixEffect,
      rateEffect,
      totalEffect,
    });
  }

  // Sort categories by highest volume or absolute total effect
  rows.sort((a, b) => Math.abs(b.totalEffect) - Math.abs(a.totalEffect));

  return {
    breakdownDim,
    measure,
    rows,
    totalMixEffect,
    totalRateEffect,
    totalMeanDelta,
    meanA: overallMeanA,
    meanB: overallMeanB,
  };
}
