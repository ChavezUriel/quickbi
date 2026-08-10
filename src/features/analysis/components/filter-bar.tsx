import { useState } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useMediaQuery } from '@/lib/use-media-query';
import { cn } from '@/lib/utils';
import {
  COMPARISON_LABEL,
  COMPARISONS,
  GRANULARITIES,
  GRANULARITY_LABEL,
  RANGE_ALL,
  RANGE_CUSTOM,
  RANGE_PRESETS,
} from '../labels';
import { activeSelections } from '../lib/filters';
import type { ComparisonMode, DateWindow, Granularity } from '../types';
import type { ExplorationState } from '../use-exploration';

interface FilterBarProps {
  state: ExplorationState;
  /** Valores distintos de cada dimensión, para los desplegables. */
  distinct: Record<string, string[]>;
  dimensions: readonly string[];
}

const ALL = '__todos__';
const SEVERAL = '__varios__';

/**
 * Controles que afectan a toda la sección: período, comparación, grano y
 * filtros por dimensión. Debajo, lo que está filtrado ahora mismo, porque un
 * cuadro de mando filtrado sin decirlo es un cuadro de mando que miente.
 *
 * En pantalla estrecha los controles se pliegan tras un botón: son siete u
 * ocho desplegables que, desplegados, empujan el gráfico fuera de la pantalla
 * de salida. Lo que nunca se pliega es la lista de filtros activos —esa es
 * justamente la parte que no puede quedar escondida.
 */
