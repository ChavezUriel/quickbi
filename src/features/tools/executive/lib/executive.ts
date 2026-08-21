import { bucketLabel, bucketOf } from '@/features/analysis/lib/dates';
import type { Granularity } from '@/features/analysis/types';

export interface ExecutiveOptions {
  measureCol: string;
  dateCol?: string | null;
  dimensionCol?: string | null;
  grain?: Granularity;
  agg?: 'sum' | 'avg' | 'count';
}

export interface TimeBucketData {
  bucket: string;
  label: string;
  value: number;
}

export interface AnomalyItem {
  bucket: string;
  label: string;
  value: number;
  zScore: number;
  reason: string;
}

export interface ParetoCategory {
  name: string;
  value: number;
  share: number;
  cumulativeShare: number;
}

export interface ExecutiveSummary {
  totalCount: number;
  validCount: number;
  ignoredRows: number;
  totalValue: number;
  meanValue: number;
  medianValue: number;
  minValue: number;
  maxValue: number;
  stdDev: number;
  cv: number; // Coeficiente de variación (stdDev / mean)
  trend: {
    direction: 'creciente' | 'decreciente' | 'estable';
    percentageChange: number | null;
    slope: number;
    firstPeriodValue: number | null;
    lastPeriodValue: number | null;
    peakBucket: TimeBucketData | null;
    troughBucket: TimeBucketData | null;
    timeBuckets: TimeBucketData[];
  };
  anomalies: AnomalyItem[];
  pareto: {
    totalCategories: number;
    top20PercentShare: number;
    top3Share: number;
    topCategories: ParetoCategory[];
    isParetoConcentrated: boolean;
  };
  narrative: {
    headline: string;
    overview: string;
    trendText: string;
    concentrationText: string;
    insights: string[];
  };
}

