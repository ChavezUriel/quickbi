import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Check,
  ChevronDown,
  RotateCcw,
  Search,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  COMPARISON_LABEL,
  COMPARISONS,
  DEFAULT_RANGE,
  GRANULARITIES,
  GRANULARITY_LABEL,
  RANGE_ALL,
  RANGE_CUSTOM,
  RANGE_PRESETS,
} from '../labels';
import {
  getMembership,
  matchesSelections,
  MAX_MEMBERSHIP_VALUES,
  withoutColumn,
} from '../lib/filters';
import type {
  AnalysisRow,
  Condition,
  DateFilterMode,
  DateWindow,
} from '../types';
import type { ExplorationState } from '../use-exploration';

interface FilterBarProps {
  state: ExplorationState;
  /** Distinct values for every mapped dimension. */
  distinct: Record<string, string[]>;
  /** Mapped dimensions, including ones not currently used to group the chart. */
  dimensions: readonly string[];
  /** Numeric columns that can be constrained with a min/max range. */
  numericColumns: readonly string[];
  /** Prepared rows used only to show other-filter-aware row counts. */
  rows: readonly AnalysisRow[];
  /** Columns that are not mapped to a filterable role yet. */
  unmappedColumns?: readonly string[];
}

const DATE_PRESET_IDS = ['7d', '30d', '3m', '6m', '12m'] as const;

/**
 * BI-style filter strip. Each control is a compact pill and opens its own
 * popover, keeping the dashboard readable while preserving the full state in
 * the shared exploration hook.
 */
