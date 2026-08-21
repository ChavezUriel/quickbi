import { EMPTY_LABEL, type AnalysisRow } from '@/features/analysis/types';

export type ElasticityType = 'elastica' | 'inelastica' | 'unitaria' | 'positiva' | 'indeterminada';

export interface PriceVolumePoint {
  name: string;
  price: number;
  volume: number;
  revenue: number;
}

export interface ProductPvmDetail {
  product: string;
  volume0: number;
  volume1: number;
  price0: number;
  price1: number;
  revenue0: number;
  revenue1: number;
  deltaRevenue: number;
  priceEffect: number;
  volumeEffect: number;
  mixEffect: number;
}

export interface PvmSummary {
  period0Label: string;
  period1Label: string;
  revenue0: number;
  revenue1: number;
  deltaRevenue: number;
  priceEffect: number;
  volumeEffect: number;
  mixEffect: number;
  products: ProductPvmDetail[];
}

export interface PriceVolumeResult {
  points: PriceVolumePoint[];
  totalRevenue: number;
  totalVolume: number;
  avgRealizedPrice: number;
  elasticity: number | null;
  elasticityType: ElasticityType;
  elasticityLabel: string;
  elasticityDiagnosis: string;
  rSquared: number | null;
  trendLine: {
    slope: number;
    intercept: number;
    minPrice: number;
    maxPrice: number;
    startPoint: [number, number];
    endPoint: [number, number];
  } | null;
  pvm: PvmSummary | null;
  hasTimeComparison: boolean;
  ignoredRows: number;
}

export interface ComputePriceVolumeOptions {
  productDim: string;
  volumeColumn: string;
  amountColumn: string;
  dateColumn?: string | null;
  priceInputType?: 'importe_total' | 'precio_unitario';
}

/**
 * Motor de cálculo para Precio vs Volumen:
 * Dispersión producto-precio-volumen, cálculo de Elasticidad Precio de la Demanda
 * y descomposición de variaciones de ingresos Precio-Volumen-Mix (PVM).
 */
