import type { ExplorationResult } from '../types';

const NUMBER = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 4 });

/** BOM de UTF-8: sin él Excel abre el fichero como ANSI y rompe las tildes. */
const BOM = '\u{FEFF}';

/**
 * Serializa el detalle por dimensión a CSV pensado para Excel en español (México):
 * separador `;` (el punto es el decimal) y números en es-MX.
 */
export function explorationToCsv(
  result: ExplorationResult,
  dimensionHeader: string,
  metricHeader: string,
): string {
  const hasComparison = result.previousWindow !== null;

  const header = [
    dimensionHeader,
    metricHeader,
    'Participación %',
    ...(hasComparison ? ['Período anterior', 'Variación %'] : []),
  ];

  const lines = [
    header.map(escapeField).join(';'),
    ...result.items.map((item) =>
      [
        escapeField(item.name),
        NUMBER.format(item.value),
        item.sharePct === null ? '' : NUMBER.format(item.sharePct),
        ...(hasComparison
          ? [
              item.previousValue === null ? '' : NUMBER.format(item.previousValue),
              item.deltaPct === null ? '' : NUMBER.format(item.deltaPct),
            ]
          : []),
      ].join(';'),
    ),
  ];

  return BOM + lines.join('\r\n');
}

function escapeField(field: string): string {
  return /[;"\r\n]/.test(field) ? `"${field.replaceAll('"', '""')}"` : field;
}
