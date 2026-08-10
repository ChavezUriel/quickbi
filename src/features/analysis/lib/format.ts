import type { Currency, MetricFormat } from '../types';

/**
 * Formateo de las cifras del cuadro de mando.
 *
 * Los `Intl.NumberFormat` se cachean porque construirlos es caro y aquí se
 * llaman miles de veces: una tabla de 500 filas por columna, en cada clic.
 */
const cache = new Map<string, Intl.NumberFormat>();

function formatter(key: string, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const existing = cache.get(key);
  if (existing !== undefined) return existing;

  const created = new Intl.NumberFormat('es-ES', options);
  cache.set(key, created);
  return created;
}

export interface FormatOptions {
  format: MetricFormat;
  currency: Currency;
  /** Notación compacta (`1,2 M`), para ejes y celdas estrechas. */
  compact?: boolean;
}

export function formatMetric(value: number | null, options: FormatOptions): string {
  if (value === null || !Number.isFinite(value)) return '—';

  const { format, currency, compact = false } = options;
  const notation = compact ? 'compact' : 'standard';
  const key = `${format}:${currency}:${notation}`;

  switch (format) {
    case 'moneda':
      return formatter(key, {
        style: 'currency',
        currency,
        notation,
        maximumFractionDigits: compact ? 1 : 2,
      }).format(value);
    case 'porcentaje':
      return `${formatter(key, {
        notation,
        maximumFractionDigits: compact ? 1 : 2,
      }).format(value)} %`;
    case 'numero':
      return formatter(key, {
        notation,
        maximumFractionDigits: compact ? 1 : 2,
      }).format(value);
  }
}

const DELTA = new Intl.NumberFormat('es-ES', {
  maximumFractionDigits: 1,
  signDisplay: 'exceptZero',
});

/** Variación porcentual con signo. `null` es «sin base de comparación». */
export function formatDelta(delta: number | null): string {
  if (delta === null || !Number.isFinite(delta)) return 'n/d';
  return `${DELTA.format(delta)} %`;
}

const SHARE = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 });

export function formatShare(share: number | null): string {
  if (share === null || !Number.isFinite(share)) return '—';
  return `${SHARE.format(share)} %`;
}

/**
 * Mayor variación absoluta de un conjunto: es el 100 % de la escala de color
 * de las insignias, que es relativa a lo que se ve y no al dataset entero.
 */
export function deltaScale(values: readonly (number | null)[]): number {
  return values.reduce<number>(
    (max, value) =>
      value === null || !Number.isFinite(value) ? max : Math.max(max, Math.abs(value)),
    0,
  );
}

const INTEGER = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 });

export function formatCount(value: number): string {
  return INTEGER.format(value);
}
