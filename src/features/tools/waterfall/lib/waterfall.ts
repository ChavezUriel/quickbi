import { addDays, daysBetween, formatDay, startOfUnit } from '@/features/analysis/lib/dates';
import { EMPTY_LABEL, type AnalysisRow, type DateWindow, type Granularity } from '@/features/analysis/types';

export type WaterfallBucketType =
  | 'inicio'
  | 'crecimiento'
  | 'contraccion'
  | 'nuevo'
  | 'perdido'
  | 'sin_cambio'
  | 'final';

export type SplitMode = 'mitades' | 'ultimos_periodos' | 'personalizado';

export interface WaterfallItem {
  category: string;
  type: WaterfallBucketType;
  p1: number;
  p2: number;
  diff: number;
  diffPct: number | null;
  /** Aporte porcentual a la variación neta absoluta. */
  shareOfDiff: number;
}

export interface WaterfallBridgeStep {
  name: string;
  type: WaterfallBucketType;
  /** Valor base invisible para apilar en ECharts. */
  base: number;
  /** Altura de la barra visible. */
  barValue: number;
  /** Variación con signo (o total si es inicio/final). */
  signedValue: number;
  p1?: number;
  p2?: number;
}

export interface WaterfallBucketsSummary {
  newAmount: number;
  newCount: number;
  growthAmount: number;
  growthCount: number;
  shrinkageAmount: number;
  shrinkageCount: number;
  lostAmount: number;
  lostCount: number;
}

export interface WaterfallResult {
  period1: DateWindow;
  period2: DateWindow;
  period1Label: string;
  period2Label: string;
  totalP1: number;
  totalP2: number;
  netDiff: number;
  netDiffPct: number | null;
  items: WaterfallItem[];
  bridgeSteps: WaterfallBridgeStep[];
  buckets: WaterfallBucketsSummary;
  ignoredRows: number;
}

export interface WaterfallParams {
  dimension: string;
  measure: string;
  splitMode: SplitMode;
  periodUnit: Granularity;
  customPeriod1?: DateWindow;
  customPeriod2?: DateWindow;
  maxCategories: number;
}

/**
 * Calcula el puente de variación (waterfall) entre dos períodos para una dimensión y métrica.
 */
