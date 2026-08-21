import type { SpcSummary } from './spc';

const BOM = '\u{FEFF}';
const NUMBER = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 4 });

function escapeField(field: string): string {
  return /[;"\r\n]/.test(field) ? `"${field.replaceAll('"', '""')}"` : field;
}

export function spcToCsv(summary: SpcSummary): string {
  const lines: string[] = [];

  // Sección 1: Parámetros del Proceso y Límites de Control
  lines.push('--- CONTROL ESTADÍSTICO DE PROCESO (SPC) ---');
  lines.push(['Parámetro / Límite', 'Valor'].map(escapeField).join(';'));
  lines.push([escapeField('Estado del proceso'), summary.isProcessInControl ? 'En Control' : 'Fuera de Control'].join(';'));
  lines.push([escapeField('Muestras analizadas'), NUMBER.format(summary.validPoints)].join(';'));
  lines.push([escapeField('Media (CL - Línea Central)'), NUMBER.format(summary.mean)].join(';'));
  lines.push([escapeField('Desviación Sigma (σ)'), NUMBER.format(summary.sigma)].join(';'));
  lines.push([escapeField('Límite Superior (UCL +3σ)'), NUMBER.format(summary.ucl)].join(';'));
  lines.push([escapeField('Zona A Superior (+2σ)'), NUMBER.format(summary.sigma2Plus)].join(';'));
  lines.push([escapeField('Zona B Superior (+1σ)'), NUMBER.format(summary.sigma1Plus)].join(';'));
  lines.push([escapeField('Zona B Inferior (-1σ)'), NUMBER.format(summary.sigma1Minus)].join(';'));
  lines.push([escapeField('Zona A Inferior (-2σ)'), NUMBER.format(summary.sigma2Minus)].join(';'));
  lines.push([escapeField('Límite Inferior (LCL -3σ)'), NUMBER.format(summary.lcl)].join(';'));
  lines.push([escapeField('Puntos en control (%)'), `${summary.pointsInControlPercent.toFixed(1)}%`].join(';'));
  lines.push([escapeField('Total de violaciones detectadas'), NUMBER.format(summary.violationsCount)].join(';'));
  lines.push('');

  // Sección 2: Registro de Violaciones (Causas Especiales)
  if (summary.violationLog.length > 0) {
    lines.push('--- REGISTRO DE VIOLACIONES Y CAUSAS ESPECIALES ---');
    lines.push(
      ['Muestra #', 'Etiqueta', 'Valor', 'Regla #', 'Nombre de Regla', 'Severidad', 'Descripción']
        .map(escapeField)
        .join(';'),
    );
    for (const log of summary.violationLog) {
      lines.push(
        [
          NUMBER.format(log.pointIndex),
          escapeField(log.pointLabel),
          NUMBER.format(log.value),
          NUMBER.format(log.rule.ruleNumber),
          escapeField(log.rule.ruleName),
          escapeField(log.rule.severity),
          escapeField(log.rule.description),
        ].join(';'),
      );
    }
    lines.push('');
  }

  // Sección 3: Datos Completos de los Puntos de Muestra
  lines.push('--- TABLA DE PUNTOS DE CONTROL ---');
  lines.push(
    ['#', 'Etiqueta / Lote', 'Valor', 'Rango Móvil (MR)', 'Z-Score (σ)', 'Zona', 'Estado', 'Reglas Violadas']
      .map(escapeField)
      .join(';'),
  );
  for (const p of summary.points) {
    const rulesStr = p.violations.map((v) => `R${v.ruleNumber}`).join(', ');
    lines.push(
      [
        NUMBER.format(p.index),
        escapeField(p.label),
        NUMBER.format(p.value),
        p.movingRange !== null ? NUMBER.format(p.movingRange) : '',
        NUMBER.format(p.zScore),
        escapeField(p.zone),
        p.isInControl ? 'En Control' : 'Fuera de Control',
        escapeField(rulesStr),
      ].join(';'),
    );
  }

  return BOM + lines.join('\r\n');
}
