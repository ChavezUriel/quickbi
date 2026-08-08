import { useMemo, useState } from 'react';
import type { ColumnProfile } from '@/features/dataset/lib/column-types';
import type { CategorySort, ChartConfig, ChartType, DateGranularity } from './types';

export interface ChartConfigState extends ChartConfig {
  /** Tipos de gráfico coherentes con la dimensión actual. */
  availableChartTypes: ChartType[];
  setChartType: (chartType: ChartType) => void;
  setGranularity: (granularity: DateGranularity) => void;
  setSort: (sort: CategorySort) => void;
  setTopN: (topN: number | null) => void;
}

/** Por encima de 20 categorías sueltas, un gráfico deja de leerse. */
const DEFAULT_TOP_N = 20;

/**
 * Ajustes del gráfico derivados de la dimensión elegida. Como en el mapeo,
 * la elección del usuario se conserva mientras siga siendo válida y se
 * deriva a un defecto sensato cuando deja de serlo.
 */
export function useChartConfig(dimension: ColumnProfile | undefined): ChartConfigState {
  const isDate = dimension?.type === 'date';

  // Una serie temporal como sectores no dice nada; líneas y barras sí.
  const availableChartTypes = useMemo<ChartType[]>(
    () => (isDate ? ['line', 'bar'] : ['bar', 'line', 'pie']),
    [isDate],
  );

  const [selection, setSelection] = useState<{
    chartType: ChartType | null;
    granularity: DateGranularity;
    sort: CategorySort;
    topN: number | null;
  }>({
    chartType: null,
    granularity: 'day',
    sort: 'natural',
    topN: DEFAULT_TOP_N,
  });

  const chartType =
    selection.chartType !== null && availableChartTypes.includes(selection.chartType)
      ? selection.chartType
      : isDate
        ? 'line'
        : 'bar';

  return {
    chartType,
    granularity: selection.granularity,
    sort: selection.sort,
    // Plegar una serie temporal por valor la destrozaría; el top N no aplica.
    topN: isDate ? null : selection.topN,
    availableChartTypes,
    setChartType: (chartType) => setSelection((current) => ({ ...current, chartType })),
    setGranularity: (granularity) =>
      setSelection((current) => ({ ...current, granularity })),
    setSort: (sort) => setSelection((current) => ({ ...current, sort })),
    setTopN: (topN) => setSelection((current) => ({ ...current, topN })),
  };
}
