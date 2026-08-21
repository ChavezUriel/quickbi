import { EMPTY_LABEL, type AnalysisRow } from '@/features/analysis/types';

export type RiskLevel = 'bajo' | 'moderado' | 'alto' | 'critico';

export interface CustomerShare {
  rank: number;
  customerId: string;
  revenue: number;
  share: number; // Porcentaje sobre el total (0 a 100)
  cumulativeRevenue: number;
  cumulativeShare: number; // Porcentaje acumulado (0 a 100)
  riskCategory: 'critico' | 'alto' | 'medio' | 'estandar';
}

export interface LorenzPoint {
  customerPercent: number; // 0 a 100
  revenuePercent: number; // 0 a 100
  equalityPercent: number; // = customerPercent (línea de 45°)
}

export interface ConcentrationAnalysisResult {
  totalRevenue: number;
  customerCount: number;
  gini: number; // Coeficiente de Gini (0 a 1)
  hhi: number; // Índice Herfindahl-Hirschman (0 a 10.000)
  top1Share: number; // % facturación del cliente nº 1
  top5Share: number; // % facturación de los 5 primeros clientes
  top10Share: number; // % facturación de los 10 primeros clientes
  top20PercentShare: number; // % facturación del 20% superior (Pareto)
  top1PercentShare: number;
  top5PercentShare: number;
  top10PercentShare: number;
  paretoRatio: {
    customerPercent: number;
    revenuePercent: number;
  };
  riskLevel: RiskLevel;
  riskDiagnosis: string;
  lorenzCurve: LorenzPoint[];
  topCustomers: CustomerShare[];
  allCustomers: CustomerShare[];
  ignoredRows: number;
}

export interface ComputeConcentrationOptions {
  customerDim: string;
  amountColumn: string;
  topLimit?: number;
}

/**
 * Analiza la concentración de clientes, curva de Lorenz, coeficiente de Gini,
 * índice HHI y evaluación de riesgo de dependencia.
 */
