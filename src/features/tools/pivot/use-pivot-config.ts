import { useCallback, useMemo } from 'react';
import { columnMetric, countMetric } from '@/features/analysis/lib/metrics';
import type {
  Currency,
  Granularity,
  MetricDef,
  MetricFormat,
} from '@/features/analysis/types';
import type { ColumnProfile } from '@/features/dataset/lib/column-types';
import type { ColumnMappingState } from '@/features/mapping/use-column-mapping';
import { COUNT_COLUMN, NO_DIM, TIME_DIM } from '../lib/axis';
import { toolStorageKey, usePersistedState } from '../use-persisted-state';
import type { AxisSort } from './lib/pivot';

// Los ejes son los mismos que usa el constructor de gráficos: se reexportan
// para que los componentes de la tabla no tengan que saber de dónde salen.
export { COUNT_COLUMN, NO_DIM, TIME_DIM } from '../lib/axis';

/** Techo por defecto de cada eje: más allá la tabla deja de leerse. */
const DEFAULT_MAX_ROWS = 50;
const DEFAULT_MAX_COLS = 16;

export interface PivotSettings {
  rowDim: string;
  /** Nombre de dimensión, `TIME_DIM` o `NO_DIM`. */
  colDim: string;
  /** Columna numérica, o `COUNT_COLUMN` para contar filas. */
  metricColumn: string;
  agg: 'sum' | 'avg';
  format: MetricFormat;
  currency: Currency;
  dateColumn: string | null;
  grain: Granularity;
  maxRows: number;
  maxCols: number;
  sort: AxisSort;
  showTotals: boolean;
  heatmap: boolean;
}

export interface PivotConfigState {
  settings: PivotSettings;
  update: (patch: Partial<PivotSettings>) => void;
  dimensions: ColumnProfile[];
  measures: ColumnProfile[];
  dateColumns: ColumnProfile[];
  /** La métrica ya construida, lista para el motor. */
  metric: MetricDef;
  /** Hay al menos una dimensión por la que abrir filas. */
  ready: boolean;
}

const NO_OVERRIDES: Partial<PivotSettings> = {};

/**
 * Qué cruza la tabla dinámica.
 *
 * Las decisiones se guardan por esquema de columnas: volver a cargar el
 * informe del mes siguiente reencuentra la misma tabla montada.
 */
export function usePivotConfig(mapping: ColumnMappingState): PivotConfigState {
  const { dimensions, measures, dateColumns } = mapping;

  const columnNames = useMemo(
    () => mapping.columns.map((column) => column.name),
    [mapping.columns],
  );

  const [overrides, setOverrides] = usePersistedState<Partial<PivotSettings>>(
    toolStorageKey('pivot', columnNames),
    NO_OVERRIDES,
  );

  const settings = useMemo<PivotSettings>(() => {
    const dimensionNames = dimensions.map((column) => column.name);
    const measureNames = measures.map((column) => column.name);
    const dateNames = dateColumns.map((column) => column.name);

    const rowDim = pick(overrides.rowDim, dimensionNames, dimensionNames[0] ?? '');

    // La segunda dimensión no puede ser la misma que la primera: una tabla
    // cruzada consigo misma es una diagonal.
    const defaultCol =
      dateNames.length > 0
        ? TIME_DIM
        : (dimensionNames.find((name) => name !== rowDim) ?? NO_DIM);

    const colCandidates = [
      ...dimensionNames.filter((name) => name !== rowDim),
      ...(dateNames.length > 0 ? [TIME_DIM] : []),
      NO_DIM,
    ];

    return {
      rowDim,
      colDim: pick(overrides.colDim, colCandidates, defaultCol),
      metricColumn: pick(
        overrides.metricColumn,
        [...measureNames, COUNT_COLUMN],
        measureNames[0] ?? COUNT_COLUMN,
      ),
      agg: overrides.agg ?? 'sum',
      format: overrides.format ?? 'numero',
      currency: overrides.currency ?? 'EUR',
      dateColumn: pickNullable(
        overrides.dateColumn ?? undefined,
        dateNames,
        dateNames[0] ?? null,
      ),
      grain: overrides.grain ?? 'mes',
      maxRows: overrides.maxRows ?? DEFAULT_MAX_ROWS,
      maxCols: overrides.maxCols ?? DEFAULT_MAX_COLS,
      sort: overrides.sort ?? 'total',
      showTotals: overrides.showTotals ?? true,
      heatmap: overrides.heatmap ?? true,
    };
  }, [overrides, dimensions, measures, dateColumns]);

  const metric = useMemo<MetricDef>(
    () =>
      settings.metricColumn === COUNT_COLUMN
        ? countMetric()
        : columnMetric(settings.metricColumn, settings.agg, settings.format),
    [settings.metricColumn, settings.agg, settings.format],
  );

  const update = useCallback(
    (patch: Partial<PivotSettings>) => {
      setOverrides((current) => ({ ...current, ...patch }));
    },
    [setOverrides],
  );

  return {
    settings,
    update,
    dimensions,
    measures,
    dateColumns,
    metric,
    ready: dimensions.length > 0,
  };
}

/**
 * Valor guardado si sigue siendo posible; si no, el propuesto por defecto.
 *
 * Lo guardado caduca solo: cambiar el tipo de una columna en el paso anterior
 * puede dejar la tabla apuntando a una dimensión que ya no existe, y es mejor
 * caer en un valor razonable que en una tabla vacía sin explicación.
 */
function pick(
  saved: string | undefined,
  allowed: readonly string[],
  fallback: string,
): string {
  return saved !== undefined && allowed.includes(saved) ? saved : fallback;
}

function pickNullable(
  saved: string | undefined,
  allowed: readonly string[],
  fallback: string | null,
): string | null {
  return saved !== undefined && allowed.includes(saved) ? saved : fallback;
}
