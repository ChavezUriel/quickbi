import type {
  ComparisonMode,
  Currency,
  Granularity,
  MetricAgg,
  MetricFormat,
} from './types';

export const GRANULARITY_LABEL: Record<Granularity, string> = {
  dia: 'Día',
  semana: 'Semana',
  mes: 'Mes',
  trimestre: 'Trimestre',
  anio: 'Año',
};

/** Granos ofrecidos en la barra de filtros; el año se reserva a los presets. */
export const GRANULARITIES: Granularity[] = ['dia', 'semana', 'mes', 'trimestre'];

export const COMPARISON_LABEL: Record<ComparisonMode, string> = {
  anterior: 'Período anterior',
  anio_anterior: 'Mismo período del año anterior',
  personalizada: 'Rango personalizado',
  ninguna: 'Sin comparación',
};

export const COMPARISONS: ComparisonMode[] = [
  'anterior',
  'anio_anterior',
  'personalizada',
  'ninguna',
];

export const METRIC_AGG_LABEL: Record<MetricAgg, string> = {
  sum: 'Suma',
  avg: 'Media',
  count: 'Recuento',
};

export const METRIC_FORMAT_LABEL: Record<MetricFormat, string> = {
  numero: 'Número',
  moneda: 'Moneda',
  porcentaje: 'Porcentaje',
};

export const METRIC_FORMATS: MetricFormat[] = ['numero', 'moneda', 'porcentaje'];

export const CURRENCY_LABEL: Record<Currency, string> = {
  EUR: 'Euro (€)',
  USD: 'Dólar (US$)',
  MXN: 'Peso mexicano (MX$)',
};

export const CURRENCIES: Currency[] = ['EUR', 'USD', 'MXN'];

/** Presets del rango de fechas. `null` es «todo el histórico». */
export interface RangePreset {
  id: string;
  label: string;
  n: number;
  unit: Granularity;
}

export const RANGE_PRESETS: RangePreset[] = [
  { id: '7d', label: 'Últimos 7 días', n: 7, unit: 'dia' },
  { id: '30d', label: 'Últimos 30 días', n: 30, unit: 'dia' },
  { id: '3m', label: 'Últimos 3 meses', n: 3, unit: 'mes' },
  { id: '6m', label: 'Últimos 6 meses', n: 6, unit: 'mes' },
  { id: '12m', label: 'Últimos 12 meses', n: 12, unit: 'mes' },
  { id: '3a', label: 'Últimos 3 años', n: 3, unit: 'anio' },
];

export const RANGE_PRESETS_BY_ID: Record<string, RangePreset> = Object.fromEntries(
  RANGE_PRESETS.map((preset) => [preset.id, preset]),
);

export const RANGE_ALL = '__todo__';
export const RANGE_CUSTOM = '__personalizado__';

/** Preset por defecto, el mismo que trae la sección al abrirse. */
export const DEFAULT_RANGE = RANGE_PRESETS[2] as RangePreset;
