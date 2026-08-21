import type { ChartData } from './build-chart';

const NUMBER = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 4 });

/** BOM de UTF-8: sin él Excel abre el fichero como ANSI y rompe las tildes. */
const BOM = '\u{FEFF}';

/**
 * Los datos del gráfico, no su imagen: una categoría por fila y una columna
 * por serie. Es lo que hace falta para rehacerlo en otra herramienta o para
 * comprobar una cifra que en el lienzo solo se intuye.
 */
export function chartToCsv(
  data: ChartData,
  categoryHeader: string,
  xLabel: string,
  yLabel: string,
): string {
  if (data.points !== null) {
    const lines = [
      [categoryHeader, xLabel, yLabel].map(escapeField).join(';'),
      ...data.points.map((point) =>
        [escapeField(point.name), NUMBER.format(point.x), NUMBER.format(point.y)].join(
          ';',
        ),
      ),
    ];
    return BOM + lines.join('\r\n');
  }

  const header = [categoryHeader, ...data.series.map((serie) => serie.name)];
  const lines = [
    header.map(escapeField).join(';'),
    ...data.categories.map((category, index) =>
      [
        escapeField(category.label),
        ...data.series.map((serie) => {
          const value = serie.values[index];
          return value === null || value === undefined ? '' : NUMBER.format(value);
        }),
      ].join(';'),
    ),
  ];

  return BOM + lines.join('\r\n');
}

function escapeField(field: string): string {
  return /[;"\r\n]/.test(field) ? `"${field.replaceAll('"', '""')}"` : field;
}
