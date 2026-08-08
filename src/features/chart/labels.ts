import type { CategorySort, ChartType, DateGranularity } from './types';

export const CHART_TYPE_LABEL: Record<ChartType, string> = {
  bar: 'Barras',
  line: 'Líneas',
  pie: 'Sectores',
};

export const GRANULARITY_LABEL: Record<DateGranularity, string> = {
  day: 'Día',
  week: 'Semana',
  month: 'Mes',
  quarter: 'Trimestre',
  year: 'Año',
};

export const SORT_LABEL: Record<CategorySort, string> = {
  natural: 'Orden natural',
  'value-desc': 'Mayor valor primero',
  'value-asc': 'Menor valor primero',
};

export const SORTS: CategorySort[] = ['natural', 'value-desc', 'value-asc'];

/** Opciones de top N; `null` se presenta como «Todas». */
export const TOP_N_OPTIONS: (number | null)[] = [5, 10, 20, 50, null];

export function topNLabel(topN: number | null): string {
  return topN === null ? 'Todas' : `Primeras ${topN}`;
}
