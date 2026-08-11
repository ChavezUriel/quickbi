import { useCallback, useEffect, useMemo, useState } from 'react';
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

export interface SavedAnalysisConfig {
  dateOverride?: string | null;
  dimensionOverride?: string[];
  dimensionOrderOverride?: string[];
  metricOverrides?: Record<string, Partial<MetricSetting>>;
  metricOrderOverride?: string[];
  currency?: Currency;
}

export interface AnalysisConfigState {
  config: AnalysisConfig;
  dateColumns: ColumnProfile[];
  dimensionColumns: ColumnProfile[];
  measureColumns: ColumnProfile[];
  /** Orden efectivo de las columnas de dimensión. */
  dimensionOrder: string[];
  /** Orden efectivo de las columnas numéricas, incluyendo las desactivadas. */
  metricOrder: string[];
  /** Ajuste efectivo de cada columna numérica, con los defaults ya aplicados. */
  metricSettings: Record<string, MetricSetting>;
  /** `true` si alguna métrica se muestra como moneda: solo entonces importa cuál. */
  usesCurrency: boolean;
  setDateColumn: (name: string | null) => void;
  toggleDimension: (name: string) => void;
  moveDimension: (name: string, beforeName: string) => void;
  setMetricEnabled: (column: string, enabled: boolean) => void;
  setMetricSetting: (column: string, patch: Partial<MetricSetting>) => void;
  moveMetric: (name: string, beforeName: string) => void;
  setCurrency: (currency: Currency) => void;
}

function loadSavedConfig(key: string): SavedAnalysisConfig | null {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as SavedAnalysisConfig;
  } catch {
    // Ignorar errores de lectura en localStorage
  }
  return null;
}

function saveConfig(key: string, data: SavedAnalysisConfig) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // Ignorar errores de escritura en localStorage
  }
}

/**
 * Qué columnas alimentan el cuadro de mando.
 *
 * Persiste y recupera las decisiones del usuario (eje fecha, orden y selección de
 * dimensiones y métricas, agregación, formato y moneda) en `localStorage` según el esquema de columnas.
 */
export function useAnalysisConfig(mapping: ColumnMappingState): AnalysisConfigState {
  const { dimensions: dimensionColumns, measures: measureColumns, dateColumns } = mapping;

  const schemaKey = useMemo(() => {
    const allColNames = [
      ...dateColumns.map((c) => c.name),
      ...dimensionColumns.map((c) => c.name),
      ...measureColumns.map((c) => c.name),
    ].sort();
    return `quickbi_analysis_cfg_${allColNames.join('__')}`;
  }, [dateColumns, dimensionColumns, measureColumns]);

  const initialSaved = useMemo(() => loadSavedConfig(schemaKey), [schemaKey]);

  const [dateOverride, setDateOverride] = useState<string | null | undefined>(
    initialSaved?.dateOverride,
  );
  const [dimensionOverride, setDimensionOverride] = useState<string[] | undefined>(
    initialSaved?.dimensionOverride,
  );
  const [dimensionOrderOverride, setDimensionOrderOverride] = useState<string[] | undefined>(
    initialSaved?.dimensionOrderOverride,
  );
  const [metricOverrides, setMetricOverrides] = useState<
    Record<string, Partial<MetricSetting>>
  >(initialSaved?.metricOverrides ?? {});
  const [metricOrderOverride, setMetricOrderOverride] = useState<string[] | undefined>(
    initialSaved?.metricOrderOverride,
  );
  const [currency, setCurrency] = useState<Currency>(initialSaved?.currency ?? 'EUR');

  // Sincronizar desde localStorage cuando cambie el dataset/esquema
  useEffect(() => {
    const saved = loadSavedConfig(schemaKey);
    setDateOverride(saved?.dateOverride);
    setDimensionOverride(saved?.dimensionOverride);
    setDimensionOrderOverride(saved?.dimensionOrderOverride);
    setMetricOverrides(saved?.metricOverrides ?? {});
    setMetricOrderOverride(saved?.metricOrderOverride);
    setCurrency(saved?.currency ?? 'EUR');
  }, [schemaKey]);

  // Persistir ajustes en localStorage automáticamente
  useEffect(() => {
    if (!schemaKey) return;
    saveConfig(schemaKey, {
      dateOverride,
      dimensionOverride,
      dimensionOrderOverride,
      metricOverrides,
      metricOrderOverride,
      currency,
    });
  }, [
    schemaKey,
    dateOverride,
    dimensionOverride,
    dimensionOrderOverride,
    metricOverrides,
    metricOrderOverride,
    currency,
  ]);

  const dateColumn = useMemo<string | null>(() => {
    if (dateOverride === null) return null;
    if (dateOverride !== undefined && dateColumns.some((c) => c.name === dateOverride)) {
      return dateOverride;
    }
    return dateColumns[0]?.name ?? null;
  }, [dateOverride, dateColumns]);

  const dimensionOrder = useMemo<string[]>(() => {
    const availableNames = dimensionColumns.map((column) => column.name);
    const available = new Set(availableNames);
    const configured = dimensionOrderOverride ?? [];

    return [
      ...configured.filter((name) => available.has(name)),
      ...availableNames.filter((name) => !configured.includes(name)),
    ];
  }, [dimensionColumns, dimensionOrderOverride]);

  const dimensions = useMemo<string[]>(() => {
    if (dimensionOverride !== undefined) {
      const activeSet = new Set(dimensionOverride);
      return dimensionOrder.filter(
        (name) => activeSet.has(name) && dimensionColumns.some((column) => column.name === name),
      );
    }

    const usable = dimensionColumns.filter(
      (column) => column.distinctCount <= MAX_DEFAULT_CARDINALITY,
    );
    const proposed = usable.length > 0 ? usable : dimensionColumns;
    const proposedNames = new Set(proposed.slice(0, DEFAULT_DIMENSIONS).map((c) => c.name));

    return dimensionOrder.filter((name) => proposedNames.has(name));
  }, [dimensionOverride, dimensionOrder, dimensionColumns]);

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

  const moveDimension = useCallback(
    (name: string, beforeName: string) => {
      setDimensionOrderOverride((current) => {
        const availableNames = dimensionColumns.map((column) => column.name);
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
    [dimensionColumns],
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
    dimensionOrder,
    metricOrder,
    metricSettings,
    usesCurrency: config.metrics.some((metric) => metric.format === 'moneda'),
    setDateColumn: setDateOverride,
    toggleDimension,
    moveDimension,
    setMetricEnabled,
    setMetricSetting,
    moveMetric,
    setCurrency,
  };
}
