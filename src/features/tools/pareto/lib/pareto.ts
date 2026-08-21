import type { AnalysisRow } from '@/features/analysis/types';

export type ABCClass = 'A' | 'B' | 'C';

export interface ParetoItem {
  rank: number;
  entity: string;
  value: number;
  share: number; // 0 to 100 %
  cumulativeValue: number;
  cumulativeShare: number; // 0 to 100 %
  classABC: ABCClass;
}

export interface ABCClassSummary {
  classABC: ABCClass;
  label: string;
  count: number;
  countShare: number; // 0 to 100 %
  totalValue: number;
  valueShare: number; // 0 to 100 %
  meanValue: number;
  minRank: number;
  maxRank: number;
}

export interface ConcentrationMetrics {
  gini: number; // 0 to 1
  entitiesFor80: number;
  entitiesFor80Share: number; // 0 to 100 %
  top1Share: number;
  top5Share: number;
  top10Share: number;
  top20Share: number;
}

export interface ParetoResult {
  categoryDim: string;
  measureColumn: string;
  thresholdA: number;
  thresholdB: number;
  totalValue: number;
  totalEntities: number;
  items: ParetoItem[];
  summaryABC: Record<ABCClass, ABCClassSummary>;
  concentration: ConcentrationMetrics;
}

export interface ParetoOptions {
  thresholdA?: number; // default 80
  thresholdB?: number; // default 95
}

/**
 * Calcula el coeficiente de Gini (medida de desigualdad/concentración entre 0 y 1).
 * 0 = perfecta igualdad, 1 = máxima concentración (un solo elemento tiene el 100%).
 */
export function calculateGini(values: readonly number[]): number {
  const clean = values.filter((v) => Number.isFinite(v) && v > 0);
  const n = clean.length;
  if (n <= 1) return 0;

  const sorted = [...clean].sort((a, b) => a - b);
  let totalSum = 0;
  for (let i = 0; i < n; i++) totalSum += sorted[i]!;

  if (totalSum <= 0) return 0;

  let weightedSum = 0;
  for (let i = 0; i < n; i++) {
    // 1-based rank index: i + 1
    weightedSum += (2 * (i + 1) - n - 1) * sorted[i]!;
  }

  const gini = weightedSum / (n * totalSum);
  return Math.max(0, Math.min(1, gini));
}

/**
 * Calcula el análisis de Pareto y la clasificación ABC sobre un dataset.
 */
export function computePareto(
  rows: readonly AnalysisRow[],
  categoryDim: string,
  measureColumn: string,
  options: ParetoOptions = {},
): ParetoResult {
  const thresholdA = options.thresholdA ?? 80;
  const thresholdB = options.thresholdB ?? 95;

  // 1. Agrupar valores por entidad
  const map = new Map<string, number>();
  for (const row of rows) {
    const entity = row.dims[categoryDim] ?? '(Sin categoría)';
    const val = row.values[measureColumn];
    if (val !== null && val !== undefined && Number.isFinite(val)) {
      map.set(entity, (map.get(entity) ?? 0) + val);
    }
  }

  // Ordenar entidades descendentemente por valor acumulado
  const sortedEntries = Array.from(map.entries())
    .map(([entity, value]) => ({ entity, value: Math.max(0, value) }))
    .sort((a, b) => b.value - a.value);

  const totalEntities = sortedEntries.length;
  const totalValue = sortedEntries.reduce((acc, curr) => acc + curr.value, 0);

  // 2. Construir ítems de Pareto con share acumulado y clase ABC
  const items: ParetoItem[] = [];
  let runningSum = 0;

  for (let i = 0; i < sortedEntries.length; i++) {
    const entry = sortedEntries[i]!;
    runningSum += entry.value;
    const share = totalValue > 0 ? (entry.value / totalValue) * 100 : 0;
    const cumulativeShare = totalValue > 0 ? (runningSum / totalValue) * 100 : 0;

    let classABC: ABCClass = 'C';
    // Asignación de clase: si el punto anterior estaba bajo el umbral, califica
    const prevCumShare =
      i > 0 && totalValue > 0 ? ((runningSum - entry.value) / totalValue) * 100 : 0;

    if (prevCumShare < thresholdA) {
      classABC = 'A';
    } else if (prevCumShare < thresholdB) {
      classABC = 'B';
    } else {
      classABC = 'C';
    }

    items.push({
      rank: i + 1,
      entity: entry.entity,
      value: entry.value,
      share,
      cumulativeValue: runningSum,
      cumulativeShare,
      classABC,
    });
  }

  // 3. Resúmenes por clase ABC
  const emptySummary = (cls: ABCClass, label: string): ABCClassSummary => ({
    classABC: cls,
    label,
    count: 0,
    countShare: 0,
    totalValue: 0,
    valueShare: 0,
    meanValue: 0,
    minRank: 0,
    maxRank: 0,
  });

  const summaryABC: Record<ABCClass, ABCClassSummary> = {
    A: emptySummary('A', `Clase A (Hasta ${thresholdA}%)`),
    B: emptySummary('B', `Clase B (${thresholdA}% a ${thresholdB}%)`),
    C: emptySummary('C', `Clase C (${thresholdB}% a 100%)`),
  };

  for (const item of items) {
    const s = summaryABC[item.classABC];
    s.count++;
    s.totalValue += item.value;
    if (s.minRank === 0 || item.rank < s.minRank) s.minRank = item.rank;
    if (item.rank > s.maxRank) s.maxRank = item.rank;
  }

  for (const cls of ['A', 'B', 'C'] as const) {
    const s = summaryABC[cls];
    s.countShare = totalEntities > 0 ? (s.count / totalEntities) * 100 : 0;
    s.valueShare = totalValue > 0 ? (s.totalValue / totalValue) * 100 : 0;
    s.meanValue = s.count > 0 ? s.totalValue / s.count : 0;
  }

  // 4. Métricas de concentración
  const gini = calculateGini(sortedEntries.map((e) => e.value));

  // Entidades necesarias para alcanzar el 80%
  let entitiesFor80 = 0;
  for (let i = 0; i < items.length; i++) {
    entitiesFor80 = i + 1;
    if (items[i]!.cumulativeShare >= 80) break;
  }
  const entitiesFor80Share =
    totalEntities > 0 ? (entitiesFor80 / totalEntities) * 100 : 0;

  const topNShare = (pct: number) => {
    const count = Math.max(1, Math.round(totalEntities * (pct / 100)));
    const sum = items.slice(0, count).reduce((acc, it) => acc + it.value, 0);
    return totalValue > 0 ? (sum / totalValue) * 100 : 0;
  };

  const concentration: ConcentrationMetrics = {
    gini,
    entitiesFor80,
    entitiesFor80Share,
    top1Share: topNShare(1),
    top5Share: topNShare(5),
    top10Share: topNShare(10),
    top20Share: topNShare(20),
  };

  return {
    categoryDim,
    measureColumn,
    thresholdA,
    thresholdB,
    totalValue,
    totalEntities,
    items,
    summaryABC,
    concentration,
  };
}