export function computeConcentration(
  rows: readonly AnalysisRow[],
  options: ComputeConcentrationOptions,
): ConcentrationAnalysisResult {
  const { customerDim, amountColumn, topLimit = 20 } = options;

  let ignoredRows = 0;
  const customerRevenueMap = new Map<string, number>();

  for (const row of rows) {
    const customer = row.dims[customerDim];
    const amount = row.values[amountColumn];

    if (
      customer === undefined ||
      customer === EMPTY_LABEL ||
      amount === null ||
      amount === undefined ||
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      ignoredRows++;
      continue;
    }

    const customerId = customer.trim();
    if (customerId === '') {
      ignoredRows++;
      continue;
    }

    customerRevenueMap.set(
      customerId,
      (customerRevenueMap.get(customerId) ?? 0) + amount,
    );
  }

  const customerCount = customerRevenueMap.size;
  const totalRevenue = Array.from(customerRevenueMap.values()).reduce((sum, v) => sum + v, 0);

  if (customerCount === 0 || totalRevenue <= 0) {
    return {
      totalRevenue: 0,
      customerCount: 0,
      gini: 0,
      hhi: 0,
      top1Share: 0,
      top5Share: 0,
      top10Share: 0,
      top20PercentShare: 0,
      top1PercentShare: 0,
      top5PercentShare: 0,
      top10PercentShare: 0,
      paretoRatio: { customerPercent: 20, revenuePercent: 0 },
      riskLevel: 'bajo',
      riskDiagnosis: 'No hay datos de clientes e importes para evaluar la concentración.',
      lorenzCurve: [
        { customerPercent: 0, revenuePercent: 0, equalityPercent: 0 },
        { customerPercent: 100, revenuePercent: 100, equalityPercent: 100 },
      ],
      topCustomers: [],
      allCustomers: [],
      ignoredRows,
    };
  }

  // Ordenar clientes descendente por facturación
  const sortedDesc = Array.from(customerRevenueMap.entries())
    .map(([customerId, revenue]) => ({ customerId, revenue }))
    .sort((a, b) => b.revenue - a.revenue);

  // Calcular cuotas individuales y acumuladas
  let runningCumRevenue = 0;
  const allCustomers: CustomerShare[] = sortedDesc.map((item, index) => {
    runningCumRevenue += item.revenue;
    const share = (item.revenue / totalRevenue) * 100;
    const cumulativeShare = (runningCumRevenue / totalRevenue) * 100;

    let riskCategory: CustomerShare['riskCategory'] = 'estandar';
    if (share >= 15) {
      riskCategory = 'critico';
    } else if (share >= 7) {
      riskCategory = 'alto';
    } else if (share >= 3) {
      riskCategory = 'medio';
    }

    return {
      rank: index + 1,
      customerId: item.customerId,
      revenue: item.revenue,
      share,
      cumulativeRevenue: runningCumRevenue,
      cumulativeShare,
      riskCategory,
    };
  });

  // Top shares absolutos
  const top1Share = allCustomers[0]?.share ?? 0;
  const top5Share = allCustomers.slice(0, 5).reduce((sum, c) => sum + c.share, 0);
  const top10Share = allCustomers.slice(0, 10).reduce((sum, c) => sum + c.share, 0);

  // Top shares percentiles (Pareto)
  const count1Pct = Math.max(1, Math.ceil(customerCount * 0.01));
  const count5Pct = Math.max(1, Math.ceil(customerCount * 0.05));
  const count10Pct = Math.max(1, Math.ceil(customerCount * 0.10));
  const count20Pct = Math.max(1, Math.ceil(customerCount * 0.20));

  const top1PercentShare = allCustomers.slice(0, count1Pct).reduce((sum, c) => sum + c.share, 0);
  const top5PercentShare = allCustomers.slice(0, count5Pct).reduce((sum, c) => sum + c.share, 0);
  const top10PercentShare = allCustomers.slice(0, count10Pct).reduce((sum, c) => sum + c.share, 0);
  const top20PercentShare = allCustomers.slice(0, count20Pct).reduce((sum, c) => sum + c.share, 0);

  // HHI (Herfindahl-Hirschman Index: sum of squared market shares, 0 to 10,000)
  const hhi = allCustomers.reduce((sum, c) => sum + Math.pow(c.share, 2), 0);

  // Coeficiente de Gini
  // Ordenar ingresos ascendente: y_1 <= y_2 <= ... <= y_N
  const sortedAsc = sortedDesc.map((c) => c.revenue).reverse();
  let gini = 0;
  if (customerCount > 1) {
    let weightedSum = 0;
    for (let i = 0; i < customerCount; i++) {
      weightedSum += (i + 1) * sortedAsc[i]!;
    }
    gini = (2 * weightedSum) / (customerCount * totalRevenue) - (customerCount + 1) / customerCount;
    gini = Math.max(0, Math.min(1, gini));
  }

  // Generar curva de Lorenz (de 0% a 100% de clientes ordenados ascendentemente)
  const lorenzCurve: LorenzPoint[] = [{ customerPercent: 0, revenuePercent: 0, equalityPercent: 0 }];
  let lorenzCumRev = 0;

  // Si hay muchos clientes, muestrear ~100 puntos representativos
  const step = Math.max(1, Math.floor(customerCount / 100));
  for (let i = 0; i < customerCount; i++) {
    lorenzCumRev += sortedAsc[i]!;
    if ((i + 1) % step === 0 || i === customerCount - 1) {
      const custPct = ((i + 1) / customerCount) * 100;
      const revPct = (lorenzCumRev / totalRevenue) * 100;
      lorenzCurve.push({
        customerPercent: Number(custPct.toFixed(2)),
        revenuePercent: Number(revPct.toFixed(2)),
        equalityPercent: Number(custPct.toFixed(2)),
      });
    }
  }

  // Evaluación de riesgo de concentración
  let riskLevel: RiskLevel = 'bajo';
  let riskDiagnosis = '';

  if (top1Share >= 25 || top5Share >= 60 || hhi >= 2500 || gini >= 0.85) {
    riskLevel = 'critico';
    riskDiagnosis = `Riesgo crítico de concentración: tu mayor cliente representa el ${top1Share.toFixed(1)} % de las ventas y el top 5 concentra el ${top5Share.toFixed(1)} %. La pérdida de una sola cuenta clave pondría en riesgo la viabilidad operativa.`;
  } else if (top1Share >= 15 || top5Share >= 40 || hhi >= 1500 || gini >= 0.70) {
    riskLevel = 'alto';
    riskDiagnosis = `Alta dependencia de clientes clave: los 5 principales clientes concentran el ${top5Share.toFixed(1)} % de la facturación. Se recomienda diversificar la captación y diseñar planes de retención específicos.`;
  } else if (top20PercentShare >= 70 || hhi >= 1000 || gini >= 0.55) {
    riskLevel = 'moderado';
    riskDiagnosis = `Concentración moderada (Principio de Pareto típico): el 20 % superior genera el ${top20PercentShare.toFixed(1)} % de los ingresos. Existe dependencia comercial moderada sin riesgo existencial inmediato.`;
  } else {
    riskLevel = 'bajo';
    riskDiagnosis = `Cartera bien diversificada: ningún cliente individual supera el ${top1Share.toFixed(1)} % y el índice HHI (${hhi.toFixed(0)}) refleja una distribución equilibrada y bajo riesgo de concentración.`;
  }

  return {
    totalRevenue,
    customerCount,
    gini,
    hhi,
    top1Share,
    top5Share,
    top10Share,
    top20PercentShare,
    top1PercentShare,
    top5PercentShare,
    top10PercentShare,
    paretoRatio: {
      customerPercent: 20,
      revenuePercent: top20PercentShare,
    },
    riskLevel,
    riskDiagnosis,
    lorenzCurve,
    topCustomers: allCustomers.slice(0, topLimit),
    allCustomers,
    ignoredRows,
  };
}
