import type { CorrelationMatrix, PairAnalysis } from './correlations';

const NUMBER = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 4 });
const BOM = '\u{FEFF}';

function escapeField(field: string): string {
  return /[;"\r\n]/.test(field) ? `"${field.replaceAll('"', '""')}"` : field;
}

/**
 * Exporta la matriz de correlación completa a formato CSV (separador ';' y UTF-8 BOM).
 */
export function correlationMatrixToCsv(matrix: CorrelationMatrix): string {
  const header = ['Métrica', ...matrix.measures];
  const lines = [
    header.map(escapeField).join(';'),
    ...matrix.cells.map((rowCells, i) => {
      const rowName = matrix.measures[i] ?? '';
      const values = rowCells.map((cell) =>
        cell.r === null ? '' : NUMBER.format(cell.r),
      );
      return [escapeField(rowName), ...values].join(';');
    }),
  ];

  return BOM + lines.join('\r\n');
}

/**
 * Exporta los datos de dispersión y parámetros de regresión de un par de variables a CSV.
 */
export function pairDetailsToCsv(pair: PairAnalysis): string {
  const lines: string[] = [];

  lines.push(`Par analizado;${escapeField(pair.xMeasure)} vs ${escapeField(pair.yMeasure)}`);
  lines.push(`Coeficiente de Pearson (r);${pair.r !== null ? NUMBER.format(pair.r) : 'n/d'}`);
  if (pair.regression) {
    lines.push(`Coeficiente de determinación (R²);${NUMBER.format(pair.regression.r2)}`);
    lines.push(`Ecuación de regresión;${escapeField(pair.regression.equation)}`);
    lines.push(`Pendiente (m);${NUMBER.format(pair.regression.slope)}`);
    lines.push(`Intersección (b);${NUMBER.format(pair.regression.intercept)}`);
    lines.push(`Muestra (N);${pair.count}`);
  }
  lines.push(''); // blank line
  lines.push(['Elemento / Fila', escapeField(pair.xMeasure), escapeField(pair.yMeasure)].join(';'));

  for (const point of pair.points) {
    lines.push(
      [escapeField(point.label), NUMBER.format(point.x), NUMBER.format(point.y)].join(';'),
    );
  }

  return BOM + lines.join('\r\n');
}
