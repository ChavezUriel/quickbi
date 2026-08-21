import type { SeasonalitySummary } from './seasonality';

const BOM = '\u{FEFF}';
const NUMBER = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 4 });

function escapeField(field: string): string {
  return /[;"\r\n]/.test(field) ? `"${field.replaceAll('"', '""')}"` : field;
}

export function seasonalityToCsv(summary: SeasonalitySummary): string {
  const lines: string[] = [];

  // Sección 1: Día de la Semana
  lines.push('--- ESTACIONALIDAD POR DÍA DE LA SEMANA ---');
  lines.push(
    [
      'Día',
      'Volumen Total',
      'Ocurrencias',
      'Promedio Diario',
      'Participación (%)',
      'Índice Estacional (Base 100)',
    ]
      .map(escapeField)
      .join(';'),
  );
  for (const dow of summary.daysOfWeek) {
    lines.push(
      [
        escapeField(dow.name),
        NUMBER.format(dow.total),
        NUMBER.format(dow.occurrences),
        NUMBER.format(dow.average),
        NUMBER.format(dow.share),
        NUMBER.format(dow.seasonalityIndex),
      ].join(';'),
    );
  }
  lines.push('');

  // Sección 2: Mes del Año
  lines.push('--- ESTACIONALIDAD POR MES DEL AÑO ---');
  lines.push(
    [
      'Mes',
      'Volumen Total',
      'Ocurrencias',
      'Promedio Mensual',
      'Participación (%)',
      'Índice Estacional (Base 100)',
    ]
      .map(escapeField)
      .join(';'),
  );
  for (const m of summary.monthsOfYear) {
    lines.push(
      [
        escapeField(m.name),
        NUMBER.format(m.total),
        NUMBER.format(m.occurrences),
        NUMBER.format(m.average),
        NUMBER.format(m.share),
        NUMBER.format(m.seasonalityIndex),
      ].join(';'),
    );
  }
  lines.push('');

  // Sección 3: Trimestres
  lines.push('--- ESTACIONALIDAD POR TRIMESTRE ---');
  lines.push(
    [
      'Trimestre',
      'Volumen Total',
      'Promedio',
      'Participación (%)',
      'Índice Estacional (Base 100)',
    ]
      .map(escapeField)
      .join(';'),
  );
  for (const q of summary.quarters) {
    lines.push(
      [
        escapeField(q.name),
        NUMBER.format(q.total),
        NUMBER.format(q.average),
        NUMBER.format(q.share),
        NUMBER.format(q.seasonalityIndex),
      ].join(';'),
    );
  }
  lines.push('');

  // Sección 4: Serie Diaria Completa con Media Móvil
  lines.push('--- SERIE DIARIA Y MEDIA MÓVIL ---');
  lines.push(['Fecha', 'Valor', 'Media Móvil'].map(escapeField).join(';'));
  for (const p of summary.timeline) {
    lines.push(
      [
        escapeField(p.date),
        NUMBER.format(p.value),
        p.movingAvg !== null ? NUMBER.format(p.movingAvg) : '',
      ].join(';'),
    );
  }

  return BOM + lines.join('\r\n');
}
