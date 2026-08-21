import { AGING_BUCKETS, VELOCITY_CATEGORIES, type InventoryItem } from './inventory';

const NUMBER = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 });

/** BOM de UTF-8: sin él Excel abre el fichero como ANSI y rompe las tildes. */
const BOM = '\u{FEFF}';

const HEADER = [
  'SKU / Producto',
  'Categoría',
  'Stock Actual',
  'Ventas / Salidas',
  'Rotación Anual (Turnover)',
  'DSI (Días de Inventario)',
  'Días de Antigüedad',
  'Tramo de Antigüedad',
  'Velocidad de Rotación',
  'Recomendación Operativa',
];

const AGING_LABELS = new Map(AGING_BUCKETS.map((b) => [b.id, b.label]));
const VELOCITY_LABELS = new Map(VELOCITY_CATEGORIES.map((v) => [v.id, v.label]));

/**
 * Exporta el análisis de rotación y antigüedad de stock a CSV.
 */
export function inventoryToCsv(items: readonly InventoryItem[]): string {
  const lines = [
    HEADER.map(escapeField).join(';'),
    ...items.map((item) =>
      [
        escapeField(item.id),
        escapeField(item.category),
        NUMBER.format(item.stock),
        NUMBER.format(item.sales),
        NUMBER.format(item.turnover),
        String(item.dsi),
        String(item.agingDays),
        escapeField(AGING_LABELS.get(item.agingBucket) ?? item.agingBucket),
        escapeField(VELOCITY_LABELS.get(item.velocityCategory) ?? item.velocityCategory),
        escapeField(item.recommendation),
      ].join(';'),
    ),
  ];

  return BOM + lines.join('\r\n');
}

function escapeField(field: string): string {
  return /[;"\r\n]/.test(field) ? `"${field.replaceAll('"', '""')}"` : field;
}
