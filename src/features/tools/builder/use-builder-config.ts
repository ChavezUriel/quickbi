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
import { COUNT_COLUMN, NO_DIM, TIME_DIM, categoryAxis } from '../lib/axis';
import { toolStorageKey, usePersistedState } from '../use-persisted-state';
import type { AxisSort, PivotAxis } from '../pivot/lib/pivot';
import { SUPPORTS_SERIES, type ChartKind, type ChartSpec } from './lib/build-chart';

export { COUNT_COLUMN, NO_DIM, TIME_DIM };

const DEFAULT_MAX_CATEGORIES = 20;
const DEFAULT_MAX_SERIES = 8;

export interface BuilderSettings {
  kind: ChartKind;
  /** Eje de categorías: una dimensión o `TIME_DIM`. */
  categoryDim: string;
  dateColumn: string | null;
  grain: Granularity;
  /** Dimensión que abre series, o `NO_DIM`. */
  seriesDim: string;
  metricColumn: string;
  agg: 'sum' | 'avg';
  format: MetricFormat;
  currency: Currency;
  /** Eje Y de la dispersión. */
  metricYColumn: string;
  aggY: 'sum' | 'avg';
  maxCategories: number;
  maxSeries: number;
  sort: AxisSort;
  horizontal: boolean;
  showLegend: boolean;
  showLabels: boolean;
}

export interface BuilderConfigState {
  settings: BuilderSettings;
  update: (patch: Partial<BuilderSettings>) => void;
  dimensions: ColumnProfile[];
  measures: ColumnProfile[];
  dateColumns: ColumnProfile[];
  metric: MetricDef;
  metricY: MetricDef | null;
  /** El gráfico pedido, listo para el motor. */
  spec: ChartSpec;
  /** El eje de categorías es temporal: hay que preparar el día de cada fila. */
  usesTime: boolean;
  ready: boolean;
}

const NO_OVERRIDES: Partial<BuilderSettings> = {};

/**
 * Qué gráfico se está construyendo.
 *
 * A diferencia de las demás herramientas, aquí casi todo se toca sobre el
 * propio gráfico: la configuración solo fija el punto de partida, y por eso
 * comparte estado con el lienzo en vez de entregárselo una vez.
 */
export function useBuilderConfig(mapping: ColumnMappingState): BuilderConfigState {
  const { dimensions, measures, dateColumns } = mapping;

  const columnNames = useMemo(
    () => mapping.columns.map((column) => column.name),
    [mapping.columns],
  );

  const [overrides, setOverrides] = usePersistedState<Partial<BuilderSettings>>(
    toolStorageKey('builder', columnNames),
    NO_OVERRIDES,
  );

  const settings = useMemo<BuilderSettings>(() => {
    const dimensionNames = dimensions.map((column) => column.name);
    const measureNames = measures.map((column) => column.name);
    const dateNames = dateColumns.map((column) => column.name);

    const categoryCandidates = [
      ...dimensionNames,
      ...(dateNames.length > 0 ? [TIME_DIM] : []),
    ];

    // Con fecha, lo primero que quiere ver cualquiera es la evolución.
    const defaultCategory =
      dateNames.length > 0 ? TIME_DIM : (dimensionNames[0] ?? NO_DIM);
    const categoryDim = pick(
      overrides.categoryDim,
      categoryCandidates,
      defaultCategory,
    );

    const seriesCandidates = [
      ...dimensionNames.filter((name) => name !== categoryDim),
      NO_DIM,
    ];

    const kind = pick(overrides.kind, KINDS, dateNames.length > 0 ? 'lineas' : 'barras');

    return {
      kind: kind as ChartKind,
      categoryDim,
      dateColumn: pickNullable(
        overrides.dateColumn ?? undefined,
        dateNames,
        dateNames[0] ?? null,
      ),
      grain: overrides.grain ?? 'mes',
      seriesDim: pick(overrides.seriesDim, seriesCandidates, NO_DIM),
      metricColumn: pick(
        overrides.metricColumn,
        [...measureNames, COUNT_COLUMN],
        measureNames[0] ?? COUNT_COLUMN,
      ),
      agg: overrides.agg ?? 'sum',
      format: overrides.format ?? 'numero',
      currency: overrides.currency ?? 'EUR',
      metricYColumn: pick(
        overrides.metricYColumn,
        [...measureNames, COUNT_COLUMN],
        measureNames[1] ?? measureNames[0] ?? COUNT_COLUMN,
      ),
      aggY: overrides.aggY ?? 'sum',
      maxCategories: overrides.maxCategories ?? DEFAULT_MAX_CATEGORIES,
      maxSeries: overrides.maxSeries ?? DEFAULT_MAX_SERIES,
      sort: overrides.sort ?? 'total',
      horizontal: overrides.horizontal ?? false,
      showLegend: overrides.showLegend ?? true,
      showLabels: overrides.showLabels ?? false,
    };
  }, [overrides, dimensions, measures, dateColumns]);

  const metric = useMemo<MetricDef>(
    () =>
      settings.metricColumn === COUNT_COLUMN
        ? countMetric()
        : columnMetric(settings.metricColumn, settings.agg, settings.format),
    [settings.metricColumn, settings.agg, settings.format],
  );

  const metricY = useMemo<MetricDef | null>(() => {
    if (settings.kind !== 'dispersion') return null;
    return settings.metricYColumn === COUNT_COLUMN
      ? countMetric()
      : columnMetric(settings.metricYColumn, settings.aggY, settings.format);
  }, [settings.kind, settings.metricYColumn, settings.aggY, settings.format]);

  const spec = useMemo<ChartSpec>(() => {
    const category: PivotAxis = categoryAxis({
      dim: settings.categoryDim,
      grain: settings.grain,
      sort: settings.sort,
      max: settings.maxCategories,
    });

    const series =
      settings.seriesDim === NO_DIM || !SUPPORTS_SERIES[settings.kind]
        ? null
        : categoryAxis({
            dim: settings.seriesDim,
            grain: settings.grain,
            sort: 'total',
            max: settings.maxSeries,
          });

    return { kind: settings.kind, category, series, metric, metricY };
  }, [settings, metric, metricY]);

  const update = useCallback(
    (patch: Partial<BuilderSettings>) => {
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
    metricY,
    spec,
    usesTime: settings.categoryDim === TIME_DIM,
    // Sin eje de categorías no hay gráfico que dibujar: hace falta una
    // dimensión o una fecha.
    ready: settings.categoryDim !== NO_DIM,
  };
}

const KINDS: ChartKind[] = [
  'barras',
  'barras_apiladas',
  'lineas',
  'area',
  'circular',
  'dispersion',
];

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