export function computePriceVolume(
  rows: readonly AnalysisRow[],
  options: ComputePriceVolumeOptions,
): PriceVolumeResult {
  const {
    productDim,
    volumeColumn,
    amountColumn,
    dateColumn = null,
    priceInputType = 'importe_total',
  } = options;

  let ignoredRows = 0;

  interface ExtractedRow {
    product: string;
    volume: number;
    price: number;
    revenue: number;
    date: string | null;
  }

  const validRows: ExtractedRow[] = [];

  for (const row of rows) {
    const prodRaw = row.dims[productDim];
    const volRaw = row.values[volumeColumn];
    const amtRaw = row.values[amountColumn];
    const dateRaw = dateColumn != null ? (row.day ?? row.dims[dateColumn]) : null;

    if (
      prodRaw === undefined ||
      prodRaw === EMPTY_LABEL ||
      volRaw === null ||
      volRaw === undefined ||
      !Number.isFinite(volRaw) ||
      volRaw <= 0 ||
      amtRaw === null ||
      amtRaw === undefined ||
      !Number.isFinite(amtRaw) ||
      amtRaw <= 0
    ) {
      ignoredRows++;
      continue;
    }

    const product = prodRaw.trim();
    if (product === '') {
      ignoredRows++;
      continue;
    }

    let revenue = 0;
    let price = 0;

    if (priceInputType === 'precio_unitario') {
      price = amtRaw;
      revenue = price * volRaw;
    } else {
      revenue = amtRaw;
      price = volRaw > 0 ? revenue / volRaw : 0;
    }

    validRows.push({
      product,
      volume: volRaw,
      price,
      revenue,
      date: dateRaw != null && dateRaw !== EMPTY_LABEL ? dateRaw.trim() : null,
    });
  }

  if (validRows.length === 0) {
    return {
      points: [],
      totalRevenue: 0,
      totalVolume: 0,
      avgRealizedPrice: 0,
      elasticity: null,
      elasticityType: 'indeterminada',
      elasticityLabel: 'Sin datos',
      elasticityDiagnosis: 'No se encontraron filas con precio y volumen positivos.',
      rSquared: null,
      trendLine: null,
      pvm: null,
      hasTimeComparison: false,
      ignoredRows,
    };
  }

  // Agrupar por producto
  const productMap = new Map<string, { volume: number; revenue: number }>();
  for (const r of validRows) {
    const existing = productMap.get(r.product);
    if (existing === undefined) {
      productMap.set(r.product, { volume: r.volume, revenue: r.revenue });
    } else {
      existing.volume += r.volume;
      existing.revenue += r.revenue;
    }
  }

  const points: PriceVolumePoint[] = Array.from(productMap.entries()).map(([name, data]) => ({
    name,
    volume: data.volume,
    revenue: data.revenue,
    price: data.volume > 0 ? data.revenue / data.volume : 0,
  }));

  // Ordenar por volumen descendente
  points.sort((a, b) => b.volume - a.volume);

  const totalRevenue = points.reduce((sum, p) => sum + p.revenue, 0);
  const totalVolume = points.reduce((sum, p) => sum + p.volume, 0);
  const avgRealizedPrice = totalVolume > 0 ? totalRevenue / totalVolume : 0;

  // Ajuste de regresión y Elasticidad Precio de la Demanda (PED)
  let elasticity: number | null = null;
  let rSquared: number | null = null;
  let trendLine: PriceVolumeResult['trendLine'] = null;

  const dataPoints = points.filter((p) => p.price > 0 && p.volume > 0);

  if (dataPoints.length >= 2) {
    const n = dataPoints.length;
    const meanP = dataPoints.reduce((s, p) => s + p.price, 0) / n;
    const meanQ = dataPoints.reduce((s, p) => s + p.volume, 0) / n;

    let ssPP = 0;
    let ssQQ = 0;
    let ssPQ = 0;

    for (const p of dataPoints) {
      const diffP = p.price - meanP;
      const diffQ = p.volume - meanQ;
      ssPP += diffP * diffP;
      ssQQ += diffQ * diffQ;
      ssPQ += diffP * diffQ;
    }

    if (ssPP > 0 && ssQQ > 0) {
      const slope = ssPQ / ssPP; // b en Q = a + b*P
      const intercept = meanQ - slope * meanP;
      const r = ssPQ / Math.sqrt(ssPP * ssQQ);
      rSquared = Math.max(0, Math.min(1, r * r));

      // Elasticidad en la media: e = slope * (meanP / meanQ)
      if (meanQ > 0) {
        elasticity = slope * (meanP / meanQ);
      }

      const minPrice = Math.min(...dataPoints.map((d) => d.price));
      const maxPrice = Math.max(...dataPoints.map((d) => d.price));
      const startQ = Math.max(0, intercept + slope * minPrice);
      const endQ = Math.max(0, intercept + slope * maxPrice);

      trendLine = {
        slope,
        intercept,
        minPrice,
        maxPrice,
        startPoint: [minPrice, startQ],
        endPoint: [maxPrice, endQ],
      };
    }
  }

  // Interpretación de Elasticidad
  let elasticityType: ElasticityType = 'indeterminada';
  let elasticityLabel = 'Indeterminada';
  let elasticityDiagnosis = 'Se requieren más puntos con distintos precios para estimar la elasticidad.';

  if (elasticity !== null) {
    if (elasticity < -1.2) {
      elasticityType = 'elastica';
      elasticityLabel = 'Demanda Elástica';
      elasticityDiagnosis = `Demanda altamente sensible al precio (ε = ${elasticity.toFixed(2)}): las subidas de precio provocan una reducción más que proporcional en el volumen vendido. Las promociones o rebajas pueden maximizar los ingresos totales.`;
    } else if (elasticity <= -0.8) {
      elasticityType = 'unitaria';
      elasticityLabel = 'Elasticidad Unitaria';
      elasticityDiagnosis = `Elasticidad unitaria (ε = ${elasticity.toFixed(2)}): los cambios de precio son compensados de forma proporcional por el volumen, manteniendo la facturación relativamente estable.`;
    } else if (elasticity < 0) {
      elasticityType = 'inelastica';
      elasticityLabel = 'Demanda Inelástica';
      elasticityDiagnosis = `Demanda inelástica (ε = ${elasticity.toFixed(2)}): los clientes presentan baja sensibilidad al precio. Un incremento moderado de precios aumentará la facturación total sin sufrir caídas graves de volumen.`;
    } else {
      elasticityType = 'positiva';
      elasticityLabel = 'Correlación Positiva';
      elasticityDiagnosis = `Correlación positiva (ε = +${elasticity.toFixed(2)}): a mayor precio se observa mayor volumen (posible posicionamiento premium, fuerte estacionalidad o mezcla de productos no homogénea).`;
    }
  }

  // Descomposición PVM (Price-Volume-Mix)
  let pvm: PvmSummary | null = null;
  const datesWithValues = validRows.filter((r) => r.date != null).map((r) => r.date!);

  if (datesWithValues.length >= 2) {
    const sortedDates = [...datesWithValues].sort();
    const midpoint = sortedDates[Math.floor(sortedDates.length / 2)]!;
    const period0Rows = validRows.filter((r) => r.date! < midpoint);
    const period1Rows = validRows.filter((r) => r.date! >= midpoint);

    if (period0Rows.length > 0 && period1Rows.length > 0) {
      pvm = computePvmSplit(period0Rows, period1Rows, 'Período Inicial', 'Período Reciente');
    }
  }

  return {
    points,
    totalRevenue,
    totalVolume,
    avgRealizedPrice,
    elasticity,
    elasticityType,
    elasticityLabel,
    elasticityDiagnosis,
    rSquared,
    trendLine,
    pvm,
    hasTimeComparison: pvm !== null,
    ignoredRows,
  };
}