export function FilterBar({
  state,
  distinct,
  dimensions,
  numericColumns,
  rows,
  unmappedColumns = [],
}: FilterBarProps) {
  const [openFilter, setOpenFilter] = useState<string | null>(null);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const filterableColumns = useMemo(
    () => [...new Set([...dimensions, ...numericColumns])],
    [dimensions, numericColumns],
  );
  const numericSet = useMemo(() => new Set(numericColumns), [numericColumns]);
  const activeColumns = useMemo(
    () =>
      new Set(
        state.filters.conditions
          .filter(
            (condition) =>
              (condition.op === 'in' || condition.op === 'not_in' || condition.op === 'rango') &&
              condition.column.length > 0,
          )
          .map((condition) => condition.column),
      ),
    [state.filters],
  );
  const dateModified =
    state.hasDateAxis &&
    (state.rangeId !== DEFAULT_RANGE.id || state.dateMode !== 'ultimos');
  const dateSettingsModified =
    dateModified || state.comparison !== 'anterior' || state.granoChoice !== 'auto';
  const clearable = activeColumns.size > 0 || dateSettingsModified;

  const rowCounts = useMemo(() => {
    const counts: Record<string, Record<string, number>> = {};
    for (const column of dimensions) {
      const baseFilters = withoutColumn(state.filters, column);
      const values = distinct[column] ?? [];
      const valueSet = new Set(values);
      const columnCounts: Record<string, number> = Object.fromEntries(
        values.map((value) => [value, 0]),
      );
      for (const row of rows) {
        if (!matchesSelections(row, baseFilters)) continue;
        const value = row.dims[column];
        if (value !== undefined && valueSet.has(value)) {
          columnCounts[value] = (columnCounts[value] ?? 0) + 1;
        }
      }
      counts[column] = columnCounts;
    }
    return counts;
  }, [dimensions, distinct, rows, state.filters]);

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          {state.hasDateAxis && (
            <DatePill state={state} open={openFilter === '__fecha__'} onOpen={() => setOpenFilter('__fecha__')} onClose={() => setOpenFilter(null)} />
          )}

          {state.hasDateAxis && (
            <ComparisonPill
              state={state}
              open={openFilter === '__comparacion__'}
              onOpen={() => setOpenFilter('__comparacion__')}
              onClose={() => setOpenFilter(null)}
            />
          )
          }

          {state.hasDateAxis && (
            <GranularityPill
              state={state}
              open={openFilter === '__grano__'}
              onOpen={() => setOpenFilter('__grano__')}
              onClose={() => setOpenFilter(null)}
            />
          )}

          {filterableColumns.map((column) => {
            const active = activeColumns.has(column);
            if (!active && openFilter !== column) return null;

            return numericSet.has(column) ? (
              <NumericPill
                key={column}
                column={column}
                condition={state.filters.conditions.find(
                  (item): item is Extract<Condition, { op: 'rango' }> =>
                    item.op === 'rango' && item.column === column,
                )}
                open={openFilter === column}
                onOpen={() => setOpenFilter(column)}
                onClose={() => setOpenFilter(null)}
                onChange={(min, max) => state.setNumericFilter(column, min, max)}
              />
            ) : (
              <MembershipPill
                key={column}
                column={column}
                values={distinct[column] ?? []}
                counts={rowCounts[column] ?? {}}
                condition={getMembership(state.filters, column)}
                open={openFilter === column}
                onOpen={() => setOpenFilter(column)}
                onClose={() => setOpenFilter(null)}
                onChange={(op, values) => state.setMembershipFilter(column, op, values)}
              />
            );
          })}

          <div className="relative">
            <button
              type="button"
              className="inline-flex h-8 items-center gap-1 rounded-full border border-dashed border-primary/50 px-3 text-xs font-medium text-primary transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              aria-expanded={addMenuOpen}
              onClick={() => setAddMenuOpen((previous) => !previous)}
            >
              <span className="text-base leading-none">+</span> Filtro
            </button>
            <Popover open={addMenuOpen} onClose={() => setAddMenuOpen(false)} className="w-64 p-1.5">
              <p className="px-2 py-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Añadir filtro
              </p>
              {filterableColumns.filter((column) => !activeColumns.has(column)).length === 0 ? (
                <p className="px-2 py-3 text-xs text-muted-foreground">Todos los campos ya están filtrados.</p>
              ) : (
                filterableColumns
                  .filter((column) => !activeColumns.has(column))
                  .map((column) => (
                    <button
                      key={column}
                      type="button"
                      className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-xs hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                      onClick={() => {
                        setAddMenuOpen(false);
                        setOpenFilter(column);
                      }}
                    >
                      <span className="min-w-0 truncate font-mono">{column}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {numericSet.has(column) ? 'Número' : 'Categoría'}
                      </span>
                    </button>
                  ))
              )}
              {unmappedColumns.length > 0 && (
                <>
                  <p className="mt-1 border-t px-2 py-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Sin mapear
                  </p>
                  {unmappedColumns.map((column) => (
                    <button
                      key={column}
                      type="button"
                      disabled
                      title="Corrige el tipo de columna en el paso de mapeo"
                      className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-xs opacity-45"
                    >
                      <span className="min-w-0 truncate font-mono">{column}</span>
                      <span className="text-[10px]">No disponible</span>
                    </button>
                  ))}
                </>
              )}
            </Popover>
          </div>

          {clearable && (
            <button
              type="button"
              className="inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              onClick={() => {
                setOpenFilter(null);
                setAddMenuOpen(false);
                state.clearFilters();
              }}
            >
              <RotateCcw className="size-3.5" aria-hidden />
              Limpiar filtros
            </button>
          )}
    </div>
  );
}

function Popover({
  open,
  onClose,
  className,
  children,
}: {
  open: boolean;
  onClose: () => void;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (ref.current !== null && !ref.current.contains(event.target as Node)) onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      ref={ref}
      role="dialog"
      className={cn(
        'absolute left-0 top-[calc(100%+6px)] z-30 min-w-[240px] rounded-xl border bg-popover p-2 text-popover-foreground shadow-xl ring-1 ring-black/5',
        className,
      )}
    >
      {children}
    </div>
  );
}

