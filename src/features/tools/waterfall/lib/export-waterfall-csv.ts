import type { WaterfallResult } from './waterfall';

const NUMBER = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 4 });
const BOM = '\u{FEFF}';

const TYPE_LABEL: Record<string, string> = {
  inicio: 'Inicio',
  crecimiento: 'Crecimiento',
  contraccion: 'Contracción',
  nuevo: 'Nuevo',
  perdido: 'Perdido',
  sin_cambio: 'Sin cambio',
  final: 'Final',
};

/**
 * Exporta el desglose del puente de variación a CSV con BOM UTF-8.
 */
export function waterfallToCsv(result: WaterfallResult): string {
  const header = [
    'Categoría',
    'Tipo de aporte',
    `Período 1 (${result.period1Label})`,
    `Período 2 (${result.period2Label})`,
    'Variación absoluta',
    'Variación %',
    'Aporte a la variación %',
  ];

  const lines = [
    header.map(escapeField).join(';'),
    ...result.items.map((item) =>
      [
        escapeField(item.category),
        escapeField(TYPE_LABEL[item.type] ?? item.type),
        NUMBER.format(item.p1),
        NUMBER.format(item.p2),
        NUMBER.format(item.diff),
        item.diffPct !== null ? `${NUMBER.format(item.diffPct)} %` : '—',
        `${NUMBER.format(item.shareOfDiff)} %`,
      ].join(';'),
    ),
    [
      'TOTAL NETO',
      'Neto',
      NUMBER.format(result.totalP1),
      NUMBER.format(result.totalP2),
      NUMBER.format(result.netDiff),
      result.netDiffPct !== null ? `${NUMBER.format(result.netDiffPct)} %` : '—',
      '100,0 %',
    ].map(escapeField).join(';'),
  ];

  return BOM + lines.join('\r\n');
}

function escapeField(field: string): string {
  return /[;"\r\n]/.test(field) ? `"${field.replaceAll('"', '""')}"` : field;
}
