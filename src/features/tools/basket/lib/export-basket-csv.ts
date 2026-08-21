import type { BasketAnalysisResult } from './basket';

const NUMBER = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 });
const PERCENT = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 1 });

/** BOM de UTF-8: sin él Excel abre el fichero como ANSI y rompe las tildes. */
const BOM = '\u{FEFF}';

/**
 * Exporta las reglas de asociación y productos frecuentes a CSV.
 */
export function basketToCsv(result: BasketAnalysisResult): string {
  const lines: string[] = [];

  // 1. Reglas de Asociación (Cross-sell)
  lines.push('--- REGLAS DE ASOCIACIÓN (VENTA CRUZADA) ---');
  lines.push(
    [
      'Si compra (Antecedente)',
      'También compra (Consecuente)',
      'Cestas conjuntas',
      'Soporte (%)',
      'Confianza (%)',
      'Confianza Esperada (%)',
      'Lift',
      'Impacto / Efecto',
    ]
      .map(escapeField)
      .join(';'),
  );

  for (const r of result.rules) {
    const impact =
      r.lift > 1.5
        ? 'Muy alta afinidad'
        : r.lift > 1.0
          ? 'Asociación positiva'
          : r.lift === 1.0
            ? 'Independiente'
            : 'Sustituto / Afinidad negativa';

    lines.push(
      [
        escapeField(r.antecedent),
        escapeField(r.consequent),
        NUMBER.format(r.supportCount),
        PERCENT.format(r.support * 100),
        PERCENT.format(r.confidence * 100),
        PERCENT.format(r.expectedConfidence * 100),
        NUMBER.format(r.lift),
        escapeField(impact),
      ].join(';'),
    );
  }

  lines.push('');
  lines.push('--- FRECUENCIA DE PRODUCTOS ---');
  lines.push(
    ['Producto', 'Cestas en que aparece', 'Penetración / Soporte (%)', 'Cantidad Total']
      .map(escapeField)
      .join(';'),
  );

  for (const item of result.items) {
    lines.push(
      [
        escapeField(item.item),
        NUMBER.format(item.count),
        PERCENT.format(item.support * 100),
        NUMBER.format(item.totalQuantity),
      ].join(';'),
    );
  }

  return BOM + lines.join('\r\n');
}

function escapeField(field: string): string {
  return /[;"\r\n]/.test(field) ? `"${field.replaceAll('"', '""')}"` : field;
}
