import type { ForecastSummary } from './forecast';

const BOM = '\u{FEFF}';
const NUMBER = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 4 });

function escapeField(field: string): string {
  return /[;"\r\n]/.test(field) ? `"${field.replaceAll('"', '""')}"` : field;
}

export function forecastToCsv(summary: ForecastSummary): string {
  const lines: string[] = [];

  // Sección 1: Metadatos del Modelo
  lines.push('--- INFORME DE PRONÓSTICO Y PROYECCIÓN ---');
  lines.push(['Parámetro', 'Valor'].map(escapeField).join(';'));
  lines.push([escapeField('Modelo utilizado'), escapeField(summary.modelUsed)].join(';'));
  lines.push([escapeField('Granularidad temporal'), escapeField(summary.grain)].join(';'));
  lines.push([escapeField('Horizonte proyectado'), `${summary.horizon} períodos`].join(';'));
  lines.push([escapeField('Nivel de confianza'), `${summary.confidenceLevel}%`].join(';'));
  lines.push([escapeField('MAPE (Error % medio)'), `${summary.metrics.mape.toFixed(2)}%`].join(';'));
  lines.push([escapeField('RMSE'), NUMBER.format(summary.metrics.rmse)].join(';'));
  lines.push([escapeField('MAE'), NUMBER.format(summary.metrics.mae)].join(';'));
  lines.push([escapeField('R² (Ajuste)'), NUMBER.format(summary.metrics.r2)].join(';'));
  lines.push([escapeField('Calificación de precisión'), escapeField(summary.metrics.accuracyRating)].join(';'));
  lines.push('');

  // Sección 2: Tabla Proyectada (Futuro)
  lines.push('--- PROYECCIÓN FUTURA ---');
  lines.push(
    [
      'Período',
      'Etiqueta',
      'Pronóstico',
      `Límite Inferior (${summary.confidenceLevel}%)`,
      `Límite Superior (${summary.confidenceLevel}%)`,
      'Tendencia Base',
      'Efecto Estacional',
    ]
      .map(escapeField)
      .join(';'),
  );
  for (const f of summary.forecast) {
    lines.push(
      [
        escapeField(f.bucket),
        escapeField(f.label),
        NUMBER.format(f.forecast),
        NUMBER.format(f.lowerBound),
        NUMBER.format(f.upperBound),
        NUMBER.format(f.trendComponent),
        NUMBER.format(f.seasonalComponent),
      ].join(';'),
    );
  }
  lines.push('');

  // Sección 3: Serie Histórica y Ajuste
  lines.push('--- SERIE HISTÓRICA Y AJUSTE DEL MODELO ---');
  lines.push(['Período', 'Etiqueta', 'Valor Real', 'Valor Ajustado'].map(escapeField).join(';'));
  for (const h of summary.historical) {
    lines.push(
      [
        escapeField(h.bucket),
        escapeField(h.label),
        NUMBER.format(h.actual),
        NUMBER.format(h.fitted),
      ].join(';'),
    );
  }

  return BOM + lines.join('\r\n');
}