export function computeExecutiveSummary(
  rows: readonly Record<string, unknown>[],
  options: ExecutiveOptions,
): ExecutiveSummary {
  const { measureCol, dateCol, dimensionCol, grain = 'mes', agg = 'sum' } = options;

  let totalCount = 0;
  let validCount = 0;
  let ignoredRows = 0;
  const values: number[] = [];

  // Agrupaciones temporales y dimensionales
  const dateMap = new Map<string, number[]>();
  const dimMap = new Map<string, number[]>();

  for (const row of rows) {
    totalCount++;
    const rawVal = row[measureCol];
    const val = typeof rawVal === 'number' && Number.isFinite(rawVal) ? rawVal : null;

    if (val === null) {
      ignoredRows++;
      continue;
    }

    validCount++;
    values.push(val);

    if (dateCol) {
      const rawDate = row[dateCol];
      if (typeof rawDate === 'string' && rawDate.length >= 10) {
        const iso = rawDate.slice(0, 10);
        try {
          const b = bucketOf(iso, grain);
          const list = dateMap.get(b) ?? [];
          list.push(val);
          dateMap.set(b, list);
        } catch {
          // Fecha inválida
        }
      }
    }

    if (dimensionCol) {
      const rawDim = row[dimensionCol];
      const dimKey =
        rawDim !== null && rawDim !== undefined && String(rawDim).trim() !== ''
          ? String(rawDim).trim()
          : '(Sin categoría)';
      const list = dimMap.get(dimKey) ?? [];
      list.push(val);
      dimMap.set(dimKey, list);
    }
  }

  if (values.length === 0) {
    return createEmptySummary(totalCount, ignoredRows);
  }

  // Métricas básicas
  const sum = values.reduce((a, b) => a + b, 0);
  const mean = sum / values.length;
  const sortedValues = [...values].sort((a, b) => a - b);
  const min = sortedValues[0] ?? 0;
  const max = sortedValues[sortedValues.length - 1] ?? 0;
  const mid = Math.floor(sortedValues.length / 2);
  const median =
    sortedValues.length % 2 !== 0
      ? (sortedValues[mid] ?? 0)
      : ((sortedValues[mid - 1] ?? 0) + (sortedValues[mid] ?? 0)) / 2;

  const variance =
    values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) /
    (values.length > 1 ? values.length - 1 : 1);
  const stdDev = Math.sqrt(variance);
  const cv = mean !== 0 ? (stdDev / Math.abs(mean)) * 100 : 0;

  // Análisis Temporal
  const sortedBuckets = Array.from(dateMap.keys()).sort();
  const timeBuckets: TimeBucketData[] = sortedBuckets.map((bucket) => {
    const list = dateMap.get(bucket)!;
    const bucketSum = list.reduce((a, b) => a + b, 0);
    const bucketVal = agg === 'avg' ? bucketSum / list.length : agg === 'count' ? list.length : bucketSum;
    return {
      bucket,
      label: bucketLabel(bucket, grain),
      value: bucketVal,
    };
  });

  let trendDirection: 'creciente' | 'decreciente' | 'estable' = 'estable';
  let percentageChange: number | null = null;
  let slope = 0;
  let peakBucket: TimeBucketData | null = null;
  let troughBucket: TimeBucketData | null = null;
  const anomalies: AnomalyItem[] = [];

  if (timeBuckets.length > 0) {
    let maxB = timeBuckets[0]!;
    let minB = timeBuckets[0]!;
    for (const tb of timeBuckets) {
      if (tb.value > maxB.value) maxB = tb;
      if (tb.value < minB.value) minB = tb;
    }
    peakBucket = maxB;
    troughBucket = minB;

    if (timeBuckets.length >= 2) {
      const first = timeBuckets[0]!.value;
      const last = timeBuckets[timeBuckets.length - 1]!.value;
      if (first !== 0) {
        percentageChange = ((last - first) / Math.abs(first)) * 100;
      }

      // Regresión lineal simple para la pendiente
      const n = timeBuckets.length;
      let sumX = 0;
      let sumY = 0;
      let sumXY = 0;
      let sumXX = 0;
      for (let i = 0; i < n; i++) {
        const x = i;
        const y = timeBuckets[i]!.value;
        sumX += x;
        sumY += y;
        sumXY += x * y;
        sumXX += x * x;
      }
      const denom = n * sumXX - sumX * sumX;
      slope = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;

      const relativeSlope = mean !== 0 ? (slope / Math.abs(mean)) * 100 : 0;
      if (relativeSlope > 2 || (percentageChange !== null && percentageChange > 5)) {
        trendDirection = 'creciente';
      } else if (relativeSlope < -2 || (percentageChange !== null && percentageChange < -5)) {
        trendDirection = 'decreciente';
      } else {
        trendDirection = 'estable';
      }

      // Detección de anomalías temporales (> 2 sigma de la serie temporal)
      const tMean = timeBuckets.reduce((acc, t) => acc + t.value, 0) / timeBuckets.length;
      const tVar =
        timeBuckets.reduce((acc, t) => acc + Math.pow(t.value - tMean, 2), 0) /
        (timeBuckets.length > 1 ? timeBuckets.length - 1 : 1);
      const tStd = Math.sqrt(tVar);

      if (tStd > 0) {
        for (const tb of timeBuckets) {
          const z = (tb.value - tMean) / tStd;
          if (Math.abs(z) >= 2.0) {
            anomalies.push({
              bucket: tb.bucket,
              label: tb.label,
              value: tb.value,
              zScore: z,
              reason: z > 0 ? 'Pico inusualmente alto (+2σ)' : 'Caída inusualmente baja (-2σ)',
            });
          }
        }
      }
    }
  }

  // Análisis de Pareto / Concentración Dimensional
  const dimCategories: { name: string; value: number }[] = [];
  let totalDimValue = 0;

  for (const [name, list] of dimMap.entries()) {
    const dSum = list.reduce((a, b) => a + b, 0);
    const dVal = agg === 'avg' ? dSum / list.length : agg === 'count' ? list.length : dSum;
    dimCategories.push({ name, value: dVal });
    totalDimValue += dVal;
  }

  dimCategories.sort((a, b) => b.value - a.value);

  let runningSum = 0;
  const paretoCategories: ParetoCategory[] = dimCategories.map((c) => {
    runningSum += c.value;
    const share = totalDimValue > 0 ? (c.value / totalDimValue) * 100 : 0;
    const cumulativeShare = totalDimValue > 0 ? (runningSum / totalDimValue) * 100 : 0;
    return {
      name: c.name,
      value: c.value,
      share,
      cumulativeShare,
    };
  });

  const totalCategories = paretoCategories.length;
  const top20Count = Math.max(1, Math.ceil(totalCategories * 0.2));
  const top20Share =
    totalCategories > 0
      ? paretoCategories.slice(0, top20Count).reduce((acc, c) => acc + c.share, 0)
      : 0;

  const top3Share =
    totalCategories > 0
      ? paretoCategories.slice(0, 3).reduce((acc, c) => acc + c.share, 0)
      : 0;

  const isParetoConcentrated = top20Share >= 70;

  // Generación de narrativa ejecutiva en español natural
  const narrative = generateNarrative({
    sum,
    mean,
    validCount,
    trendDirection,
    percentageChange,
    peakBucket,
    troughBucket,
    anomaliesCount: anomalies.length,
    totalCategories,
    top20Share,
    top3Share,
    topCategories: paretoCategories.slice(0, 3),
    isParetoConcentrated,
    hasDate: Boolean(dateCol && timeBuckets.length > 0),
    hasDimension: Boolean(dimensionCol && totalCategories > 0),
  });

  return {
    totalCount,
    validCount,
    ignoredRows,
    totalValue: sum,
    meanValue: mean,
    medianValue: median,
    minValue: min,
    maxValue: max,
    stdDev,
    cv,
    trend: {
      direction: trendDirection,
      percentageChange,
      slope,
      firstPeriodValue: timeBuckets[0]?.value ?? null,
      lastPeriodValue: timeBuckets[timeBuckets.length - 1]?.value ?? null,
      peakBucket,
      troughBucket,
      timeBuckets,
    },
    anomalies,
    pareto: {
      totalCategories,
      top20PercentShare: top20Share,
      top3Share,
      topCategories: paretoCategories,
      isParetoConcentrated,
    },
    narrative,
  };
}

