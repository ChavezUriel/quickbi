import type { ReconciledRecord } from './reconciliation';

const NUMBER = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 });
const PERCENT = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 });

/** BOM de UTF-8: sin él Excel abre el fichero como ANSI y rompe las tildes. */
const BOM = '\u{FEFF}';

const HEADER = [
  'Clave / Identificador',
  'Estado',
  'Importe Fuente A',
  'Importe Fuente B',
  'Diferencia (Delta A-B)',
  'Diferencia Absoluta',
  'Variación %',
  'Diagnóstico',
];

const STATUS_LABELS: Record<string, string> = {
  exacto: 'Coincidencia Exacta',
  discrepancia: 'Discrepancia de Importe',
  solo_a: 'Solo en Fuente A',
  solo_b: 'Solo en Fuente B',
};

/**
 * Exporta el informe de conciliación de datos a CSV listo para auditoría.
 */
export function reconciliationToCsv(records: readonly ReconciledRecord[]): string {
  const lines = [
    HEADER.map(escapeField).join(';'),
    ...records.map((r) =>
      [
        escapeField(r.key),
        escapeField(STATUS_LABELS[r.status] ?? r.status),
        NUMBER.format(r.valueA),
        NUMBER.format(r.valueB),
        NUMBER.format(r.delta),
        NUMBER.format(r.absDelta),
        r.deltaPercent !== null ? `${PERCENT.format(r.deltaPercent)} %` : '—',
        escapeField(r.explanation),
      ].join(';'),
    ),
  ];

  return BOM + lines.join('\r\n');
}

function escapeField(field: string): string {
  return /[;"\r\n]/.test(field) ? `"${field.replaceAll('"', '""')}"` : field;
}
