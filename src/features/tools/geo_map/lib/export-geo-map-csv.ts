import type { GeoMapResult } from './geo_map';

const NUMBER = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 });
const PERCENT = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 });

/** BOM de UTF-8: sin él Excel abre el fichero como ANSI y rompe las tildes. */
const BOM = '\u{FEFF}';

const HEADER = [
  'Ranking',
  'Territorio',
  'Nombre Normalizado',
  'Zona / Región',
  'Valor Métrica',
  '% Del Total',
  '% Acumulado',
  'Registros',
  'Promedio por Registro',
];

/**
 * Exporta el análisis territorial y mapa geográfico a CSV.
 */
export function geoMapToCsv(result: GeoMapResult): string {
  const lines = [
    HEADER.map(escapeField).join(';'),
    ...result.territories.map((item) =>
      [
        String(item.rank),
        escapeField(item.territory),
        escapeField(item.normalizedName),
        escapeField(item.zone),
        NUMBER.format(item.value),
        `${PERCENT.format(item.share)} %`,
        `${PERCENT.format(item.cumulativeShare)} %`,
        NUMBER.format(item.rowCount),
        NUMBER.format(item.avgPerRecord),
      ].join(';'),
    ),
  ];

  return BOM + lines.join('\r\n');
}

function escapeField(field: string): string {
  return /[;"\r\n]/.test(field) ? `"${field.replaceAll('"', '""')}"` : field;
}
