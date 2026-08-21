export interface SpcOptions {
  measureCol: string;
  orderCol?: string | null;
  sigmaMethod?: 'moving-range' | 'sample-stddev';
  targetMean?: number | null;
  targetSigma?: number | null;
}

export type SpcZone = 'out_upper' | 'zone_a_plus' | 'zone_b_plus' | 'zone_c_plus' | 'zone_c_minus' | 'zone_b_minus' | 'zone_a_minus' | 'out_lower';

export interface SpcRuleViolation {
  ruleNumber: number;
  ruleName: string;
  severity: 'critico' | 'alerta' | 'aviso';
  description: string;
}

export interface SpcPoint {
  index: number;
  label: string;
  value: number;
  movingRange: number | null;
  zScore: number;
  zone: SpcZone;
  violations: SpcRuleViolation[];
  isInControl: boolean;
}

export interface SpcSummary {
  totalPoints: number;
  validPoints: number;
  ignoredRows: number;
  mean: number; // Center Line (CL)
  sigma: number; // σ
  ucl: number; // Upper Control Limit (CL + 3σ)
  lcl: number; // Lower Control Limit (CL - 3σ)
  sigma2Plus: number; // CL + 2σ
  sigma1Plus: number; // CL + 1σ
  sigma1Minus: number; // CL - 1σ
  sigma2Minus: number; // CL - 2σ
  pointsInControlCount: number;
  pointsInControlPercent: number;
  violationsCount: number;
  isProcessInControl: boolean;
  points: SpcPoint[];
  violationLog: {
    pointIndex: number;
    pointLabel: string;
    value: number;
    rule: SpcRuleViolation;
  }[];
  insights: string[];
}

export function computeSpc(
  rows: readonly Record<string, unknown>[],
  options: SpcOptions,
): SpcSummary {
  const {
    measureCol,
    orderCol,
    sigmaMethod = 'moving-range',
    targetMean = null,
    targetSigma = null,
  } = options;

  let totalPoints = 0;
  let ignoredRows = 0;
  const rawData: { label: string; value: number }[] = [];

  for (let i = 0; i < rows.length; i++) {
    totalPoints++;
    const row = rows[i]!;
    const rawVal = row[measureCol];
    const val = typeof rawVal === 'number' && Number.isFinite(rawVal) ? rawVal : null;

    if (val === null) {
      ignoredRows++;
      continue;
    }

    let label = `Muestra #${rawData.length + 1}`;
    if (orderCol) {
      const rawOrder = row[orderCol];
      if (rawOrder !== null && rawOrder !== undefined && String(rawOrder).trim() !== '') {
        label = String(rawOrder).trim();
      }
    }

    rawData.push({ label, value: val });
  }

  if (rawData.length === 0) {
    return createEmptySpc(totalPoints, ignoredRows);
  }

  const values = rawData.map((d) => d.value);
  const n = values.length;

  // 1. Calcular Media (Center Line)
  const sum = values.reduce((a, b) => a + b, 0);
  const mean = targetMean !== null && Number.isFinite(targetMean) ? targetMean : sum / n;

  // 2. Calcular Sigma (σ)
  let sigma = 0;
  const movingRanges: (number | null)[] = [null];

  for (let i = 1; i < n; i++) {
    const mr = Math.abs(values[i]! - values[i - 1]!);
    movingRanges.push(mr);
  }

  if (targetSigma !== null && Number.isFinite(targetSigma) && targetSigma > 0) {
    sigma = targetSigma;
  } else if (sigmaMethod === 'moving-range' && n >= 2) {
    // Estimación por Rango Móvil: sigma = MR_bar / d2 (d2 = 1.128 para n=2)
    const validMR = movingRanges.filter((x): x is number => x !== null);
    const avgMR = validMR.reduce((a, b) => a + b, 0) / validMR.length;
    sigma = avgMR / 1.128;
  } else {
    // Estimación por Desviación Estándar Muestral
    const variance =
      values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / (n > 1 ? n - 1 : 1);
    sigma = Math.sqrt(variance);
  }

  // Si sigma es 0 (datos constantes), asignar un valor base para evitar división por 0
  if (sigma === 0) {
    sigma = 0.0001;
  }

  // 3. Límites de Control y Zonas
  const ucl = mean + 3 * sigma;
  const lcl = mean - 3 * sigma;
  const sigma2Plus = mean + 2 * sigma;
  const sigma1Plus = mean + 1 * sigma;
  const sigma1Minus = mean - 1 * sigma;
  const sigma2Minus = mean - 2 * sigma;

  // 4. Clasificación de Zonas por Punto
  const points: SpcPoint[] = [];

  for (let i = 0; i < n; i++) {
    const v = values[i]!;
    const z = (v - mean) / sigma;
    let zone: SpcZone = 'zone_c_plus';

    if (v > ucl) zone = 'out_upper';
    else if (v >= sigma2Plus) zone = 'zone_a_plus';
    else if (v >= sigma1Plus) zone = 'zone_b_plus';
    else if (v >= mean) zone = 'zone_c_plus';
    else if (v >= sigma1Minus) zone = 'zone_c_minus';
    else if (v >= sigma2Minus) zone = 'zone_b_minus';
    else if (v >= lcl) zone = 'zone_a_minus';
    else zone = 'out_lower';

    points.push({
      index: i + 1,
      label: rawData[i]!.label,
      value: v,
      movingRange: movingRanges[i] ?? null,
      zScore: Number(z.toFixed(2)),
      zone,
      violations: [],
      isInControl: true,
    });
  }

  // 5. Evaluación de Reglas de Control (Nelson & Western Electric)
  evaluateSpcRules(points, mean);

  // 6. Resumen de Violaciones y Estado del Proceso
  const violationLog: SpcSummary['violationLog'] = [];
  let violationsCount = 0;
  let pointsInControlCount = 0;

  for (const p of points) {
    if (p.violations.length > 0) {
      p.isInControl = false;
      for (const rule of p.violations) {
        violationsCount++;
        violationLog.push({
          pointIndex: p.index,
          pointLabel: p.label,
          value: p.value,
          rule,
        });
      }
    } else {
      pointsInControlCount++;
    }
  }

  const isProcessInControl = violationsCount === 0;
  const pointsInControlPercent = n > 0 ? (pointsInControlCount / n) * 100 : 100;

  // Insights en español
  const insights: string[] = [];
  if (isProcessInControl) {
    insights.push('El proceso se encuentra en estado de CONTROL ESTADÍSTICO bajo variación por causa común.');
    insights.push('No se detectaron causas especiales ni desviaciones fuera de los límites de 3σ.');
  } else {
    insights.push(`Se detectaron ${violationsCount} violaciones a las reglas de control estadístico (Causas Especiales).`);
    const rule1Count = violationLog.filter((v) => v.rule.ruleNumber === 1).length;
    if (rule1Count > 0) {
      insights.push(`${rule1Count} punto(s) sobrepasan los límites críticos ±3σ (UCL / LCL). Requiere intervención inmediata.`);
    }
    const shiftCount = violationLog.filter((v) => v.rule.ruleNumber === 4).length;
    if (shiftCount > 0) {
      insights.push('Se detectó desplazamiento o sesgo de la media (racha de puntos continuos del mismo lado del centro).');
    }
  }

  return {
    totalPoints,
    validPoints: n,
    ignoredRows,
    mean: Number(mean.toFixed(4)),
    sigma: Number(sigma.toFixed(4)),
    ucl: Number(ucl.toFixed(4)),
    lcl: Number(lcl.toFixed(4)),
    sigma2Plus: Number(sigma2Plus.toFixed(4)),
    sigma1Plus: Number(sigma1Plus.toFixed(4)),
    sigma1Minus: Number(sigma1Minus.toFixed(4)),
    sigma2Minus: Number(sigma2Minus.toFixed(4)),
    pointsInControlCount,
    pointsInControlPercent: Number(pointsInControlPercent.toFixed(1)),
    violationsCount,
    isProcessInControl,
    points,
    violationLog,
    insights,
  };
}

