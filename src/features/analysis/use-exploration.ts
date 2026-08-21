import { useCallback, useMemo, useState } from 'react';
import {
  DEFAULT_RANGE,
  RANGE_ALL,
  RANGE_CUSTOM,
  RANGE_PRESETS,
  RANGE_PRESETS_BY_ID,
} from './labels';
import { autoGranularity, daysBetween } from './lib/dates';
import { computeExploration, resolveWindows } from './lib/explore';
import {
  clearSelections,
  EMPTY_FILTERS,
  getDateCondition,
  getSelected,
  lastPeriods,
  lastPeriodsWithMode,
  selectSingle,
  setDateCondition,
  setMembership,
  setRange as setNumericRange,
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
  type DateFilterMode,
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
  comparisonEffective: ComparisonMode;
  comparisonBlockedReason: string | null;
  customPrevious: DateWindow | null;
  setCustomPrevious: (window: DateWindow) => void;
  granoChoice: 'auto' | Granularity;
  setGranoChoice: (grano: 'auto' | Granularity) => void;
  dateMode: DateFilterMode;
  setDateMode: (mode: DateFilterMode) => void;

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
  setMembershipFilter: (column: string, op: 'in' | 'not_in', values: string[]) => void;
  setNumericFilter: (column: string, min: number | null, max: number | null) => void;
  clearFilters: () => void;
  filterCount: number;
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

  const currentWindow = useMemo(
    () => resolveWindows(filters, prepared.bounds, 'ninguna').current,
    [filters, prepared.bounds],
  );

  const comparisonBlockedReason = useMemo(() => {
    if (currentWindow === null || prepared.bounds === null) {
      return null;
    }

    const windowDays = daysBetween(currentWindow.desde, currentWindow.hasta) + 1;
    const historyDays = daysBetween(prepared.bounds.desde, prepared.bounds.hasta) + 1;
    if (windowDays > 366) return 'El rango supera un año.';
    if (historyDays < 396) return 'El dataset necesita al menos 13 meses de histórico.';
    return null;
  }, [currentWindow, prepared.bounds]);

  const comparisonEffective: ComparisonMode =
    comparison === 'anio_anterior' && comparisonBlockedReason !== null ? 'anterior' : comparison;

  const windows = useMemo(
    () => resolveWindows(filters, prepared.bounds, comparisonEffective, customPrevious),
    [filters, prepared.bounds, comparisonEffective, customPrevious],
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

      const preset = RANGE_PRESETS_BY_ID[id];
      if (preset !== undefined) {
        const mode =
          dateCondition?.op === 'ultimos_periodos' ? dateCondition.modo : 'ultimos';
        setDateConditionState(lastPeriodsWithMode(dateColumn, preset.n, preset.unit, mode));
      }
    },
    [dateColumn, windows, prepared.bounds, dateCondition],
  );

  const setCustomRange = useCallback(
    (range: DateWindow) => {
      if (dateColumn === null) return;
      setDateConditionState({ op: 'entre_fechas', column: dateColumn, ...range });
    },
    [dateColumn],
  );

  const setDateMode = useCallback(
    (mode: DateFilterMode) => {
      if (dateColumn === null) return;
      setDateConditionState((current) => {
        const n = current?.op === 'ultimos_periodos' ? current.n : DEFAULT_RANGE.n;
        const unit = current?.op === 'ultimos_periodos' ? current.unit : DEFAULT_RANGE.unit;
        return lastPeriodsWithMode(dateColumn, n, unit, mode);
      });
    },
    [dateColumn],
  );

  const setDimensionFilter = useCallback((column: string, values: string[]) => {
    // Un filtro elegido en la barra no tiene widget emisor: se aplica a todos.
    setEmitter(null);
    setSelections((current) => setSelected(current, column, values));
  }, []);

  const setMembershipFilter = useCallback(
    (column: string, op: 'in' | 'not_in', values: string[]) => {
      setEmitter(null);
      setSelections((current) => setMembership(current, column, op, values));
    },
    [],
  );

  const setNumericFilter = useCallback((column: string, min: number | null, max: number | null) => {
    setEmitter(null);
    setSelections((current) => setNumericRange(current, column, min, max));
  }, []);

  const clearFilters = useCallback(() => {
    setEmitter(null);
    setSelections((current) => clearSelections(current));
    setDateConditionState(undefined);
    setComparison('anterior');
    setCustomPrevious(null);
    setGranoChoice('auto');
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
  const dateMode: DateFilterMode =
    activeCondition?.op === 'ultimos_periodos' ? activeCondition.modo : 'ultimos';
  const filterCount = filters.conditions.filter(
    (condition) => condition.op !== 'ultimos_periodos' || condition.modo !== 'ultimos',
  ).length;

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
    comparisonEffective,
    comparisonBlockedReason,
    customPrevious,
    setCustomPrevious,
    granoChoice,
    setGranoChoice,
    dateMode,
    setDateMode,

    window: windows.current,
    previousWindow: windows.previous,
    grano,
    hasDateAxis: dateColumn !== null && prepared.bounds !== null,
    bounds: prepared.bounds,

    result,
    selected,
    setDimensionFilter,
    setMembershipFilter,
    setNumericFilter,
    clearFilters,
    filterCount,
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
