import type { ChurnAnalysisResult } from './churn';

const NUMBER = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 });
const PERCENT = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 1 });

/** BOM de UTF-8: sin él Excel abre el fichero como ANSI y rompe las tildes. */
const BOM = '\u{FEFF}';

const STATUS_LABELS: Record<string, string> = {
  nuevo: 'Nuevo',
  recurrente: 'Recurrente',
  reactivado: 'Reactivado',
  perdido: 'Perdido (Churn)',
};

/**
 * Exporta el análisis de movimiento y churn a CSV estructurado.
 */
export function churnToCsv(result: ChurnAnalysisResult): string {
  const lines: string[] = [];

  // 1. Resumen por Período
  lines.push('--- MOVIMIENTO POR PERÍODO ---');
  lines.push(
    [
      'Período',
      'Clientes Activos',
      'Nuevos',
      'Recurrentes',
      'Reactivados',
      'Perdidos (Churn)',
      'Variación Neta Clientes',
      'Tasa de Churn (%)',
      'Tasa de Retención (%)',
      'Quick Ratio',
      'Ingresos Totales',
      'Ingresos Nuevos',
      'Ingresos Recurrentes',
      'Ingresos Reactivados',
      'Ingresos Perdidos',
      'Variación Neta Ingresos',
    ]
      .map(escapeField)
      .join(';'),
  );

  for (const p of result.periods) {
    lines.push(
      [
        escapeField(p.periodLabel),
        NUMBER.format(p.activeCustomers),
        NUMBER.format(p.newCustomers),
        NUMBER.format(p.returningCustomers),
        NUMBER.format(p.reactivatedCustomers),
        NUMBER.format(p.churnedCustomers),
        NUMBER.format(p.netCustomerChange),
        p.churnRate !== null ? PERCENT.format(p.churnRate) : '—',
        p.retentionRate !== null ? PERCENT.format(p.retentionRate) : '—',
        p.quickRatio !== null ? NUMBER.format(p.quickRatio) : '—',
        NUMBER.format(p.totalRevenue),
        NUMBER.format(p.newRevenue),
        NUMBER.format(p.returningRevenue),
        NUMBER.format(p.reactivatedRevenue),
        NUMBER.format(p.churnedRevenue),
        NUMBER.format(p.netRevenueChange),
      ].join(';'),
    );
  }

  lines.push('');
  lines.push('--- DETALLE DE CLIENTES ---');
  lines.push(
    [
      'Cliente',
      'Estado',
      'Primer Período Visto',
      'Último Período Visto',
      'Importe Período Actual',
      'Importe Período Anterior',
    ]
      .map(escapeField)
      .join(';'),
  );

  for (const c of result.customers) {
    lines.push(
      [
        escapeField(c.customerId),
        escapeField(STATUS_LABELS[c.status] ?? c.status),
        escapeField(c.firstSeenPeriod),
        escapeField(c.lastSeenPeriod),
        NUMBER.format(c.currentRevenue),
        NUMBER.format(c.previousRevenue),
      ].join(';'),
    );
  }

  return BOM + lines.join('\r\n');
}

function escapeField(field: string): string {
  return /[;"\r\n]/.test(field) ? `"${field.replaceAll('"', '""')}"` : field;
}
