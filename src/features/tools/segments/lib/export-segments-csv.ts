import type { SegmentComparisonResult } from './segments';

const NUMBER = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 4 });
const BOM = '\u{FEFF}';

function escapeField(field: string): string {
  return /[;"\r\n]/.test(field) ? `"${field.replaceAll('"', '""')}"` : field;
}

/**
 * Exporta el análisis comparativo de segmentos y el desglose mix-shift a CSV.
 */
export function segmentsToCsv(result: SegmentComparisonResult): string {
  const lines: string[] = [];

  lines.push(`Comparador de segmentos;Dimensión: ${escapeField(result.segmentDim)}`);
  lines.push(`${escapeField(result.segmentAName)};Valores: ${escapeField(result.segmentAValues.join(', '))};Filas: ${result.countA}`);
  lines.push(`${escapeField(result.segmentBName)};Valores: ${escapeField(result.segmentBValues.join(', '))};Filas: ${result.countB}`);
  lines.push('');

  // 1. Resumen de métricas
  lines.push('--- Comparativa de métricas ---');
  const metricHeader = [
    'Métrica',
    `Suma ${result.segmentAName}`,
    `Suma ${result.segmentBName}`,
    'Delta Suma (Abs)',
    'Delta Suma (%)',
    `Media ${result.segmentAName}`,
    `Media ${result.segmentBName}`,
    'Delta Media (Abs)',
    'Delta Media (%)',
  ];
  lines.push(metricHeader.map(escapeField).join(';'));

  for (const m of result.metrics) {
    lines.push(
      [
        escapeField(m.label),
        NUMBER.format(m.sumA),
        NUMBER.format(m.sumB),
        NUMBER.format(m.deltaSumAbs),
        m.deltaSumPct !== null ? `${NUMBER.format(m.deltaSumPct)} %` : 'n/d',
        NUMBER.format(m.meanA),
        NUMBER.format(m.meanB),
        NUMBER.format(m.deltaMeanAbs),
        m.deltaMeanPct !== null ? `${NUMBER.format(m.deltaMeanPct)} %` : 'n/d',
      ].join(';'),
    );
  }

  // 2. Desglose Mix Shift
  if (result.mixShift) {
    lines.push('');
    lines.push(`--- Descomposición Mix-Shift (Dimensión: ${escapeField(result.mixShift.breakdownDim)}, Métrica: ${escapeField(result.mixShift.measure)}) ---`);
    lines.push(`Media global ${result.segmentAName};${NUMBER.format(result.mixShift.meanA)}`);
    lines.push(`Media global ${result.segmentBName};${NUMBER.format(result.mixShift.meanB)}`);
    lines.push(`Diferencia total de media;${NUMBER.format(result.mixShift.totalMeanDelta)}`);
    lines.push(`Efecto Mix (composición de cartera);${NUMBER.format(result.mixShift.totalMixEffect)}`);
    lines.push(`Efecto Tasa / Rendimiento interno;${NUMBER.format(result.mixShift.totalRateEffect)}`);
    lines.push('');

    const mixHeader = [
      'Categoría de desglose',
      `Filas ${result.segmentAName}`,
      `Filas ${result.segmentBName}`,
      `Mix % ${result.segmentAName}`,
      `Mix % ${result.segmentBName}`,
      'Variación Mix (%)',
      `Media ${result.segmentAName}`,
      `Media ${result.segmentBName}`,
      'Efecto Mix',
      'Efecto Tasa',
      'Efecto Total',
    ];
    lines.push(mixHeader.map(escapeField).join(';'));

    for (const r of result.mixShift.rows) {
      lines.push(
        [
          escapeField(r.category),
          r.countA,
          r.countB,
          `${NUMBER.format(r.shareA * 100)} %`,
          `${NUMBER.format(r.shareB * 100)} %`,
          `${NUMBER.format(r.deltaShare * 100)} %`,
          NUMBER.format(r.meanA),
          NUMBER.format(r.meanB),
          NUMBER.format(r.mixEffect),
          NUMBER.format(r.rateEffect),
          NUMBER.format(r.totalEffect),
        ].join(';'),
      );
    }
  }

  return BOM + lines.join('\r\n');
}
