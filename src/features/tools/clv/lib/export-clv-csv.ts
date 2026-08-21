import type { ClvResult } from './clv';

const NUMBER = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 4 });
const BOM = '\u{FEFF}';

const STATUS_LABEL: Record<string, string> = {
  activo: 'Activo',
  en_riesgo: 'En riesgo',
  inactivo: 'Inactivo',
};

/**
 * Exporta el ranking de clientes y métricas de CLV a CSV con BOM UTF-8.
 */
export function clvToCsv(result: ClvResult): string {
  const header = [
    'Ranking',
    'Cliente',
    'CLV Histórico (Total)',
    'Compras (Pedidos)',
    'Ticket Medio (AOV)',
    'Primera Compra',
    'Última Compra',
    'Días de Vida',
    'Días Inactivo (Recencia)',
    'Frecuencia Anual Estimada',
    'Decil',
    'Estado',
    'CLV Proyectado',
  ];

  const lines = [
    header.map(escapeField).join(';'),
    ...result.customers.map((c) =>
      [
        String(c.rank),
        escapeField(c.id),
        NUMBER.format(c.totalSpend),
        NUMBER.format(c.orderCount),
        NUMBER.format(c.aov),
        c.firstDay,
        c.lastDay,
        NUMBER.format(c.lifespanDays),
        NUMBER.format(c.recencyDays),
        NUMBER.format(c.annualFrequency),
        `D${c.decile}`,
        escapeField(STATUS_LABEL[c.status] ?? c.status),
        NUMBER.format(c.projectedClv),
      ].join(';'),
    ),
  ];

  return BOM + lines.join('\r\n');
}

function escapeField(field: string): string {
  return /[;"\r\n]/.test(field) ? `"${field.replaceAll('"', '""')}"` : field;
}
