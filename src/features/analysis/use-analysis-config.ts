import { useCallback, useMemo, useState } from 'react';
import type { ColumnProfile } from '@/features/dataset/lib/column-types';
import type { ColumnMappingState } from '@/features/mapping/use-column-mapping';
import { columnMetric, countMetric } from './lib/metrics';
import type { AnalysisConfig, Currency, MetricFormat } from './types';

/** Dimensiones propuestas por defecto; el resto se activa a mano. */
const DEFAULT_DIMENSIONS = 8;

/** Por encima de esto una columna es más un identificador que una categoría. */
const MAX_DEFAULT_CARDINALITY = 100;

const DEFAULT_METRICS = 6;

export interface MetricSetting {
  enabled: boolean;
  agg: 'sum' | 'avg';
  format: MetricFormat;
}

export interface AnalysisConfigState {
  config: AnalysisConfig;
  dateColumns: ColumnProfile[];
  dimensionColumns: ColumnProfile[];
  measureColumns: ColumnProfile[];
  /** Ajuste efectivo de cada columna numérica, con los defaults ya aplicados. */
  metricSettings: Record<string, MetricSetting>;
  /** `true` si alguna métrica se muestra como moneda: solo entonces importa cuál. */
  usesCurrency: boolean;
  setDateColumn: (name: string | null) => void;
  toggleDimension: (name: string) => void;
  setMetricEnabled: (column: string, enabled: boolean) => void;
  setMetricSetting: (column: string, patch: Partial<MetricSetting>) => void;
  setCurrency: (currency: Currency) => void;
}

/**
 * Qué columnas alimentan el cuadro de mando.
 *
 * Igual que el mapeo de tipos, la configuración se **deriva** de las columnas
 * en cada render y solo se guardan las decisiones explícitas del usuario: si
 * corrige el tipo de una columna en el paso 2, las dimensiones y métricas
 * disponibles se ajustan solas, sin reconciliar estado en un efecto.
 */
export function useAnalysisConfig(mapping: ColumnMappingState): AnalysisConfigState {
  const { dimensions: dimensionColumns, measures: measureColumns, dateColumns } = mapping;

  const [dateOverride, setDateOverride] = useState<string | null | undefined>(undefined);
  const [dimensionOverride, setDimensionOverride] = useState<string[] | undefined>(undefined);
  const [metricOverrides, setMetricOverrides] = useState<
    Record<string, Partial<MetricSetting>>
  >({});
  const [currency, setCurrency] = useState<Currency>('EUR');

  const dateColumn = useMemo<string | null>(() => {
    // `null` es una elección explícita («sin eje temporal»); `undefined`, que
    // el usuario aún no ha tocado nada y vale la primera columna de fecha.
    if (dateOverride === null) return null;
    if (dateOverride !== undefined && dateColumns.some((c) => c.name === dateOverride)) {
      return dateOverride;
    }
    return dateColumns[0]?.name ?? null;
  }, [dateOverride, dateColumns]);

  const dimensions = useMemo<string[]>(() => {
    if (dimensionOverride !== undefined) {
      return dimensionOverride.filter((name) =>
        dimensionColumns.some((column) => column.name === name),
      );
    }

    const usable = dimensionColumns.filter(
      (column) => column.distinctCount <= MAX_DEFAULT_CARDINALITY,
    );
    const proposed = usable.length > 0 ? usable : dimensionColumns;

    return proposed.slice(0, DEFAULT_DIMENSIONS).map((column) => column.name);
  }, [dimensionOverride, dimensionColumns]);

  const metricSettings = useMemo<Record<string, MetricSetting>>(() => {
    const settings: Record<string, MetricSetting> = {};

    measureColumns.forEach((column, index) => {
      const override = metricOverrides[column.name];
      settings[column.name] = {
        enabled: override?.enabled ?? index < DEFAULT_METRICS,
        agg: override?.agg ?? 'sum',
        format: override?.format ?? 'numero',
      };
    });

    return settings;
  }, [measureColumns, metricOverrides]);

  const config = useMemo<AnalysisConfig>(() => {
    const metrics = measureColumns
      .filter((column) => metricSettings[column.name]?.enabled === true)
      .map((column) => {
        const setting = metricSettings[column.name];
        return columnMetric(column.name, setting?.agg ?? 'sum', setting?.format ?? 'numero');
      });

    // El recuento de filas va siempre al final: es el plan B cuando no hay
    // ninguna columna numérica, no la métrica que se quiere ver primero.
    return { dateColumn, dimensions, metrics: [...metrics, countMetric()], currency };
  }, [measureColumns, metricSettings, dateColumn, dimensions, currency]);

  const toggleDimension = useCallback(
    (name: string) => {
      setDimensionOverride((current) => {
        const base = current ?? dimensions;
        return base.includes(name)
          ? base.filter((item) => item !== name)
          : [...base, name];
      });
    },
    [dimensions],
  );

  const setMetricSetting = useCallback((column: string, patch: Partial<MetricSetting>) => {
    setMetricOverrides((current) => ({
      ...current,
      [column]: { ...current[column], ...patch },
    }));
  }, []);

  const setMetricEnabled = useCallback(
    (column: string, enabled: boolean) => {
      setMetricSetting(column, { enabled });
    },
    [setMetricSetting],
  );

  return {
    config,
    dateColumns,
    dimensionColumns,
    measureColumns,
    metricSettings,
    usesCurrency: config.metrics.some((metric) => metric.format === 'moneda'),
    setDateColumn: setDateOverride,
    toggleDimension,
    setMetricEnabled,
    setMetricSetting,
    setCurrency,
  };
}
