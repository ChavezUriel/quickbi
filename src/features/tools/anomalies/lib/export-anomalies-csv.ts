import type { AnomaliesResult } from './anomalies';

const NUMBER = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 4 });
const BOM = '\u{FEFF}';

const SEVERITY_LABEL: Record<string, string> = {
  critica: 'Crítica',
  alta: 'Alta',
  moderada: 'Moderada',
  leve: 'Leve',
};

const TYPE_LABEL: Record<string, string> = {
  pico: 'Pico inusual',
  caida: 'Caída brusca',
  normal: 'Normal',
};

/**
 * Exporta la serie temporal y las anomalías detectadas a CSV con BOM UTF-8.
 */
export function anomaliesToCsv(result: AnomaliesResult): string {
  const header = [
    'Período',
    'Fecha / Clave',
    'Valor Real',
    'Valor Esperado',
    'Límite Inferior',
    'Límite Superior',
    'Desviación',
    'Desviación %',
    'Es Anomalía',
    'Tipo',
    'Severidad',
    'Puntuación (Score)',
  ];

  const lines = [
    header.map(escapeField).join(';'),
    ...result.points.map((p) =>
      [
        escapeField(p.label),
        escapeField(p.bucket),
        NUMBER.format(p.actual),
        NUMBER.format(p.expected),
        NUMBER.format(p.lowerBound),
        NUMBER.format(p.upperBound),
        NUMBER.format(p.diff),
        p.diffPct !== null ? `${NUMBER.format(p.diffPct)} %` : '—',
        p.isAnomaly ? 'Sí' : 'No',
        escapeField(TYPE_LABEL[p.type] ?? p.type),
        p.isAnomaly ? escapeField(SEVERITY_LABEL[p.severity] ?? p.severity) : '—',
        NUMBER.format(p.score),
      ].join(';'),
    ),
  ];

  return BOM + lines.join('\r\n');
}

function escapeField(field: string): string {
  return /[;"\r\n]/.test(field) ? `"${field.replaceAll('"', '""')}"` : field;
}
