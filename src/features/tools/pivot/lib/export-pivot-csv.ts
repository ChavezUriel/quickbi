import type { PivotTable } from './pivot';

const NUMBER = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 4 });

/** BOM de UTF-8: sin él Excel abre el fichero como ANSI y rompe las tildes. */
const BOM = '\u{FEFF}';

/**
 * La tabla dinámica tal y como se ve, para pegarla en una hoja de cálculo:
 * separador `;` y números en es-MX. La fila de totales se incluye solo si
 * estaba a la vista, para que el fichero cuadre con la pantalla.
 */
export function pivotToCsv(
  table: PivotTable,
  rowHeader: string,
  showTotals: boolean,
): string {
  const header = [
    rowHeader,
    ...table.cols.map((col) => col.label),
    ...(showTotals ? ['Total'] : []),
  ];

  const lines = [
    header.map(escapeField).join(';'),
    ...table.rows.map((row, index) =>
      [
        escapeField(row.label),
        ...(table.cells[index] ?? []).map((value) =>
          value === null ? '' : NUMBER.format(value),
        ),
        ...(showTotals ? [NUMBER.format(table.rowTotals[index] ?? 0)] : []),
      ].join(';'),
    ),
  ];

  if (showTotals) {
    lines.push(
      [
        'Total',
        ...table.colTotals.map((value) => NUMBER.format(value)),
        NUMBER.format(table.grandTotal),
      ].join(';'),
    );
  }

  return BOM + lines.join('\r\n');
}

function escapeField(field: string): string {
  return /[;"\r\n]/.test(field) ? `"${field.replaceAll('"', '""')}"` : field;
}
