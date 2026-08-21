import type { DistributionResult, FiveNumberSummary } from './distributions';

const NUMBER = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 4 });
const BOM = '\u{FEFF}';

function escapeField(field: string): string {
  return /[;"\r\n]/.test(field) ? `"${field.replaceAll('"', '""')}"` : field;
}

function summaryRow(label: string, s: FiveNumberSummary): string {
  return [
    escapeField(label),
    s.count,
    NUMBER.format(s.min),
    NUMBER.format(s.q1),
    NUMBER.format(s.median),
    NUMBER.format(s.mean),
    NUMBER.format(s.q3),
    NUMBER.format(s.max),
    NUMBER.format(s.stdDev),
    NUMBER.format(s.iqr),
    s.outliers.length,
    s.skewness !== null ? NUMBER.format(s.skewness) : 'n/d',
  ].join(';');
}

/**
 * Exporta el análisis de distribución (resumen de 5 números e histograma) a CSV.
 */
export function distributionToCsv(result: DistributionResult): string {
  const lines: string[] = [];

  lines.push(`Análisis de distribución;Métrica: ${escapeField(result.measureName)}`);
  if (result.groupDimName) {
    lines.push(`Desglose por dimensión;${escapeField(result.groupDimName)}`);
  }
  lines.push('');

  // 1. Resumen Estadístico / 5 Números
  lines.push('--- Resumen estadístico (5 números y dispersión) ---');
  const summaryHeader = [
    'Grupo',
    'Muestra (N)',
    'Mínimo',
    'Q1 (25%)',
    'Mediana (50%)',
    'Media',
    'Q3 (75%)',
    'Máximo',
    'Desv. Típica (σ)',
    'Rango IQR',
    'Atípicos (N)',
    'Asimetría',
  ];
  lines.push(summaryHeader.join(';'));
  lines.push(summaryRow('Total global', result.overall));

  if (result.groups && result.groups.length > 0) {
    for (const group of result.groups) {
      lines.push(summaryRow(group.group, group.summary));
    }
  }

  lines.push('');

  // 2. Frecuencias del Histograma
  lines.push('--- Frecuencias del histograma (Distribución global) ---');
  lines.push(['Intervalo', 'Límite Inferior', 'Límite Superior', 'Conteo', 'Frecuencia Relativa (%)'].join(';'));

  for (const bin of result.histogram.bins) {
    lines.push(
      [
        escapeField(bin.label),
        NUMBER.format(bin.x0),
        NUMBER.format(bin.x1),
        bin.count,
        `${NUMBER.format(bin.relativeFrequency)} %`,
      ].join(';'),
    );
  }

  // 3. Detalle de valores atípicos
  if (result.overall.outliers.length > 0) {
    lines.push('');
    lines.push('--- Valores atípicos detectados (IQR 1.5x) ---');
    lines.push(`Límite inferior (< Q1 - 1.5*IQR);${NUMBER.format(result.overall.lowerFence)}`);
    lines.push(`Límite superior (> Q3 + 1.5*IQR);${NUMBER.format(result.overall.upperFence)}`);
    lines.push(`Total de atípicos;${result.overall.outliers.length}`);
    lines.push(['Índice', 'Valor'].join(';'));
    result.overall.outliers.forEach((val, idx) => {
      lines.push([idx + 1, NUMBER.format(val)].join(';'));
    });
  }

  return BOM + lines.join('\r\n');
}
