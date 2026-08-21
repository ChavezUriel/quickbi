import type { FunnelResult } from './funnel';

const NUMBER = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 });
const PERCENT = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 });

/** BOM de UTF-8: sin él Excel abre el fichero como ANSI y rompe las tildes. */
const BOM = '\u{FEFF}';

const HEADER = [
  'Orden',
  'Etapa',
  'Volumen',
  '% Sobre Inicio',
  '% Retención de Paso',
  'Pérdida (Drop-off)',
  'Tasa de Caída %',
  'Cuello de Botella',
];

/**
 * Exporta el embudo de conversión a CSV listo para Excel y hojas de cálculo.
 */
export function funnelToCsv(result: FunnelResult): string {
  const lines = [
    HEADER.map(escapeField).join(';'),
    ...result.stages.map((stage) =>
      [
        String(stage.order + 1),
        escapeField(stage.stage),
        NUMBER.format(stage.volume),
        `${PERCENT.format(stage.conversionFromTop)} %`,
        `${PERCENT.format(stage.stepConversionRate)} %`,
        NUMBER.format(stage.dropOff),
        `${PERCENT.format(stage.dropOffRate)} %`,
        stage.isBottleneck ? 'SÍ (Mayor Caída)' : 'No',
      ].join(';'),
    ),
  ];

  return BOM + lines.join('\r\n');
}

function escapeField(field: string): string {
  return /[;"\r\n]/.test(field) ? `"${field.replaceAll('"', '""')}"` : field;
}
