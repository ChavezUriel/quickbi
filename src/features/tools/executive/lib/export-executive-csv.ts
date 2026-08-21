import type { ExecutiveSummary } from './executive';

const BOM = '\u{FEFF}';
const NUMBER = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 4 });

function escapeField(field: string): string {
  return /[;"\r\n]/.test(field) ? `"${field.replaceAll('"', '""')}"` : field;
}

export function executiveToCsv(summary: ExecutiveSummary): string {
  const lines: string[] = [];

  // Sección 1: Resumen General de Métricas
  lines.push('--- RESUMEN EJECUTIVO GENERAL ---');
  lines.push(['Métrica', 'Valor'].map(escapeField).join(';'));
  lines.push([escapeField('Registros válidos'), NUMBER.format(summary.validCount)].join(';'));
  lines.push([escapeField('Total acumulado'), NUMBER.format(summary.totalValue)].join(';'));
  lines.push([escapeField('Media por registro'), NUMBER.format(summary.meanValue)].join(';'));
  lines.push([escapeField('Mediana'), NUMBER.format(summary.medianValue)].join(';'));
  lines.push([escapeField('Mínimo'), NUMBER.format(summary.minValue)].join(';'));
  lines.push([escapeField('Máximo'), NUMBER.format(summary.maxValue)].join(';'));
  lines.push([escapeField('Desviación estándar (σ)'), NUMBER.format(summary.stdDev)].join(';'));
  lines.push([escapeField('Coeficiente de variación (%)'), NUMBER.format(summary.cv)].join(';'));
  lines.push('');

  // Sección 2: Análisis de Pareto / Categorías
  if (summary.pareto.topCategories.length > 0) {
    lines.push('--- CONCENTRACIÓN POR CATEGORÍA (PARETO) ---');
    lines.push(['Categoría', 'Valor', 'Participación (%)', 'Acumulado (%)'].map(escapeField).join(';'));
    for (const cat of summary.pareto.topCategories) {
      lines.push(
        [
          escapeField(cat.name),
          NUMBER.format(cat.value),
          NUMBER.format(cat.share),
          NUMBER.format(cat.cumulativeShare),
        ].join(';'),
      );
    }
    lines.push('');
  }

  // Sección 3: Evolución Temporal
  if (summary.trend.timeBuckets.length > 0) {
    lines.push('--- EVOLUCIÓN TEMPORAL ---');
    lines.push(['Período', 'Etiqueta', 'Valor'].map(escapeField).join(';'));
    for (const tb of summary.trend.timeBuckets) {
      lines.push(
        [
          escapeField(tb.bucket),
          escapeField(tb.label),
          NUMBER.format(tb.value),
        ].join(';'),
      );
    }
    lines.push('');
  }

  // Sección 4: Anomalías Detectadas
  if (summary.anomalies.length > 0) {
    lines.push('--- ANOMALÍAS DETECTADAS (±2σ) ---');
    lines.push(['Período', 'Etiqueta', 'Valor', 'Z-Score', 'Diagnóstico'].map(escapeField).join(';'));
    for (const anom of summary.anomalies) {
      lines.push(
        [
          escapeField(anom.bucket),
          escapeField(anom.label),
          NUMBER.format(anom.value),
          NUMBER.format(anom.zScore),
          escapeField(anom.reason),
        ].join(';'),
      );
    }
  }

  return BOM + lines.join('\r\n');
}