function Pill({
  label,
  summary,
  active,
  open,
  onOpen,
  onClose,
  onClear,
  children,
}: {
  label: string;
  summary: string;
  active: boolean;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onClear?: () => void;
  children: ReactNode;
}) {
  return (
    <div className="relative max-w-full">
      <div
        className={cn(
          'inline-flex h-8 max-w-full items-center rounded-full border text-[12px] transition-colors',
          active || open
            ? 'border-primary/60 bg-primary/10 text-foreground'
            : 'border-border bg-background text-muted-foreground hover:border-primary/40',
        )}
      >
        <button
          type="button"
          className="min-w-0 max-w-[240px] truncate px-3 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          aria-expanded={open}
          onClick={onOpen}
        >
          <span className="font-medium">{label}</span>
          <span className="text-muted-foreground">: {summary}</span>
        </button>
        {onClear !== undefined && (
          <button
            type="button"
            aria-label={`Quitar filtro de ${label}`}
            className="mr-1 flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            onClick={(event) => {
              event.stopPropagation();
              onClear();
              onClose();
            }}
          >
            <X className="size-3.5" aria-hidden />
          </button>
        )}
      </div>
      <Popover open={open} onClose={onClose}>
        {children}
      </Popover>
    </div>
  );
}

function MembershipPill({
  column,
  values,
  counts,
  condition,
  open,
  onOpen,
  onClose,
  onChange,
}: {
  column: string;
  values: readonly string[];
  counts: Record<string, number>;
  condition: Extract<Condition, { op: 'in' | 'not_in' }> | null;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onChange: (op: 'in' | 'not_in', values: string[]) => void;
}) {
  const summary = membershipSummary(condition);
  return (
    <Pill
      label={column}
      summary={summary}
      active={condition !== null}
      open={open}
      onOpen={onOpen}
      onClose={onClose}
      onClear={() => onChange('in', [])}
    >
      <MembershipPopover
        column={column}
        values={values}
        counts={counts}
        condition={condition}
        onChange={onChange}
      />
    </Pill>
  );
}