export function FilterBar({ state, distinct, dimensions }: FilterBarProps) {
  const selections = activeSelections(state.filters);
  // Solo el teléfono los pliega: en tableta caben en dos filas sin echar el
  // gráfico fuera de la pantalla, y un control visible siempre gana a uno que
  // hay que ir a buscar.
  const isWide = useMediaQuery('(min-width: 48rem)');
  const [expanded, setExpanded] = useState(false);

  const showControls = isWide || expanded;

  return (
    <div className="@container space-y-2 rounded-lg border bg-muted/30 p-2">
      {!isWide && (
        <Button
          variant="outline"
          size="sm"
          className="h-9 w-full justify-between"
          aria-expanded={expanded}
          onClick={() => setExpanded((previous) => !previous)}
        >
          <span className="flex items-center gap-2">
            <SlidersHorizontal className="size-4" aria-hidden />
            Período y filtros
          </span>
          <span className="text-xs text-muted-foreground">
            {selections.length > 0 ? `${selections.length} activos` : 'Todos'}
          </span>
        </Button>
      )}

      {showControls && (
        <div className="grid grid-cols-2 items-end gap-3 @2xl:flex @2xl:flex-wrap @2xl:items-center @2xl:gap-x-4 @2xl:gap-y-2">
          {state.hasDateAxis && (
            <>
              <Field label="Período">
                <Select
                  value={state.rangeId}
                  onValueChange={(value: string | null) => {
                    if (value !== null) state.setRange(value);
                  }}
                  items={rangeItems()}
                >
                  <SelectTrigger size="sm" className={CONTROL} aria-label="Período analizado">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {rangeItems().map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              {state.rangeId === RANGE_CUSTOM && state.customRange !== null && (
                <RangeInputs
                  label="Rango"
                  value={state.customRange}
                  onChange={state.setCustomRange}
                />
              )}

              <Field label="Grano">
                <Select
                  value={state.granoChoice}
                  onValueChange={(value: string | null) => {
                    if (value !== null) state.setGranoChoice(value as 'auto' | Granularity);
                  }}
                  items={granoItems()}
                >
                  <SelectTrigger
                    size="sm"
                    className={CONTROL}
                    aria-label="Granularidad temporal"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {granoItems().map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Comparar con" className="col-span-2 @2xl:col-span-1">
                <Select
                  value={state.comparison}
                  onValueChange={(value: string | null) => {
                    if (value !== null) state.setComparison(value as ComparisonMode);
                  }}
                  items={COMPARISONS.map((mode) => ({
                    value: mode,
                    label: COMPARISON_LABEL[mode],
                  }))}
                >
                  <SelectTrigger
                    size="sm"
                    className={CONTROL}
                    aria-label="Período de comparación"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COMPARISONS.map((mode) => (
                      <SelectItem key={mode} value={mode}>
                        {COMPARISON_LABEL[mode]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              {state.comparison === 'personalizada' && (
                <RangeInputs
                  label="Rango de comparación"
                  value={state.customPrevious ?? state.window ?? { desde: '', hasta: '' }}
                  onChange={state.setCustomPrevious}
                />
              )}
            </>
          )}

          {dimensions.map((dimension) => (
            <DimensionFilter
              key={dimension}
              dimension={dimension}
              values={distinct[dimension] ?? []}
              selected={selectedOf(state, dimension)}
              onChange={(values) => state.setDimensionFilter(dimension, values)}
            />
          ))}
        </div>
      )}

      {selections.length > 0 && (
        <div
          className={cn(
            'flex flex-wrap items-center gap-1.5',
            showControls && 'border-t pt-2',
          )}
        >
          <span className="text-xs text-muted-foreground">Filtrado por:</span>
          {selections.map(({ column, values }) => (
            <button
              key={column}
              type="button"
              onClick={() => state.setDimensionFilter(column, [])}
              className="inline-flex h-7 max-w-full items-center gap-1 rounded-full border border-input bg-background px-2 text-xs hover:bg-muted"
            >
              <span className="min-w-0 truncate font-mono">{column}</span>
              <span className="min-w-0 truncate text-muted-foreground">
                {values.length === 1 ? values[0] : `${values.length} valores`}
              </span>
              <X className="size-3 shrink-0" aria-hidden />
              <span className="sr-only">Quitar el filtro de {column}</span>
            </button>
          ))}
          <Button variant="ghost" size="sm" className="h-7" onClick={state.clearFilters}>
            Limpiar todo
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * Ancho completo mientras los controles van en rejilla; ajustado al contenido
 * cuando pasan a fila. Alto de 36 px en táctil, 28 en puntero fino.
 */
const CONTROL =
  'h-9 w-full min-w-0 text-xs @2xl:h-7 @2xl:w-fit @2xl:max-w-56 @2xl:text-sm';

function DimensionFilter({
  dimension,
  values,
  selected,
  onChange,
}: {
  dimension: string;
  values: readonly string[];
  selected: readonly string[];
  onChange: (values: string[]) => void;
}) {
  if (values.length === 0) return null;

  // Con varios valores elegidos (ctrl + clic en un widget) no hay una opción
  // que mostrar: se añade una entrada sintética para que el control no mienta.
  const items = [
    { value: ALL, label: 'Todos' },
    ...(selected.length > 1
      ? [{ value: SEVERAL, label: `${selected.length} seleccionados` }]
      : []),
    ...values.map((value) => ({ value, label: value })),
  ];

  const current = selected.length === 0 ? ALL : selected.length > 1 ? SEVERAL : selected[0];

  return (
    <Field label={dimension} mono>
      <Select
        value={current ?? ALL}
        onValueChange={(value: string | null) => {
          if (value === null || value === SEVERAL) return;
          onChange(value === ALL ? [] : [value]);
        }}
        items={items}
      >
        <SelectTrigger size="sm" className={CONTROL} aria-label={`Filtrar por ${dimension}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

function RangeInputs({
  label,
  value,
  onChange,
}: {
  label: string;
  value: DateWindow;
  onChange: (window: DateWindow) => void;
}) {
  return (
    <Field label={label} className="col-span-2 @2xl:col-span-1">
      <div className="flex items-center gap-1">
        <DateInput
          value={value.desde}
          ariaLabel={`${label}: desde`}
          onChange={(desde) => onChange({ ...value, desde })}
        />
        <span className="text-xs text-muted-foreground">—</span>
        <DateInput
          value={value.hasta}
          ariaLabel={`${label}: hasta`}
          onChange={(hasta) => onChange({ ...value, hasta })}
        />
      </div>
    </Field>
  );
}

function DateInput({
  value,
  ariaLabel,
  onChange,
}: {
  value: string;
  ariaLabel: string;
  onChange: (value: string) => void;
}) {
  return (
    <input
      type="date"
      value={value}
      aria-label={ariaLabel}
      onChange={(event) => {
        // Un campo de fecha vacío o a medio escribir no es un filtro válido.
        if (event.target.value !== '') onChange(event.target.value);
      }}
      className="h-9 min-w-0 flex-1 rounded-md border border-input bg-transparent px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 @2xl:h-7 @2xl:flex-none dark:bg-input/30"
    />
  );
}

/**
 * Rótulo encima del control en rejilla; a su izquierda cuando los controles
 * pasan a fila. En horizontal la barra entera cabe en un renglón, y cada
 * renglón que no gasta aquí es altura que se queda el gráfico.
 */
function Field({
  label,
  mono,
  className,
  children,
}: {
  label: string;
  mono?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'min-w-0 space-y-1',
        '@2xl:flex @2xl:items-center @2xl:gap-1.5 @2xl:space-y-0',
        className,
      )}
    >
      <p
        className={cn(
          'truncate text-xs text-muted-foreground @2xl:shrink-0',
          mono === true && 'font-mono @2xl:max-w-32',
        )}
      >
        {label}
      </p>
      {children}
    </div>
  );
}

function rangeItems(): { value: string; label: string }[] {
  return [
    ...RANGE_PRESETS.map((preset) => ({ value: preset.id, label: preset.label })),
    { value: RANGE_ALL, label: 'Todo el histórico' },
    { value: RANGE_CUSTOM, label: 'Rango personalizado' },
  ];
}

function granoItems(): { value: string; label: string }[] {
  return [
    { value: 'auto', label: 'Automático' },
    ...GRANULARITIES.map((grano) => ({ value: grano, label: GRANULARITY_LABEL[grano] })),
  ];
}

function selectedOf(state: ExplorationState, dimension: string): string[] {
  const found = activeSelections(state.filters).find((entry) => entry.column === dimension);
  return found?.values ?? [];
}
