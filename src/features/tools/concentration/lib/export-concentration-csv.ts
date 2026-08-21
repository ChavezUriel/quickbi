import type { ConcentrationAnalysisResult } from './concentration';

const NUMBER = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 });
const PERCENT = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 1 });

/** BOM de UTF-8: sin él Excel abre el fichero como ANSI y rompe las tildes. */
const BOM = '\u{FEFF}';

const RISK_LABELS: Record<string, string> = {
  critico: 'Crítico (>15% total)',
  alto: 'Alto (7-15% total)',
  medio: 'Medio (3-7% total)',
  estandar: 'Estándar (<3% total)',
};

/**
 * Exporta el análisis de concentración y ranking de clientes a CSV.
 */
export function concentrationToCsv(result: ConcentrationAnalysisResult): string {
  const lines: string[] = [];

  // 1. Resumen de Concentración y Riesgo
  lines.push('--- ÍNDICES DE CONCENTRACIÓN Y RIESGO ---');
  lines.push(
    ['Métrica', 'Valor']
      .map(escapeField)
      .join(';'),
  );
  lines.push(`Total Clientes;${NUMBER.format(result.customerCount)}`);
  lines.push(`Facturación Total;${NUMBER.format(result.totalRevenue)}`);
  lines.push(`Coeficiente de Gini;${result.gini.toFixed(3)}`);
  lines.push(`Índice HHI;${result.hhi.toFixed(0)}`);
  lines.push(`Cuota Top 1 Cliente;${PERCENT.format(result.top1Share)} %`);
  lines.push(`Cuota Top 5 Clientes;${PERCENT.format(result.top5Share)} %`);
  lines.push(`Cuota Top 20% Clientes (Pareto);${PERCENT.format(result.top20PercentShare)} %`);
  lines.push(`Diagnóstico de Riesgo;${escapeField(result.riskDiagnosis)}`);

  lines.push('');
  lines.push('--- RANKING COMPLETO DE CLIENTES ---');
  lines.push(
    [
      'Posición',
      'Cliente',
      'Facturación',
      'Cuota Individual (%)',
      'Facturación Acumulada',
      'Cuota Acumulada (%)',
      'Nivel de Dependencia',
    ]
      .map(escapeField)
      .join(';'),
  );

  for (const c of result.allCustomers) {
    lines.push(
      [
        NUMBER.format(c.rank),
        escapeField(c.customerId),
        NUMBER.format(c.revenue),
        PERCENT.format(c.share),
        NUMBER.format(c.cumulativeRevenue),
        PERCENT.format(c.cumulativeShare),
        escapeField(RISK_LABELS[c.riskCategory] ?? c.riskCategory),
      ].join(';'),
    );
  }

  return BOM + lines.join('\r\n');
}

function escapeField(field: string): string {
  return /[;"\r\n]/.test(field) ? `"${field.replaceAll('"', '""')}"` : field;
}
