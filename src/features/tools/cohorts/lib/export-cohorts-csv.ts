import type { CohortsResult } from './cohorts';

const NUMBER = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 });
const BOM = '\u{FEFF}';

/**
 * Exporta la matriz de cohortes a CSV con BOM UTF-8.
 */
export function cohortsToCsv(
  result: CohortsResult,
  metricType: 'clientes' | 'ingresos' = 'clientes',
  displayMode: 'porcentaje' | 'absoluto' = 'porcentaje',
): string {
  const periodHeaders: string[] = [];
  const maxP = result.averageCurve.length;
  const prefix = result.grain === 'mes' ? 'M' : result.grain === 'semana' ? 'S' : 'T';

  for (let i = 0; i < maxP; i++) {
    periodHeaders.push(`${prefix}${i}`);
  }

  const header = [
    'Cohorte',
    'Clave Período',
    'Clientes Iniciales',
    'Ingresos Iniciales',
    'Ingresos Totales',
    ...periodHeaders,
  ];

  const lines = [
    header.map(escapeField).join(';'),
    ...result.cohorts.map((c) => {
      const periodValues = periodHeaders.map((_, pIdx) => {
        const cell = c.periods[pIdx];
        if (!cell || !cell.hasData) return '';
        if (metricType === 'clientes') {
          return displayMode === 'porcentaje'
            ? `${NUMBER.format(cell.customerRetentionRate)} %`
            : NUMBER.format(cell.activeCustomers);
        } else {
          return displayMode === 'porcentaje'
            ? `${NUMBER.format(cell.revenueRetentionRate)} %`
            : NUMBER.format(cell.revenue);
        }
      });

      return [
        escapeField(c.cohortLabel),
        escapeField(c.cohort),
        NUMBER.format(c.initialCustomers),
        NUMBER.format(c.initialRevenue),
        NUMBER.format(c.totalRevenue),
        ...periodValues,
      ].join(';');
    }),
    // Fila promedio
    [
      'PROMEDIO CARTERA',
      'Media',
      NUMBER.format(
        result.cohorts.reduce((s, c) => s + c.initialCustomers, 0) / Math.max(1, result.cohorts.length),
      ),
      NUMBER.format(
        result.cohorts.reduce((s, c) => s + c.initialRevenue, 0) / Math.max(1, result.cohorts.length),
      ),
      NUMBER.format(result.summary.totalRevenue),
      ...result.averageCurve.map((avg) =>
        metricType === 'clientes'
          ? `${NUMBER.format(avg.avgCustomerRetentionRate)} %`
          : `${NUMBER.format(avg.avgRevenueRetentionRate)} %`,
      ),
    ].map(escapeField).join(';'),
  ];

  return BOM + lines.join('\r\n');
}

function escapeField(field: string): string {
  return /[;"\r\n]/.test(field) ? `"${field.replaceAll('"', '""')}"` : field;
}
