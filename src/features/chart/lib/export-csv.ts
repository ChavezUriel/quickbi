import type { AggregateResult } from './aggregate';

const number = new Intl.NumberFormat('es-ES');

/**
 * Serializa el resultado agregado a CSV pensado para Excel en español:
 * separador `;` (la coma es el decimal), números formateados en es-ES y BOM
 * para que Excel detecte UTF-8 sin pasar por el asistente de importación.
 */
export function aggregateToCsv(
  result: AggregateResult,
  dimensionHeader: string,
  valueHeader: string,
): string {
  const lines = [
    [dimensionHeader, valueHeader, 'Filas'].map(escapeField).join(';'),
    ...result.rows.map((row) =>
      [escapeField(row.label), number.format(row.value), String(row.rowCount)].join(';'),
    ),
  ];

  // BOM explícito: sin él, Excel abre el UTF-8 como ANSI y rompe las tildes.
  return '\ufeff' + lines.join('\r\n');
}

function escapeField(field: string): string {
  return /[;"\r\n]/.test(field) ? `"${field.replaceAll('"', '""')}"` : field;
}