/**
 * Evaluación de Reglas de Western Electric / Nelson Rules
 */
function evaluateSpcRules(points: SpcPoint[], mean: number) {
  const n = points.length;

  for (let i = 0; i < n; i++) {
    const p = points[i]!;

    // Regla 1: 1 punto fuera de ±3σ (Fuera de UCL o LCL)
    if (p.zone === 'out_upper' || p.zone === 'out_lower') {
      p.violations.push({
        ruleNumber: 1,
        ruleName: 'Punto fuera de ±3σ',
        severity: 'critico',
        description: p.zone === 'out_upper' ? 'Valor superior al UCL (+3σ)' : 'Valor inferior al LCL (-3σ)',
      });
    }

    // Regla 2: 2 de 3 puntos consecutivos en Zona A o más allá (mismo lado)
    if (i >= 2) {
      const slice = points.slice(i - 2, i + 1);
      const upperA = slice.filter((pt) => pt.zone === 'zone_a_plus' || pt.zone === 'out_upper').length;
      const lowerA = slice.filter((pt) => pt.zone === 'zone_a_minus' || pt.zone === 'out_lower').length;

      if (upperA >= 2) {
        p.violations.push({
          ruleNumber: 2,
          ruleName: 'Sesgo Zona A (2 de 3 en +2σ)',
          severity: 'alerta',
          description: '2 de 3 puntos consecutivos en Zona A superior (+2σ a +3σ)',
        });
      } else if (lowerA >= 2) {
        p.violations.push({
          ruleNumber: 2,
          ruleName: 'Sesgo Zona A (2 de 3 en -2σ)',
          severity: 'alerta',
          description: '2 de 3 puntos consecutivos en Zona A inferior (-2σ a -3σ)',
        });
      }
    }

    // Regla 3: 4 de 5 puntos consecutivos en Zona B o más allá (mismo lado)
    if (i >= 4) {
      const slice = points.slice(i - 4, i + 1);
      const upperB = slice.filter((pt) => pt.zone === 'zone_b_plus' || pt.zone === 'zone_a_plus' || pt.zone === 'out_upper').length;
      const lowerB = slice.filter((pt) => pt.zone === 'zone_b_minus' || pt.zone === 'zone_a_minus' || pt.zone === 'out_lower').length;

      if (upperB >= 4) {
        p.violations.push({
          ruleNumber: 3,
          ruleName: 'Sesgo Zona B (4 de 5 en +1σ)',
          severity: 'alerta',
          description: '4 de 5 puntos consecutivos en Zona B superior (+1σ o más)',
        });
      } else if (lowerB >= 4) {
        p.violations.push({
          ruleNumber: 3,
          ruleName: 'Sesgo Zona B (4 de 5 en -1σ)',
          severity: 'alerta',
          description: '4 de 5 puntos consecutivos en Zona B inferior (-1σ o más)',
        });
      }
    }

    // Regla 4: Racha de 8 puntos consecutivos del mismo lado de la media
    if (i >= 7) {
      const slice = points.slice(i - 7, i + 1);
      const allAbove = slice.every((pt) => pt.value >= mean);
      const allBelow = slice.every((pt) => pt.value <= mean);

      if (allAbove || allBelow) {
        p.violations.push({
          ruleNumber: 4,
          ruleName: 'Racha sostenida (8 del mismo lado)',
          severity: 'alerta',
          description: allAbove ? '8 puntos consecutivos por encima de la media' : '8 puntos consecutivos por debajo de la media',
        });
      }
    }

    // Regla 5: Tendencia monótona de 6 puntos consecutivos crecientes o decrecientes
    if (i >= 5) {
      const slice = points.slice(i - 5, i + 1);
      let isIncreasing = true;
      let isDecreasing = true;
      for (let k = 1; k < slice.length; k++) {
        if (slice[k]!.value <= slice[k - 1]!.value) isIncreasing = false;
        if (slice[k]!.value >= slice[k - 1]!.value) isDecreasing = false;
      }

      if (isIncreasing || isDecreasing) {
        p.violations.push({
          ruleNumber: 5,
          ruleName: 'Tendencia continua (6 puntos seguidos)',
          severity: 'alerta',
          description: isIncreasing ? '6 puntos consecutivos en aumento continuo' : '6 puntos consecutivos en descenso continuo',
        });
      }
    }

    // Regla 6: 14 puntos consecutivos alternando arriba y abajo (oscilación)
    if (i >= 13) {
      const slice = points.slice(i - 13, i + 1);
      let isAlternating = true;
      for (let k = 2; k < slice.length; k++) {
        const diff1 = slice[k - 1]!.value - slice[k - 2]!.value;
        const diff2 = slice[k]!.value - slice[k - 1]!.value;
        if (diff1 * diff2 >= 0) {
          isAlternating = false;
          break;
        }
      }

      if (isAlternating) {
        p.violations.push({
          ruleNumber: 6,
          ruleName: 'Oscilación excesiva (14 alternantes)',
          severity: 'aviso',
          description: '14 puntos alternando consecutivamente hacia arriba y hacia abajo',
        });
      }
    }

    // Regla 7: 15 puntos consecutivos en Zona C (dentro de ±1σ) -> Estratificación
    if (i >= 14) {
      const slice = points.slice(i - 14, i + 1);
      const allInC = slice.every((pt) => pt.zone === 'zone_c_plus' || pt.zone === 'zone_c_minus');
      if (allInC) {
        p.violations.push({
          ruleNumber: 7,
          ruleName: 'Estratificación (15 puntos en ±1σ)',
          severity: 'aviso',
          description: '15 puntos consecutivos confinados en Zona C (variación anormalmente baja)',
        });
      }
    }

    // Regla 8: 8 puntos consecutivos sin caer en Zona C (ambos lados)
    if (i >= 7) {
      const slice = points.slice(i - 7, i + 1);
      const noneInC = slice.every((pt) => pt.zone !== 'zone_c_plus' && pt.zone !== 'zone_c_minus');
      if (noneInC) {
        p.violations.push({
          ruleNumber: 8,
          ruleName: 'Mezcla / Bimodalidad (8 fuera de ±1σ)',
          severity: 'aviso',
          description: '8 puntos consecutivos evitando la Zona C central',
        });
      }
    }
  }
}

function createEmptySpc(totalPoints: number, ignoredRows: number): SpcSummary {
  return {
    totalPoints,
    validPoints: 0,
    ignoredRows,
    mean: 0,
    sigma: 0,
    ucl: 0,
    lcl: 0,
    sigma2Plus: 0,
    sigma1Plus: 0,
    sigma1Minus: 0,
    sigma2Minus: 0,
    pointsInControlCount: 0,
    pointsInControlPercent: 100,
    violationsCount: 0,
    isProcessInControl: true,
    points: [],
    violationLog: [],
    insights: ['No hay datos numéricos válidos para generar la gráfica de control SPC.'],
  };
}
