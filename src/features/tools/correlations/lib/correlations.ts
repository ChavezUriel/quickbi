import type { AnalysisRow } from '@/features/analysis/types';

export interface CorrelationCell {
  xMeasure: string;
  yMeasure: string;
  r: number | null;
  count: number;
}

export interface CorrelationPair {
  xMeasure: string;
  yMeasure: string;
  r: number;
  count: number;
  strength: 'muy_fuerte' | 'fuerte' | 'moderada' | 'debil' | 'nula';
}

export interface CorrelationMatrix {
  measures: string[];
  cells: CorrelationCell[][];
  pairs: CorrelationPair[];
  topPositive: CorrelationPair[];
  topNegative: CorrelationPair[];
}

export interface RegressionResult {
  slope: number;
  intercept: number;
  r2: number;
  r: number;
  count: number;
  xMean: number;
  yMean: number;
  xStd: number;
  yStd: number;
  equation: string;
}

export interface ScatterPoint {
  x: number;
  y: number;
  label: string;
}

export interface PairAnalysis {
  xMeasure: string;
  yMeasure: string;
  r: number | null;
  regression: RegressionResult | null;
  points: ScatterPoint[];
  count: number;
}

/**
 * Coeficiente de correlación de Pearson r ∈ [-1, 1].
 * Devuelve `null` si hay menos de 2 puntos válidos o si la varianza de alguna variable es 0.
 */
export function pearsonCorrelation(
  x: readonly (number | null | undefined)[],
  y: readonly (number | null | undefined)[],
): number | null {
  if (x.length !== y.length || x.length < 2) return null;

  const validX: number[] = [];
  const validY: number[] = [];

  for (let i = 0; i < x.length; i++) {
    const vx = x[i];
    const vy = y[i];
    if (
      vx !== null &&
      vx !== undefined &&
      vy !== null &&
      vy !== undefined &&
      Number.isFinite(vx) &&
      Number.isFinite(vy)
    ) {
      validX.push(vx);
      validY.push(vy);
    }
  }

  const n = validX.length;
  if (n < 2) return null;

  let sumX = 0;
  let sumY = 0;
  for (let i = 0; i < n; i++) {
    sumX += validX[i]!;
    sumY += validY[i]!;
  }
  const meanX = sumX / n;
  const meanY = sumY / n;

  let cov = 0;
  let varX = 0;
  let varY = 0;

  for (let i = 0; i < n; i++) {
    const dx = validX[i]! - meanX;
    const dy = validY[i]! - meanY;
    cov += dx * dy;
    varX += dx * dx;
    varY += dy * dy;
  }

  if (varX <= 1e-12 || varY <= 1e-12) return null;

  const r = cov / (Math.sqrt(varX) * Math.sqrt(varY));
  if (!Number.isFinite(r)) return null;

  return Math.max(-1, Math.min(1, r));
}

/**
 * Regresión lineal simple por mínimos cuadrados: y = mx + b
 */
export function linearRegression(
  x: readonly (number | null | undefined)[],
  y: readonly (number | null | undefined)[],
): RegressionResult | null {
  if (x.length !== y.length || x.length < 2) return null;

  const validX: number[] = [];
  const validY: number[] = [];

  for (let i = 0; i < x.length; i++) {
    const vx = x[i];
    const vy = y[i];
    if (
      vx !== null &&
      vx !== undefined &&
      vy !== null &&
      vy !== undefined &&
      Number.isFinite(vx) &&
      Number.isFinite(vy)
    ) {
      validX.push(vx);
      validY.push(vy);
    }
  }

  const n = validX.length;
  if (n < 2) return null;

  let sumX = 0;
  let sumY = 0;
  for (let i = 0; i < n; i++) {
    sumX += validX[i]!;
    sumY += validY[i]!;
  }
  const meanX = sumX / n;
  const meanY = sumY / n;

  let cov = 0;
  let varX = 0;
  let varY = 0;

  for (let i = 0; i < n; i++) {
    const dx = validX[i]! - meanX;
    const dy = validY[i]! - meanY;
    cov += dx * dy;
    varX += dx * dx;
    varY += dy * dy;
  }

  if (varX <= 1e-12) return null;

  const slope = cov / varX;
  const intercept = meanY - slope * meanX;

  const rVal = varY <= 1e-12 ? 0 : cov / (Math.sqrt(varX) * Math.sqrt(varY));
  const r = Math.max(-1, Math.min(1, Number.isFinite(rVal) ? rVal : 0));
  const r2 = Math.max(0, Math.min(1, r * r));

  const xStd = Math.sqrt(varX / (n - 1));
  const yStd = varY <= 1e-12 ? 0 : Math.sqrt(varY / (n - 1));

  const formattedSlope = formatNumber(slope);
  const formattedIntercept =
    Math.abs(intercept) < 1e-6
      ? ''
      : intercept >= 0
        ? ` + ${formatNumber(intercept)}`
        : ` - ${formatNumber(Math.abs(intercept))}`;
  const equation = `y = ${formattedSlope}x${formattedIntercept}`;

  return {
    slope,
    intercept,
    r2,
    r,
    count: n,
    xMean: meanX,
    yMean: meanY,
    xStd,
    yStd,
    equation,
  };
}