function MembershipPopover({
  column,
  values,
  counts,
  condition,
  onChange,
}: {
  column: string;
  values: readonly string[];
  counts: Record<string, number>;
  condition: Extract<Condition, { op: 'in' | 'not_in' }> | null;
  onChange: (op: 'in' | 'not_in', values: string[]) => void;
}) {
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState<'in' | 'not_in'>(condition?.op ?? 'in');

  useEffect(() => {
    setMode(condition?.op ?? 'in');
  }, [condition?.op]);

  const selected = condition?.values ?? [];
  const filteredValues = values.filter((value) => value.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  const included = (value: string) => (mode === 'not_in' ? !selected.includes(value) : selected.includes(value));
  const includedCount = values.filter(included).length;
  const allIncluded = values.length > 0 && includedCount === values.length;
  const partiallyIncluded = includedCount > 0 && includedCount < values.length;

  const setValues = (next: string[]) => onChange(mode, next.slice(0, MAX_MEMBERSHIP_VALUES));
  const toggleValue = (value: string) => {
    const next = selected.includes(value)
      ? selected.filter((item) => item !== value)
      : [...selected, value];
    setValues(next);
  };

  return (
    <div className="w-[min(360px,calc(100vw-2rem))]">
      <div className="flex items-center justify-between gap-2 border-b pb-2">
        <div>
          <p className="text-xs font-semibold">{column}</p>
          <p className="text-[11px] text-muted-foreground">
            {mode === 'in' ? 'Incluir valores' : 'Todos excepto'}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={mode === 'not_in'}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] transition-colors',
            mode === 'not_in'
              ? 'border-primary/50 bg-primary/10 text-primary'
              : 'border-border text-muted-foreground hover:bg-muted',
          )}
          onClick={() => setMode((current) => (current === 'in' ? 'not_in' : 'in'))}
        >
          <span className={cn('flex size-3.5 items-center justify-center rounded border', mode === 'not_in' && 'border-primary bg-primary text-primary-foreground')}>
            {mode === 'not_in' && <Check className="size-2.5" aria-hidden />}
          </span>
          Excluir
        </button>
      </div>

      <div className="mt-2 flex items-center gap-2 rounded-lg bg-muted/60 px-2 py-1.5">
        <button
          type="button"
          role="checkbox"
          aria-checked={partiallyIncluded ? 'mixed' : allIncluded}
          className={cn(
            'flex size-4 shrink-0 items-center justify-center rounded border transition-colors',
            allIncluded || partiallyIncluded
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-input bg-background',
          )}
          onClick={() => {
            if (mode === 'in') setValues(allIncluded ? [] : [...values]);
            else setValues(allIncluded ? [...values] : []);
          }}
        >
          {allIncluded && <Check className="size-3" aria-hidden />}
          {partiallyIncluded && <span className="h-px w-2 bg-primary-foreground" />}
        </button>
        <span className="min-w-0 flex-1 text-xs">{allIncluded ? 'Todos' : `${includedCount} seleccionados`}</span>
        {selected.length > MAX_MEMBERSHIP_VALUES - 1 && (
          <span className="text-[10px] tabular-nums text-amber-700">{selected.length}/200</span>
        )}
      </div>

      <label className="mt-2 flex h-8 items-center gap-2 rounded-lg border px-2 text-xs text-muted-foreground focus-within:border-primary">
        <Search className="size-3.5 shrink-0" aria-hidden />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar valores"
          aria-label={`Buscar valores de ${column}`}
          className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground/70"
        />
      </label>

      <div className="mt-2 max-h-64 overflow-y-auto pr-0.5">
        {filteredValues.length === 0 ? (
          <p className="px-2 py-5 text-center text-xs text-muted-foreground">Sin coincidencias.</p>
        ) : (
          filteredValues.map((value) => {
            const checked = included(value);
            return (
              <div key={value} className="group grid grid-cols-[auto_minmax(0,1fr)_52px] items-center gap-2 rounded-lg px-1.5 py-1.5 hover:bg-muted">
                <input
                  type="checkbox"
                  checked={checked}
                  aria-label={`${checked ? 'Quitar' : 'Seleccionar'} ${value}`}
                  onChange={() => toggleValue(value)}
                  className="size-3.5 accent-primary"
                />
                <span className="min-w-0 truncate text-xs" title={value}>{value}</span>
                <span className="relative text-right text-[10px] tabular-nums text-muted-foreground">
                  <span className="group-hover:invisible">{(counts[value] ?? 0).toLocaleString('es-ES')}</span>
                  <button
                    type="button"
                    className="invisible absolute inset-0 w-full rounded bg-background px-1 text-[10px] font-semibold uppercase tracking-wide text-primary group-hover:visible hover:bg-primary/10 focus-visible:visible focus-visible:outline-none"
                    onClick={() => {
                      onChange('in', [value]);
                    }}
                  >
                    Solo
                  </button>
                </span>
              </div>
            );
          })
        )}
      </div>

      {selected.length >= MAX_MEMBERSHIP_VALUES && (
        <p className="mt-2 rounded-lg bg-amber-50 px-2 py-1.5 text-[11px] text-amber-800">
          Máximo de {MAX_MEMBERSHIP_VALUES} valores por filtro.
        </p>
      )}
    </div>
  );
}

function NumericPill({
  column,
  condition,
  open,
  onOpen,
  onClose,
  onChange,
}: {
  column: string;
  condition: Extract<Condition, { op: 'rango' }> | undefined;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onChange: (min: number | null, max: number | null) => void;
}) {
  return (
    <Pill
      label={column}
      summary={numericSummary(condition)}
      active={condition !== undefined}
      open={open}
      onOpen={onOpen}
      onClose={onClose}
      onClear={() => onChange(null, null)}
    >
      <NumericPopover condition={condition} onChange={onChange} onClose={onClose} />
    </Pill>
  );
}

