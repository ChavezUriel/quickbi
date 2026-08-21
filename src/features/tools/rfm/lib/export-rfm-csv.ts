import { RFM_SEGMENTS, type RfmCustomer } from './rfm';

const NUMBER = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 4 });

/** BOM de UTF-8: sin él Excel abre el fichero como ANSI y rompe las tildes. */
const BOM = '\u{FEFF}';

const HEADER = [
  'Cliente',
  'Días desde la última compra',
  'Compras',
  'Importe',
  'R',
  'F',
  'M',
  'Segmento',
];

const LABELS = new Map(RFM_SEGMENTS.map((segment) => [segment.id, segment.label]));

/**
 * La cartera segmentada, un cliente por fila: es el fichero que se lleva uno
 * a la herramienta de campañas, y por eso lleva el segmento ya en palabras y
 * no en la pareja de notas.
 */
export function rfmToCsv(customers: readonly RfmCustomer[]): string {
  const lines = [
    HEADER.map(escapeField).join(';'),
    ...customers.map((customer) =>
      [
        escapeField(customer.id),
        NUMBER.format(customer.recencyDays),
        NUMBER.format(customer.frequency),
        NUMBER.format(customer.monetary),
        String(customer.r),
        String(customer.f),
        String(customer.m),
        escapeField(LABELS.get(customer.segment) ?? customer.segment),
      ].join(';'),
    ),
  ];

  return BOM + lines.join('\r\n');
}

function escapeField(field: string): string {
  return /[;"\r\n]/.test(field) ? `"${field.replaceAll('"', '""')}"` : field;
}