function formatNumber(val: number): string {
  if (Math.abs(val) >= 1000) return val.toFixed(1);
  if (Math.abs(val) >= 1) return val.toFixed(2);
  if (Math.abs(val) >= 0.001) return val.toFixed(3);
  return val.toExponential(2);
}

export function classifyStrength(
  absR: number,
): 'muy_fuerte' | 'fuerte' | 'moderada' | 'debil' | 'nula' {
  if (absR >= 0.8) return 'muy_fuerte';
  if (absR >= 0.6) return 'fuerte';
  if (absR >= 0.4) return 'moderada';
  if (absR >= 0.2) return 'debil';
  return 'nula';
}

export function correlationLabel(r: number | null): string {
  if (r === null) return 'Sin correlación calculable';
  const abs = Math.abs(r);
  const sign = r > 0 ? 'positiva' : r < 0 ? 'negativa (inversa)' : 'nula';
  const strength = classifyStrength(abs);

  switch (strength) {
    case 'muy_fuerte':
      return `Correlación ${sign} muy fuerte (r = ${r.toFixed(2)})`;
    case 'fuerte':
      return `Correlación ${sign} fuerte (r = ${r.toFixed(2)})`;
    case 'moderada':
      return `Correlación ${sign} moderada (r = ${r.toFixed(2)})`;
    case 'debil':
      return `Correlación ${sign} débil (r = ${r.toFixed(2)})`;
    case 'nula':
      return `Sin correlación apreciable (r = ${r.toFixed(2)})`;
  }
}

/**
 * Matriz de correlación para todas las medidas especificadas.
 */
export function computeCorrelationMatrix(
  rows: readonly AnalysisRow[],
  measures: readonly string[],
): CorrelationMatrix {
  const m = measures.length;
  const cells: CorrelationCell[][] = [];
  const uniquePairs: CorrelationPair[] = [];

  // Extract arrays for each measure
  const measureArrays: Record<string, (number | null)[]> = {};
  for (const measure of measures) {
    measureArrays[measure] = rows.map((row) => row.values[measure] ?? null);
  }

  for (let i = 0; i < m; i++) {
    const rowCells: CorrelationCell[] = [];
    const measureA = measures[i]!;
    const arrayA = measureArrays[measureA]!;

    for (let j = 0; j < m; j++) {
      const measureB = measures[j]!;
      const arrayB = measureArrays[measureB]!;

      if (i === j) {
        // Diagonal: measure with itself
        const validCount = arrayA.filter((v) => v !== null && Number.isFinite(v)).length;
        rowCells.push({
          xMeasure: measureA,
          yMeasure: measureB,
          r: validCount >= 2 ? 1 : null,
          count: validCount,
        });
      } else {
        const r = pearsonCorrelation(arrayA, arrayB);
        let count = 0;
        for (let k = 0; k < rows.length; k++) {
          const va = arrayA[k];
          const vb = arrayB[k];
          if (va !== null && vb !== null && Number.isFinite(va) && Number.isFinite(vb)) {
            count++;
          }
        }

        rowCells.push({
          xMeasure: measureA,
          yMeasure: measureB,
          r,
          count,
        });

        // Add to unique pairs list only once (upper triangle)
        if (i < j && r !== null) {
          uniquePairs.push({
            xMeasure: measureA,
            yMeasure: measureB,
            r,
            count,
            strength: classifyStrength(Math.abs(r)),
          });
        }
      }
    }
    cells.push(rowCells);
  }

  const sortedByRDesc = [...uniquePairs].sort((a, b) => b.r - a.r);
  const topPositive = sortedByRDesc.filter((p) => p.r > 0).slice(0, 5);
  const topNegative = [...uniquePairs]
    .filter((p) => p.r < 0)
    .sort((a, b) => a.r - b.r)
    .slice(0, 5);

  return {
    measures: [...measures],
    cells,
    pairs: uniquePairs.sort((a, b) => Math.abs(b.r) - Math.abs(a.r)),
    topPositive,
    topNegative,
  };
}

/**
 * Datos de dispersión y regresión detallados para un par de métricas.
 */
export function computePairDetails(
  rows: readonly AnalysisRow[],
  xMeasure: string,
  yMeasure: string,
  labelDim?: string | null,
): PairAnalysis {
  const points: ScatterPoint[] = [];
  const rawX: number[] = [];
  const rawY: number[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const xVal = row.values[xMeasure];
    const yVal = row.values[yMeasure];

    if (
      xVal !== null &&
      xVal !== undefined &&
      yVal !== null &&
      yVal !== undefined &&
      Number.isFinite(xVal) &&
      Number.isFinite(yVal)
    ) {
      rawX.push(xVal);
      rawY.push(yVal);
      const label = labelDim ? (row.dims[labelDim] ?? `Fila ${i + 1}`) : `Fila ${i + 1}`;
      points.push({ x: xVal, y: yVal, label });
    }
  }

  const r = pearsonCorrelation(rawX, rawY);
  const regression = linearRegression(rawX, rawY);

  return {
    xMeasure,
    yMeasure,
    r,
    regression,
    points,
    count: points.length,
  };
}