/**
 * Descompone la variación de ingresos entre dos períodos en Efecto Precio,
 * Efecto Volumen y Efecto Mix.
 */
function computePvmSplit(
  rows0: { product: string; volume: number; revenue: number }[],
  rows1: { product: string; volume: number; revenue: number }[],
  period0Label: string,
  period1Label: string,
): PvmSummary {
  const map0 = new Map<string, { volume: number; revenue: number }>();
  for (const r of rows0) {
    const existing = map0.get(r.product);
    if (!existing) map0.set(r.product, { volume: r.volume, revenue: r.revenue });
    else {
      existing.volume += r.volume;
      existing.revenue += r.revenue;
    }
  }

  const map1 = new Map<string, { volume: number; revenue: number }>();
  for (const r of rows1) {
    const existing = map1.get(r.product);
    if (!existing) map1.set(r.product, { volume: r.volume, revenue: r.revenue });
    else {
      existing.volume += r.volume;
      existing.revenue += r.revenue;
    }
  }

  const allProducts = Array.from(new Set([...map0.keys(), ...map1.keys()]));

  const totVol0 = Array.from(map0.values()).reduce((s, v) => s + v.volume, 0);
  const totRev0 = Array.from(map0.values()).reduce((s, v) => s + v.revenue, 0);
  const avgP0 = totVol0 > 0 ? totRev0 / totVol0 : 0;

  const totVol1 = Array.from(map1.values()).reduce((s, v) => s + v.volume, 0);
  const totRev1 = Array.from(map1.values()).reduce((s, v) => s + v.revenue, 0);

  const deltaTotalRevenue = totRev1 - totRev0;

  // Descomposición estándar PVM a nivel de cartera:
  const totalVolumeEffect = (totVol1 - totVol0) * avgP0;

  let totalRawPriceEffect = 0;
  let totalRawMixEffect = 0;

  const productDetails: ProductPvmDetail[] = [];

  for (const product of allProducts) {
    const d0 = map0.get(product) ?? { volume: 0, revenue: 0 };
    const d1 = map1.get(product) ?? { volume: 0, revenue: 0 };

    const p0 = d0.volume > 0 ? d0.revenue / d0.volume : avgP0;
    const p1 = d1.volume > 0 ? d1.revenue / d1.volume : p0;

    const deltaRev = d1.revenue - d0.revenue;

    const priceEff = d1.volume * (p1 - p0);
    const volEff = (d1.volume - d0.volume) * avgP0;

    const share0 = totVol0 > 0 ? d0.volume / totVol0 : 0;
    const share1 = totVol1 > 0 ? d1.volume / totVol1 : 0;
    const mixEff = (share1 - share0) * totVol1 * (p0 - avgP0);

    totalRawPriceEffect += priceEff;
    totalRawMixEffect += mixEff;

    productDetails.push({
      product,
      volume0: d0.volume,
      volume1: d1.volume,
      price0: p0,
      price1: p1,
      revenue0: d0.revenue,
      revenue1: d1.revenue,
      deltaRevenue: deltaRev,
      priceEffect: priceEff,
      volumeEffect: volEff,
      mixEffect: mixEff,
    });
  }

  const computedSum = totalRawPriceEffect + totalVolumeEffect + totalRawMixEffect;
  const discrepancy = deltaTotalRevenue - computedSum;
  const finalMixEffect = totalRawMixEffect + discrepancy;

  productDetails.sort((a, b) => b.revenue1 - a.revenue1);

  return {
    period0Label,
    period1Label,
    revenue0: totRev0,
    revenue1: totRev1,
    deltaRevenue: deltaTotalRevenue,
    priceEffect: totalRawPriceEffect,
    volumeEffect: totalVolumeEffect,
    mixEffect: finalMixEffect,
    products: productDetails,
  };
}
