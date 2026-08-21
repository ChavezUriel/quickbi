import type { ParetoResult } from './pareto';

const NUMBER = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 4 });
const BOM = '\u{FEFF}';

function escapeField(field: string): string {
  return /[;"\r\n]/.test(field) ? `"${field.replaceAll('"', '""')}"` : field;
}

/**
 * Exporta el análisis de Pareto y clasificación ABC a CSV.
 */
export function paretoToCsv(result: ParetoResult): string {
  const lines: string[] = [];

  lines.push(`Análisis de Pareto y Clasificación ABC;Entidad: ${escapeField(result.categoryDim)};Métrica: ${escapeField(result.measureColumn)}`);
  lines.push(`Total entidades;${result.totalEntities};Valor total;${NUMBER.format(result.totalValue)}`);
  lines.push(`Coeficiente de Gini;${NUMBER.format(result.concentration.gini)}`);
  lines.push(`Regla 80/20;El ${NUMBER.format(result.concentration.entitiesFor80Share)} % de los elementos (${result.concentration.entitiesFor80}) genera el 80 % del volumen.`);
  lines.push('');

  // 1. Resumen por clase ABC
  lines.push('--- Resumen por clasificación ABC ---');
  const summaryHeader = [
    'Clasificación',
    'Descripción',
    'Nº Elementos',
    '% Elementos',
    'Valor Acumulado',
    '% Valor',
    'Media por elemento',
  ];
  lines.push(summaryHeader.join(';'));

  for (const cls of ['A', 'B', 'C'] as const) {
    const s = result.summaryABC[cls];
    lines.push(
      [
        `Clase ${s.classABC}`,
        escapeField(s.label),
        s.count,
        `${NUMBER.format(s.countShare)} %`,
        NUMBER.format(s.totalValue),
        `${NUMBER.format(s.valueShare)} %`,
        NUMBER.format(s.meanValue),
      ].join(';'),
    );
  }

  lines.push('');

  // 2. Tabla completa de elementos clasificados
  lines.push('--- Detalle completo de elementos rankeados ---');
  const detailHeader = [
    'Rango',
    escapeField(result.categoryDim),
    escapeField(result.measureColumn),
    '% Cuota Individual',
    'Valor Acumulado',
    '% Cuota Acumulada',
    'Clase ABC',
  ];
  lines.push(detailHeader.join(';'));

  for (const item of result.items) {
    lines.push(
      [
        item.rank,
        escapeField(item.entity),
        NUMBER.format(item.value),
        `${NUMBER.format(item.share)} %`,
        NUMBER.format(item.cumulativeValue),
        `${NUMBER.format(item.cumulativeShare)} %`,
        `Clase ${item.classABC}`,
      ].join(';'),
    );
  }

  return BOM + lines.join('\r\n');
}