function createEmptySummary(totalCount: number, ignoredRows: number): ExecutiveSummary {
  return {
    totalCount,
    validCount: 0,
    ignoredRows,
    totalValue: 0,
    meanValue: 0,
    medianValue: 0,
    minValue: 0,
    maxValue: 0,
    stdDev: 0,
    cv: 0,
    trend: {
      direction: 'estable',
      percentageChange: null,
      slope: 0,
      firstPeriodValue: null,
      lastPeriodValue: null,
      peakBucket: null,
      troughBucket: null,
      timeBuckets: [],
    },
    anomalies: [],
    pareto: {
      totalCategories: 0,
      top20PercentShare: 0,
      top3Share: 0,
      topCategories: [],
      isParetoConcentrated: false,
    },
    narrative: {
      headline: 'Sin datos válidos para calcular el resumen ejecutivo.',
      overview: 'No se encontraron registros numéricos válidos en las columnas seleccionadas.',
      trendText: 'No hay serie temporal disponible.',
      concentrationText: 'No hay dimensiones categóricas seleccionadas.',
      insights: ['Verifique la asignación de columnas en el paso de configuración.'],
    },
  };
}

interface NarrativeContext {
  sum: number;
  mean: number;
  validCount: number;
  trendDirection: 'creciente' | 'decreciente' | 'estable';
  percentageChange: number | null;
  peakBucket: TimeBucketData | null;
  troughBucket: TimeBucketData | null;
  anomaliesCount: number;
  totalCategories: number;
  top20Share: number;
  top3Share: number;
  topCategories: ParetoCategory[];
  isParetoConcentrated: boolean;
  hasDate: boolean;
  hasDimension: boolean;
}