function NumericPopover({
  condition,
  onChange,
  onClose,
}: {
  condition: Extract<Condition, { op: 'rango' }> | undefined;
  onChange: (min: number | null, max: number | null) => void;
  onClose: () => void;
}) {
  const [min, setMin] = useState(condition?.min === null || condition === undefined ? '' : String(condition.min));
  const [max, setMax] = useState(condition?.max === null || condition === undefined ? '' : String(condition.max));

  useEffect(() => {
    setMin(condition?.min === null || condition === undefined ? '' : String(condition.min));
    setMax(condition?.max === null || condition === undefined ? '' : String(condition.max));
  }, [condition]);

  return (
    <div className="w-64">
      <p className="text-xs font-semibold">Rango numérico</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <label className="space-y-1 text-[11px] text-muted-foreground">
          Mínimo
          <input type="number" value={min} onChange={(event) => setMin(event.target.value)} className="h-8 w-full rounded-lg border bg-transparent px-2 text-xs outline-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring/30" />
        </label>
        <label className="space-y-1 text-[11px] text-muted-foreground">
          Máximo
          <input type="number" value={max} onChange={(event) => setMax(event.target.value)} className="h-8 w-full rounded-lg border bg-transparent px-2 text-xs outline-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring/30" />
        </label>
      </div>
      <button type="button" className="mt-3 h-8 w-full rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/85 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50" onClick={() => { onChange(numberOrNull(min), numberOrNull(max)); onClose(); }}>
        Aplicar
      </button>
    </div>
  );
}

function DatePill({
  state,
  open,
  onOpen,
  onClose,
}: {
  state: ExplorationState;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}) {
  const summary = dateSummary(state);
  return (
    <Pill
      label="Fecha"
      summary={summary}
      active={state.rangeId !== DEFAULT_RANGE.id || state.dateMode !== 'ultimos'}
      open={open}
      onOpen={onOpen}
      onClose={onClose}
      // The fixed date filter always has a baseline. Clearing it restores the
      // section default instead of silently switching to an empty date state.
      onClear={
        state.rangeId !== DEFAULT_RANGE.id || state.dateMode !== 'ultimos'
          ? () => {
              state.setRange(DEFAULT_RANGE.id);
              state.setDateMode('ultimos');
            }
          : undefined
      }
    >
      <DatePopover state={state} onClose={onClose} />
    </Pill>
  );
}

