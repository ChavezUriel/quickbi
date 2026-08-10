import { useCallback, useMemo, useState } from 'react';
import {
  DEFAULT_RANGE,
  RANGE_ALL,
  RANGE_CUSTOM,
  RANGE_PRESETS,
} from './labels';
import { autoGranularity } from './lib/dates';
import { computeExploration, resolveWindows } from './lib/explore';
import {
  clearSelections,
  EMPTY_FILTERS,
  getDateCondition,
  getSelected,
  lastPeriods,
  selectSingle,
  setDateCondition,
  setSelected,
  toggleSelected,
  withoutColumn,
  type DateCondition,
} from './lib/filters';
import { countMetric, findMetric } from './lib/metrics';
import type { PreparedData } from './lib/prepare-rows';
import {
  TOTAL_DIM,
  type AnalysisConfig,
  type ComparisonMode,
  type DateWindow,
  type ExplorationResult,
  type FilterSet,
  type Granularity,
  type MetricDef,
} from './types';

/** Widgets que pueden emitir un filtro cruzado. */
export type WidgetId = 'serie' | 'movimientos' | 'tabla';

export interface ExplorationState {
  dim: string;
  setDim: (dim: string) => void;
  metric: MetricDef;
  setMetricId: (id: string) => void;

  filters: FilterSet;
  /** Id del preset temporal activo (`3m`, `__todo__`, `__personalizado__`). */
  rangeId: string;
  setRange: (id: string) => void;
  customRange: DateWindow | null;
  setCustomRange: (window: DateWindow) => void;
  comparison: ComparisonMode;
  setComparison: (comparison: ComparisonMode) => void;
  customPrevious: DateWindow | null;
  setCustomPrevious: (window: DateWindow) => void;
  granoChoice: 'auto' | Granularity;
  setGranoChoice: (grano: 'auto' | Granularity) => void;

  window: DateWindow | null;
  previousWindow: DateWindow | null;
  grano: Granularity;
  hasDateAxis: boolean;
  bounds: DateWindow | null;

  /** Resultado con todos los filtros aplicados: el que ven los receptores. */
  result: ExplorationResult;
  /** Valores seleccionados de la dimensión activa. */
  selected: string[];
  setDimensionFilter: (column: string, values: string[]) => void;
  clearFilters: () => void;
  /** Widget que originó la selección: se ve entero, con lo elegido resaltado. */
  isEmitter: (widget: WidgetId) => boolean;
  resultFor: (widget: WidgetId) => ExplorationResult;
  select: (widget: WidgetId, name: string, additive: boolean) => void;
}

/**
 * Orquesta la sección: mantiene el conjunto de filtros compartido, recuerda
 * qué widget originó la selección y reparte los resultados.
 *
 * La pieza no obvia es que hay **dos** cálculos, no uno: el widget emisor
 * necesita seguir viendo todas sus categorías para poder cambiar la selección,
 * así que recibe el resultado calculado sin el filtro de su propia dimensión.
 */
