import type { PriceVolumeResult } from './price_volume';

const NUMBER = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 });
const PERCENT = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 1 });

/** BOM de UTF-8: sin él Excel abre el fichero como ANSI y rompe las tildes. */
const BOM = '\u{FEFF}';

/**
 * Exporta el análisis de Precio vs Volumen y descomposición PVM a CSV.
 */
export function priceVolumeToCsv(result: PriceVolumeResult): string {
  const lines: string[] = [];

  // 1. Resumen de Elasticidad
  lines.push('--- ELASTICIDAD PRECIO DE LA DEMANDA ---');
  lines.push(
    ['Métrica', 'Valor']
      .map(escapeField)
      .join(';'),
  );
  lines.push(`Facturación Total;${NUMBER.format(result.totalRevenue)}`);
  lines.push(`Volumen Total (Unidades);${NUMBER.format(result.totalVolume)}`);
  lines.push(`Precio Medio Realizado;${NUMBER.format(result.avgRealizedPrice)}`);
  lines.push(
    `Elasticidad Precio (PED);${result.elasticity !== null ? NUMBER.format(result.elasticity) : '—'}`,
  );
  lines.push(`Tipo de Demanda;${escapeField(result.elasticityLabel)}`);
  lines.push(`R² (Bondad de ajuste);${result.rSquared !== null ? PERCENT.format(result.rSquared * 100) + ' %' : '—'}`);
  lines.push(`Diagnóstico;${escapeField(result.elasticityDiagnosis)}`);

  // 2. Descomposición PVM (si existe comparación temporal)
  if (result.pvm !== null) {
    lines.push('');
    lines.push('--- DESCOMPOSICIÓN PRECIO-VOLUMEN-MIX (PVM) ---');
    lines.push(
      [
        'Producto',
        'Facturación Inicial',
        'Facturación Reciente',
        'Variación Neta',
        'Efecto Precio',
        'Efecto Volumen',
        'Efecto Mix',
      ]
        .map(escapeField)
        .join(';'),
    );

    lines.push(
      [
        'TOTAL CARTERA',
        NUMBER.format(result.pvm.revenue0),
        NUMBER.format(result.pvm.revenue1),
        NUMBER.format(result.pvm.deltaRevenue),
        NUMBER.format(result.pvm.priceEffect),
        NUMBER.format(result.pvm.volumeEffect),
        NUMBER.format(result.pvm.mixEffect),
      ].join(';'),
    );

    for (const p of result.pvm.products) {
      lines.push(
        [
          escapeField(p.product),
          NUMBER.format(p.revenue0),
          NUMBER.format(p.revenue1),
          NUMBER.format(p.deltaRevenue),
          NUMBER.format(p.priceEffect),
          NUMBER.format(p.volumeEffect),
          NUMBER.format(p.mixEffect),
        ].join(';'),
      );
    }
  }

  // 3. Detalle por Producto
  lines.push('');
  lines.push('--- DETALLE DE PRECIO Y VOLUMEN POR PRODUCTO ---');
  lines.push(
    [
      'Producto',
      'Volumen (Unidades)',
      'Precio Medio Unitario',
      'Facturación Total',
      'Cuota de Facturación (%)',
    ]
      .map(escapeField)
      .join(';'),
  );

  for (const pt of result.points) {
    const share = result.totalRevenue > 0 ? (pt.revenue / result.totalRevenue) * 100 : 0;
    lines.push(
      [
        escapeField(pt.name),
        NUMBER.format(pt.volume),
        NUMBER.format(pt.price),
        NUMBER.format(pt.revenue),
        PERCENT.format(share),
      ].join(';'),
    );
  }

  return BOM + lines.join('\r\n');
}

function escapeField(field: string): string {
  return /[;"\r\n]/.test(field) ? `"${field.replaceAll('"', '""')}"` : field;
}