function DatePopover({ state, onClose }: { state: ExplorationState; onClose: () => void }) {
  const [custom, setCustom] = useState<DateWindow>(state.customRange ?? state.bounds ?? { desde: '', hasta: '' });

  useEffect(() => {
    setCustom(state.customRange ?? state.bounds ?? { desde: '', hasta: '' });
  }, [state.customRange, state.bounds]);

  return (
    <div className="w-[min(360px,calc(100vw-2rem))]">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold">Ventana de fecha</p>
          <p className="text-[11px] text-muted-foreground">Selecciona una ventana y su modo.</p>
        </div>
        <ChevronDown className="size-3.5 rotate-180 text-muted-foreground" aria-hidden />
      </div>
      <div className="mt-3 grid grid-cols-3 gap-1.5">
        {DATE_PRESET_IDS.map((id) => {
          const preset = RANGE_PRESETS.find((item) => item.id === id);
          if (preset === undefined) return null;
          const active = state.rangeId === id;
          return (
            <button key={id} type="button" className={cn('rounded-lg border px-2 py-2 text-xs transition-colors hover:bg-muted', active && 'border-primary bg-primary/10 text-primary')} onClick={() => state.setRange(id)}>
              {shortPresetLabel(preset.id)}
              <span className="mt-0.5 block text-[10px] text-muted-foreground">{preset.label.replace(/^Últimos\s+/u, '')}</span>
            </button>
          );
        })}
        <button type="button" className={cn('rounded-lg border px-2 py-2 text-xs transition-colors hover:bg-muted', state.rangeId === RANGE_ALL && 'border-primary bg-primary/10 text-primary')} onClick={() => state.setRange(RANGE_ALL)}>
          Todo
          <span className="mt-0.5 block text-[10px] text-muted-foreground">histórico</span>
        </button>
      </div>

      <div className="mt-3 flex rounded-lg bg-muted p-0.5">
        {(['ultimos', 'completo', 'en_curso'] as DateFilterMode[]).map((mode) => (
          <button key={mode} type="button" className={cn('flex-1 rounded-md px-2 py-1.5 text-[11px] transition-colors', state.dateMode === mode && 'bg-background font-medium shadow-sm')} onClick={() => state.setDateMode(mode)}>
            {dateModeLabel(mode)}
          </button>
        ))}
      </div>

      <div className="mt-3 border-t pt-3">
        <p className="text-[11px] font-medium text-muted-foreground">Rango personalizado</p>
        <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-end gap-1.5">
          <label className="space-y-1 text-[10px] text-muted-foreground">Desde<input type="date" value={custom.desde} onChange={(event) => setCustom({ ...custom, desde: event.target.value })} className="h-8 w-full rounded-lg border bg-transparent px-2 text-xs outline-none focus-visible:border-primary" /></label>
          <span className="pb-2 text-xs text-muted-foreground">–</span>
          <label className="space-y-1 text-[10px] text-muted-foreground">Hasta<input type="date" value={custom.hasta} onChange={(event) => setCustom({ ...custom, hasta: event.target.value })} className="h-8 w-full rounded-lg border bg-transparent px-2 text-xs outline-none focus-visible:border-primary" /></label>
        </div>
        <button type="button" disabled={custom.desde === '' || custom.hasta === ''} className="mt-3 h-8 w-full rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/85 disabled:pointer-events-none disabled:opacity-50" onClick={() => { state.setCustomRange(custom); onClose(); }}>
          Aplicar rango
        </button>
      </div>
    </div>
  );
}

function ComparisonPill({ state, open, onOpen, onClose }: { state: ExplorationState; open: boolean; onOpen: () => void; onClose: () => void }) {
  const effectiveLabel = state.comparisonEffective === state.comparison ? COMPARISON_LABEL[state.comparison] : `${COMPARISON_LABEL[state.comparison]} · ${COMPARISON_LABEL[state.comparisonEffective]}`;
  return (
    <Pill label="Comparar" summary={effectiveLabel} active={state.comparison !== 'anterior'} open={open} onOpen={onOpen} onClose={onClose}>
      <div className="w-72">
        <p className="text-xs font-semibold">Comparación</p>
        <div className="mt-2 space-y-1">
          {COMPARISONS.map((mode) => {
            const disabled = mode === 'anio_anterior' && state.comparisonBlockedReason !== null;
            return (
              <button key={mode} type="button" disabled={disabled} title={disabled ? state.comparisonBlockedReason ?? undefined : undefined} className="flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left text-xs hover:bg-muted disabled:cursor-not-allowed disabled:opacity-45" onClick={() => { state.setComparison(mode); if (mode !== 'personalizada') onClose(); }}>
                <span className={cn('mt-0.5 flex size-3.5 shrink-0 items-center justify-center rounded-full border', state.comparison === mode && 'border-primary bg-primary text-primary-foreground')}>
                  {state.comparison === mode && <Check className="size-2.5" aria-hidden />}
                </span>
                <span>{COMPARISON_LABEL[mode]}{disabled && <span className="mt-0.5 block text-[10px] text-muted-foreground">{state.comparisonBlockedReason}</span>}</span>
              </button>
            );
          })}
        </div>
        {state.comparison === 'personalizada' && <CustomComparison state={state} onClose={onClose} />}
        {state.comparisonEffective !== state.comparison && <p className="mt-2 rounded-lg bg-amber-50 px-2 py-1.5 text-[11px] text-amber-800">La selección se conserva y volverá a aplicarse cuando el rango sea compatible.</p>}
      </div>
    </Pill>
  );
}

