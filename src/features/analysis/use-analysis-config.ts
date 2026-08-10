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
  /** Orden efectivo de las columnas numéricas, incluyendo las desactivadas. */
  metricOrder: string[];
  /** Ajuste efectivo de cada columna numérica, con los defaults ya aplicados. */
  metricSettings: Record<string, MetricSetting>;
  /** `true` si alguna métrica se muestra como moneda: solo entonces importa cuál. */
  usesCurrency: boolean;
  setDateColumn: (name: string | null) => void;
  toggleDimension: (name: string) => void;
  setMetricEnabled: (column: string, enabled: boolean) => void;
  setMetricSetting: (column: string, patch: Partial<MetricSetting>) => void;
  moveMetric: (name: string, beforeName: string) => void;
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
  const [metricOrderOverride, setMetricOrderOverride] = useState<string[] | undefined>(undefined);
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

  const metricOrder = useMemo<string[]>(() => {
    const availableNames = measureColumns.map((column) => column.name);
    const available = new Set(availableNames);
    const configured = metricOrderOverride ?? [];

    // Keep an order override useful when a column changes type or new columns
    // appear: discard names that are no longer measures, then append new ones
    // in their dataset order.
    return [
      ...configured.filter((name) => available.has(name)),
      ...availableNames.filter((name) => !configured.includes(name)),
    ];
  }, [measureColumns, metricOrderOverride]);

  const config = useMemo<AnalysisConfig>(() => {
    const metrics = metricOrder
      .filter((name) => metricSettings[name]?.enabled === true)
      .map((name) => {
        const setting = metricSettings[name];
        return columnMetric(name, setting?.agg ?? 'sum', setting?.format ?? 'numero');
      });

    // El recuento de filas va siempre al final: es el plan B cuando no hay
    // ninguna columna numérica, no la métrica que se quiere ver primero.
    return { dateColumn, dimensions, metrics: [...metrics, countMetric()], currency };
  }, [metricOrder, metricSettings, dateColumn, dimensions, currency]);

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

  const moveMetric = useCallback(
    (name: string, beforeName: string) => {
      setMetricOrderOverride((current) => {
        const availableNames = measureColumns.map((column) => column.name);
        const available = new Set(availableNames);
        const configured = current ?? [];
        const order = [
          ...configured.filter((item) => available.has(item)),
          ...availableNames.filter((item) => !configured.includes(item)),
        ];
        const fromIndex = order.indexOf(name);
        const targetIndex = order.indexOf(beforeName);

        if (fromIndex < 0 || targetIndex < 0 || fromIndex === targetIndex) return order;

        const next = order.filter((item) => item !== name);
        const insertionIndex = next.indexOf(beforeName);
        next.splice(insertionIndex, 0, name);
        return next;
      });
    },
    [measureColumns],
  );

  return {
    config,
    dateColumns,
    dimensionColumns,
    measureColumns,
    metricOrder,
    metricSettings,
    usesCurrency: config.metrics.some((metric) => metric.format === 'moneda'),
    setDateColumn: setDateOverride,
    toggleDimension,
    setMetricEnabled,
    setMetricSetting,
    moveMetric,
    setCurrency,
  };
}