export function computeWaterfall(
  rows: readonly AnalysisRow[],
  params: WaterfallParams,
): WaterfallResult | null {
  const { dimension, measure, splitMode, periodUnit, customPeriod1, customPeriod2, maxCategories } = params;

  if (rows.length === 0) return null;

  // 1. Encontrar los extremos temporales de las filas con fecha válida
  let minDay: string | null = null;
  let maxDay: string | null = null;

  for (const row of rows) {
    if (row.day !== null) {
      if (minDay === null || row.day < minDay) minDay = row.day;
      if (maxDay === null || row.day > maxDay) maxDay = row.day;
    }
  }

  if (minDay === null || maxDay === null) return null;

  // 2. Determinar las ventanas de los períodos 1 y 2
  const { period1, period2 } = resolvePeriods({
    minDay,
    maxDay,
    splitMode,
    periodUnit,
    customPeriod1,
    customPeriod2,
  });

  const p1Map = new Map<string, number>();
  const p2Map = new Map<string, number>();
  let ignoredRows = 0;

  for (const row of rows) {
    const cat = row.dims[dimension] ?? EMPTY_LABEL;
    const val = row.values[measure];

    if (val === null || val === undefined || !Number.isFinite(val) || row.day === null) {
      ignoredRows += 1;
      continue;
    }

    if (row.day >= period1.desde && row.day <= period1.hasta) {
      p1Map.set(cat, (p1Map.get(cat) ?? 0) + val);
    } else if (row.day >= period2.desde && row.day <= period2.hasta) {
      p2Map.set(cat, (p2Map.get(cat) ?? 0) + val);
    } else {
      ignoredRows += 1;
    }
  }

  const allCategories = Array.from(new Set([...p1Map.keys(), ...p2Map.keys()]));
  if (allCategories.length === 0) {
    return null;
  }

  let totalP1 = 0;
  let totalP2 = 0;

  const rawItems: WaterfallItem[] = allCategories.map((cat) => {
    const p1 = p1Map.get(cat) ?? 0;
    const p2 = p2Map.get(cat) ?? 0;
    const diff = p2 - p1;

    totalP1 += p1;
    totalP2 += p2;

    let type: WaterfallBucketType = 'sin_cambio';
    if (p1 === 0 && p2 > 0) {
      type = 'nuevo';
    } else if (p1 > 0 && p2 === 0) {
      type = 'perdido';
    } else if (diff > 0) {
      type = 'crecimiento';
    } else if (diff < 0) {
      type = 'contraccion';
    }

    const diffPct = p1 !== 0 ? ((p2 - p1) / Math.abs(p1)) * 100 : p2 > 0 ? 100 : null;

    return {
      category: cat,
      type,
      p1,
      p2,
      diff,
      diffPct,
      shareOfDiff: 0, // se calculará tras calcular netDiff
    };
  });

  const netDiff = totalP2 - totalP1;
  const netDiffPct = totalP1 !== 0 ? (netDiff / Math.abs(totalP1)) * 100 : totalP2 > 0 ? 100 : null;
  const absNetDiff = Math.abs(netDiff);

  // Calcular aportes porcentuales
  for (const item of rawItems) {
    item.shareOfDiff = absNetDiff > 0 ? (Math.abs(item.diff) / absNetDiff) * 100 : 0;
  }

  // Agrupar por buckets de variación
  const buckets: WaterfallBucketsSummary = {
    newAmount: 0,
    newCount: 0,
    growthAmount: 0,
    growthCount: 0,
    shrinkageAmount: 0,
    shrinkageCount: 0,
    lostAmount: 0,
    lostCount: 0,
  };

  for (const item of rawItems) {
    if (item.type === 'nuevo') {
      buckets.newAmount += item.diff;
      buckets.newCount += 1;
    } else if (item.type === 'crecimiento') {
      buckets.growthAmount += item.diff;
      buckets.growthCount += 1;
    } else if (item.type === 'contraccion') {
      buckets.shrinkageAmount += item.diff;
      buckets.shrinkageCount += 1;
    } else if (item.type === 'perdido') {
      buckets.lostAmount += item.diff;
      buckets.lostCount += 1;
    }
  }

  // Ordenar categorías por impacto absoluto |diff| descendente
  rawItems.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

  let finalItems: WaterfallItem[] = [];
  const limit = maxCategories > 0 ? maxCategories : rawItems.length;

  if (rawItems.length <= limit) {
    finalItems = rawItems;
  } else {
    const topItems = rawItems.slice(0, limit);
    const restItems = rawItems.slice(limit);

    const restP1 = restItems.reduce((sum, item) => sum + item.p1, 0);
    const restP2 = restItems.reduce((sum, item) => sum + item.p2, 0);
    const restDiff = restP2 - restP1;
    const restDiffPct = restP1 !== 0 ? (restDiff / Math.abs(restP1)) * 100 : restP2 > 0 ? 100 : null;

    let restType: WaterfallBucketType = 'sin_cambio';
    if (restP1 === 0 && restP2 > 0) restType = 'nuevo';
    else if (restP1 > 0 && restP2 === 0) restType = 'perdido';
    else if (restDiff > 0) restType = 'crecimiento';
    else if (restDiff < 0) restType = 'contraccion';

    const restItem: WaterfallItem = {
      category: `Resto (${restItems.length} categorías)`,
      type: restType,
      p1: restP1,
      p2: restP2,
      diff: restDiff,
      diffPct: restDiffPct,
      shareOfDiff: absNetDiff > 0 ? (Math.abs(restDiff) / absNetDiff) * 100 : 0,
    };

    finalItems = [...topItems, restItem];
  }

  // 3. Generar pasos para el gráfico de cascada (ECharts bridge)
  const period1Label = `${formatDay(period1.desde)} — ${formatDay(period1.hasta)}`;
  const period2Label = `${formatDay(period2.desde)} — ${formatDay(period2.hasta)}`;

  const bridgeSteps: WaterfallBridgeStep[] = [];

  // Paso 1: Inicio
  bridgeSteps.push({
    name: 'P1: Inicio',
    type: 'inicio',
    base: 0,
    barValue: Math.max(0, totalP1),
    signedValue: totalP1,
    p1: totalP1,
    p2: totalP1,
  });

  // Pasos intermedios
  let runningTotal = totalP1;
  for (const item of finalItems) {
    if (item.diff === 0) continue;

    if (item.diff > 0) {
      bridgeSteps.push({
        name: item.category,
        type: item.type,
        base: Math.max(0, runningTotal),
        barValue: item.diff,
        signedValue: item.diff,
        p1: item.p1,
        p2: item.p2,
      });
      runningTotal += item.diff;
    } else {
      runningTotal += item.diff;
      bridgeSteps.push({
        name: item.category,
        type: item.type,
        base: Math.max(0, runningTotal),
        barValue: Math.abs(item.diff),
        signedValue: item.diff,
        p1: item.p1,
        p2: item.p2,
      });
    }
  }

  // Paso final: Período 2
  bridgeSteps.push({
    name: 'P2: Final',
    type: 'final',
    base: 0,
    barValue: Math.max(0, totalP2),
    signedValue: totalP2,
    p1: totalP2,
    p2: totalP2,
  });

  return {
    period1,
    period2,
    period1Label,
    period2Label,
    totalP1,
    totalP2,
    netDiff,
    netDiffPct,
    items: finalItems,
    bridgeSteps,
    buckets,
    ignoredRows,
  };
}

function resolvePeriods({
  minDay,
  maxDay,
  splitMode,
  periodUnit,
  customPeriod1,
  customPeriod2,
}: {
  minDay: string;
  maxDay: string;
  splitMode: SplitMode;
  periodUnit: Granularity;
  customPeriod1?: DateWindow;
  customPeriod2?: DateWindow;
}): { period1: DateWindow; period2: DateWindow } {
  if (splitMode === 'personalizado' && customPeriod1 && customPeriod2) {
    return { period1: customPeriod1, period2: customPeriod2 };
  }

  if (splitMode === 'ultimos_periodos') {
    // Último período según el grano elegido vs período inmediatamente anterior
    const p2Start = startOfUnit(maxDay, periodUnit);
    const p2End = maxDay;

    // Período 1 = misma duración antes de p2Start
    const span = daysBetween(p2Start, p2End);
    const p1End = addDays(p2Start, -1);
    const p1Start = addDays(p1End, -span);

    return {
      period1: { desde: p1Start, hasta: p1End },
      period2: { desde: p2Start, hasta: p2End },
    };
  }

  // Por defecto: 'mitades'
  const totalDays = daysBetween(minDay, maxDay);
  if (totalDays <= 1) {
    return {
      period1: { desde: minDay, hasta: minDay },
      period2: { desde: maxDay, hasta: maxDay },
    };
  }

  const half = Math.floor(totalDays / 2);
  const midpoint = addDays(minDay, half);
  const nextDay = addDays(midpoint, 1);

  return {
    period1: { desde: minDay, hasta: midpoint },
    period2: { desde: nextDay, hasta: maxDay },
  };
}