export function useExploration(
  prepared: PreparedData,
  config: AnalysisConfig,
): ExplorationState {
  const [dimOverride, setDimOverride] = useState<string | undefined>(undefined);
  const [metricOverride, setMetricOverride] = useState<string | undefined>(undefined);
  const [selections, setSelections] = useState<FilterSet>(EMPTY_FILTERS);
  const [dateCondition, setDateConditionState] = useState<DateCondition | null | undefined>(
    undefined,
  );
  const [comparison, setComparison] = useState<ComparisonMode>('anterior');
  const [customPrevious, setCustomPrevious] = useState<DateWindow | null>(null);
  const [granoChoice, setGranoChoice] = useState<'auto' | Granularity>('auto');
  const [emitter, setEmitter] = useState<WidgetId | null>(null);

  const dateColumn = config.dateColumn;

  const dim = useMemo(() => {
    if (dimOverride === TOTAL_DIM) return TOTAL_DIM;
    if (dimOverride !== undefined && config.dimensions.includes(dimOverride)) {
      return dimOverride;
    }
    return config.dimensions[0] ?? TOTAL_DIM;
  }, [dimOverride, config.dimensions]);

  const metric = useMemo(
    () =>
      findMetric(config.metrics, metricOverride ?? null) ??
      config.metrics[0] ??
      // La configuración siempre incluye el recuento de filas, pero el tipo
      // no puede saberlo: sin este respaldo no habría métrica que mostrar.
      countMetric(),
    [config.metrics, metricOverride],
  );

  // El filtro temporal vive dentro del conjunto de condiciones, como los de
  // dimensión: un único objeto describe por completo lo que se está viendo.
  const filters = useMemo<FilterSet>(() => {
    if (dateColumn === null) return selections;

    const condition =
      dateCondition === undefined
        ? lastPeriods(dateColumn, DEFAULT_RANGE.n, DEFAULT_RANGE.unit)
        : dateCondition;

    return setDateCondition(selections, condition);
  }, [selections, dateCondition, dateColumn]);

  const windows = useMemo(
    () => resolveWindows(filters, prepared.bounds, comparison, customPrevious),
    [filters, prepared.bounds, comparison, customPrevious],
  );

  const grano = useMemo<Granularity>(() => {
    if (windows.current === null) return 'mes';
    return granoChoice === 'auto' ? autoGranularity(windows.current) : granoChoice;
  }, [granoChoice, windows]);

  const result = useMemo(
    () =>
      computeExploration(prepared.rows, {
        dim,
        metric,
        filters,
        window: windows.current,
        previousWindow: windows.previous,
        grano,
      }),
    [prepared.rows, dim, metric, filters, windows, grano],
  );

  const dimColumn = dim === TOTAL_DIM ? null : dim;
  const selected = dimColumn === null ? [] : getSelected(filters, dimColumn);

  const emitterResult = useMemo(() => {
    if (dimColumn === null || selected.length === 0) return result;

    return computeExploration(prepared.rows, {
      dim,
      metric,
      filters: withoutColumn(filters, dimColumn),
      window: windows.current,
      previousWindow: windows.previous,
      grano,
    });
    // `result` entra como dependencia porque es el valor devuelto cuando no
    // hay nada seleccionado.
  }, [result, prepared.rows, dim, dimColumn, selected.length, metric, filters, windows, grano]);

  const setRange = useCallback(
    (id: string) => {
      if (dateColumn === null) return;

      if (id === RANGE_ALL) {
        setDateConditionState(null);
        return;
      }

      if (id === RANGE_CUSTOM) {
        const current = windows.current ?? prepared.bounds;
        if (current === null) return;
        setDateConditionState({ op: 'entre_fechas', column: dateColumn, ...current });
        return;
      }

      const preset = RANGE_PRESETS.find((option) => option.id === id);
      if (preset !== undefined) {
        setDateConditionState(lastPeriods(dateColumn, preset.n, preset.unit));
      }
    },
    [dateColumn, windows, prepared.bounds],
  );

  const setCustomRange = useCallback(
    (range: DateWindow) => {
      if (dateColumn === null) return;
      setDateConditionState({ op: 'entre_fechas', column: dateColumn, ...range });
    },
    [dateColumn],
  );

  const setDimensionFilter = useCallback((column: string, values: string[]) => {
    // Un filtro elegido en la barra no tiene widget emisor: se aplica a todos.
    setEmitter(null);
    setSelections((current) => setSelected(current, column, values));
  }, []);

  const clearFilters = useCallback(() => {
    setEmitter(null);
    setSelections((current) => clearSelections(current));
  }, []);

  const select = useCallback(
    (widget: WidgetId, name: string, additive: boolean) => {
      if (dimColumn === null) return;

      setEmitter(widget);
      setSelections((current) =>
        additive
          ? toggleSelected(current, dimColumn, name)
          : selectSingle(current, dimColumn, name),
      );
    },
    [dimColumn],
  );

  const isEmitter = useCallback(
    (widget: WidgetId) => emitter === widget && selected.length > 0,
    [emitter, selected.length],
  );

  const resultFor = useCallback(
    (widget: WidgetId) => (isEmitter(widget) ? emitterResult : result),
    [isEmitter, emitterResult, result],
  );

  const activeCondition = getDateCondition(filters);

  return {
    dim,
    setDim: setDimOverride,
    metric,
    setMetricId: setMetricOverride,

    filters,
    rangeId: rangeIdOf(activeCondition),
    setRange,
    customRange:
      activeCondition?.op === 'entre_fechas'
        ? { desde: activeCondition.desde, hasta: activeCondition.hasta }
        : windows.current,
    setCustomRange,
    comparison,
    setComparison,
    customPrevious,
    setCustomPrevious,
    granoChoice,
    setGranoChoice,

    window: windows.current,
    previousWindow: windows.previous,
    grano,
    hasDateAxis: dateColumn !== null && prepared.bounds !== null,
    bounds: prepared.bounds,

    result,
    selected,
    setDimensionFilter,
    clearFilters,
    isEmitter,
    resultFor,
    select,
  };
}

function rangeIdOf(condition: DateCondition | null): string {
  if (condition === null) return RANGE_ALL;
  if (condition.op === 'entre_fechas') return RANGE_CUSTOM;

  return (
    RANGE_PRESETS.find(
      (preset) => preset.n === condition.n && preset.unit === condition.unit,
    )?.id ?? RANGE_CUSTOM
  );
}