function CustomComparison({ state, onClose }: { state: ExplorationState; onClose: () => void }) {
  const [range, setRange] = useState<DateWindow>(state.customPrevious ?? state.window ?? { desde: '', hasta: '' });
  return (
    <div className="mt-2 border-t pt-2">
      <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-1.5">
        <label className="space-y-1 text-[10px] text-muted-foreground">Desde<input type="date" value={range.desde} onChange={(event) => setRange({ ...range, desde: event.target.value })} className="h-8 w-full rounded-lg border bg-transparent px-2 text-xs" /></label>
        <span className="pb-2 text-xs text-muted-foreground">–</span>
        <label className="space-y-1 text-[10px] text-muted-foreground">Hasta<input type="date" value={range.hasta} onChange={(event) => setRange({ ...range, hasta: event.target.value })} className="h-8 w-full rounded-lg border bg-transparent px-2 text-xs" /></label>
      </div>
      <button type="button" className="mt-2 h-8 w-full rounded-lg bg-primary text-xs font-medium text-primary-foreground disabled:opacity-50" disabled={range.desde === '' || range.hasta === ''} onClick={() => { state.setCustomPrevious(range); onClose(); }}>Aplicar comparación</button>
    </div>
  );
}

function GranularityPill({ state, open, onOpen, onClose }: { state: ExplorationState; open: boolean; onOpen: () => void; onClose: () => void }) {
  const current = state.granoChoice === 'auto' ? 'Auto' : GRANULARITY_LABEL[state.granoChoice];
  return (
    <Pill label="Grano" summary={current} active={state.granoChoice !== 'auto'} open={open} onOpen={onOpen} onClose={onClose}>
      <div className="w-52">
        <p className="text-xs font-semibold">Granularidad temporal</p>
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          {(['auto', ...GRANULARITIES] as const).map((value) => (
            <button key={value} type="button" className={cn('rounded-lg border px-2 py-2 text-xs hover:bg-muted', state.granoChoice === value && 'border-primary bg-primary/10 text-primary')} onClick={() => { state.setGranoChoice(value); onClose(); }}>
              {value === 'auto' ? 'Auto' : GRANULARITY_LABEL[value]}
            </button>
          ))}
        </div>
      </div>
    </Pill>
  );
}

function dateSummary(state: ExplorationState): string {
  if (state.rangeId === RANGE_ALL) return 'Todo';
  if (state.rangeId === RANGE_CUSTOM && state.customRange !== null) return `${state.customRange.desde} – ${state.customRange.hasta}`;
  const preset = RANGE_PRESETS.find((item) => item.id === state.rangeId);
  if (preset === undefined) return 'Seleccionada';
  return `${shortPresetLabel(preset.id)} · ${dateModeLabel(state.dateMode)}`;
}

function shortPresetLabel(id: string): string {
  switch (id) {
    case '7d': return '1s';
    case '30d': return '1m';
    default: return id;
  }
}

function dateModeLabel(mode: DateFilterMode): string {
  switch (mode) {
    case 'completo': return 'Completos';
    case 'en_curso': return 'En curso';
    default: return 'Últimos';
  }
}

function membershipSummary(condition: Extract<Condition, { op: 'in' | 'not_in' }> | null): string {
  if (condition === null || condition.values.length === 0) return 'Todos';
  if (condition.op === 'not_in') return condition.values.length === 1 ? `Todos excepto ${condition.values[0]}` : `Todos excepto ${condition.values.length}`;
  const first = condition.values[0] ?? 'Seleccionado';
  return condition.values.length === 1 ? first : `${first} +${condition.values.length - 1}`;
}

function numericSummary(condition: Extract<Condition, { op: 'rango' }> | undefined): string {
  if (condition === undefined || (condition.min === null && condition.max === null)) return 'Todos';
  if (condition.min !== null && condition.max !== null) return `${condition.min} – ${condition.max}`;
  if (condition.min !== null) return `≥ ${condition.min}`;
  return `≤ ${condition.max}`;
}

function numberOrNull(value: string): number | null {
  if (value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
