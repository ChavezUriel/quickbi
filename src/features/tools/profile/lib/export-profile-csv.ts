import type { DatasetProfile } from './profile-stats';

const NUMBER = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 4 });

/** BOM de UTF-8: sin él Excel abre el fichero como ANSI y rompe las tildes. */
const BOM = '\u{FEFF}';

const HEADER = [
  'Columna',
  'Tipo',
  'Filas',
  'Con valor',
  'Vacías',
  'Inválidas',
  'Distintos',
  'Mínimo',
  'Máximo',
  'Media',
  'Mediana',
  'Desviación típica',
  'Valor más frecuente',
];

/**
 * El perfil, una fila por columna. Es el resumen que se pega en un correo
 * cuando hay que decidir con qué datos se puede contar y con cuáles no.
 */
export function profileToCsv(profile: DatasetProfile): string {
  const lines = [
    HEADER.map(escapeField).join(';'),
    ...profile.columns.map((column) =>
      [
        escapeField(column.name),
        column.type,
        NUMBER.format(column.total),
        NUMBER.format(column.valid),
        NUMBER.format(column.nulls),
        NUMBER.format(column.invalid),
        `${NUMBER.format(column.distinctCount)}${column.distinctCountExact ? '' : '+'}`,
        numberOrDate(column.numeric?.min, column.date?.min),
        numberOrDate(column.numeric?.max, column.date?.max),
        column.numeric === null ? '' : NUMBER.format(column.numeric.mean),
        column.numeric === null ? '' : NUMBER.format(column.numeric.median),
        column.numeric === null ? '' : NUMBER.format(column.numeric.stdDev),
        escapeField(column.top?.[0]?.value ?? ''),
      ].join(';'),
    ),
  ];

  return BOM + lines.join('\r\n');
}

function numberOrDate(value: number | undefined, day: string | undefined): string {
  if (value !== undefined) return NUMBER.format(value);
  return day ?? '';
}

function escapeField(field: string): string {
  return /[;"\r\n]/.test(field) ? `"${field.replaceAll('"', '""')}"` : field;
}