function generateNarrative(ctx: NarrativeContext): ExecutiveSummary['narrative'] {
  const insights: string[] = [];

  let headline = 'Resumen de actividad y rendimiento general';
  if (ctx.hasDate && ctx.trendDirection === 'creciente') {
    headline = 'Comportamiento positivo con trayectoria alcista';
  } else if (ctx.hasDate && ctx.trendDirection === 'decreciente') {
    headline = 'Alerta de tendencia a la baja en el período evaluado';
  } else if (ctx.hasDimension && ctx.isParetoConcentrated) {
    headline = 'Alta concentración de volumen en pocas categorías';
  }

  const overview = `El conjunto de datos comprende ${ctx.validCount.toLocaleString('es-MX')} registros evaluados. La media global por registro se sitúa en ${ctx.mean.toLocaleString('es-MX', { maximumFractionDigits: 2 })}, con un volumen acumulado global representativo.`;

  let trendText = 'No se especificó una columna temporal para evaluar trayectoria.';
  if (ctx.hasDate) {
    if (ctx.trendDirection === 'creciente') {
      trendText = `La evolución temporal presenta una tendencia ascendente${
        ctx.percentageChange !== null ? ` con una variación global del +${ctx.percentageChange.toFixed(1)}%` : ''
      }. El pico máximo se registró en ${ctx.peakBucket?.label ?? 'N/D'} y el mínimo en ${ctx.troughBucket?.label ?? 'N/D'}.`;
      insights.push('El ritmo de crecimiento se mantiene positivo respecto al inicio del período.');
    } else if (ctx.trendDirection === 'decreciente') {
      trendText = `Se detecta una contracción sostenida${
        ctx.percentageChange !== null ? ` de ${ctx.percentageChange.toFixed(1)}%` : ''
      }. Conviene revisar los factores ocurridos a partir de ${ctx.peakBucket?.label ?? 'el período pico'}.`;
      insights.push('Se sugiere monitorear las causas de desaceleración y revisar posibles pérdidas de demanda.');
    } else {
      trendText = `La trayectoria temporal se mantiene en rango estable${
        ctx.percentageChange !== null ? ` (${ctx.percentageChange >= 0 ? '+' : ''}${ctx.percentageChange.toFixed(1)}%)` : ''
      } sin oscilaciones estructurales drásticas.`;
      insights.push('La estabilidad observada ofrece predictibilidad operativa a corto plazo.');
    }

    if (ctx.anomaliesCount > 0) {
      insights.push(`Se identificaron ${ctx.anomaliesCount} períodos con desviaciones estadísticas atípicas (±2σ).`);
    }
  }

  let concentrationText = 'No se seleccionó una dimensión categórica para evaluar concentración.';
  if (ctx.hasDimension && ctx.totalCategories > 0) {
    const topNames = ctx.topCategories.map((c) => `«${c.name}» (${c.share.toFixed(1)}%)`).join(', ');
    concentrationText = `Se analizaron ${ctx.totalCategories} categorías. El top 20% concentra el ${ctx.top20Share.toFixed(1)}% del volumen total. Los principales contribuyentes son: ${topNames}.`;

    if (ctx.isParetoConcentrated) {
      insights.push(`Existe alta dependencia en el Top 20% (${ctx.top20Share.toFixed(1)}% del total). Estrategia recomendada: fidelización prioritaria.`);
    } else {
      insights.push('La distribución entre categorías se encuentra diversificada y con bajo riesgo de concentración.');
    }
  }

  if (insights.length === 0) {
    insights.push('Los indicadores clave reflejan un comportamiento dentro de parámetros esperados.');
  }

  return {
    headline,
    overview,
    trendText,
    concentrationText,
    insights,
  };
}
