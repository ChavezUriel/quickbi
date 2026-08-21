import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Info } from 'lucide-react';
import {
  CURRENCIES,
  CURRENCY_LABEL,
  GRANULARITIES,
  GRANULARITY_LABEL,
  METRIC_AGG_LABEL,
  METRIC_FORMATS,
  METRIC_FORMAT_LABEL,
} from '@/features/analysis/labels';
import type { Currency, Granularity, MetricFormat } from '@/features/analysis/types';
import { OptionSelect, type Option } from '../../components/option-select';
import { SetupCard, SetupField, SetupGrid } from '../../components/setup-card';
import type { AxisSort } from '../lib/pivot';
import {
  COUNT_COLUMN,
  NO_DIM,
  TIME_DIM,
  type PivotConfigState,
} from '../use-pivot-config';

const SORTS: { value: AxisSort; label: string }[] = [
  { value: 'total', label: 'Por total, de mayor a menor' },
  { value: 'clave', label: 'Alfabético' },
];

const LIMITS = [10, 25, 50, 100, 250];
const COL_LIMITS = [6, 12, 16, 24, 40];

/**
 * Qué cruza la tabla: qué va en las filas, qué en las columnas y qué cifra
 * ocupa cada cruce. Los ejes se pueden cambiar después sobre la propia tabla;
 * aquí se decide además cómo se leen las cifras y cuánto cabe.
 */
export function PivotSetup({ state }: { state: PivotConfigState }) {
  const { settings, update, dimensions, measures, dateColumns } = state;

  const dimensionOptions: Option[] = dimensions.map((column) => ({
    value: column.name,
    label: column.name,
  }));

  const colOptions: Option[] = [
    ...dimensionOptions.filter((option) => option.value !== settings.rowDim),
    ...(dateColumns.length > 0 ? [{ value: TIME_DIM, label: 'Tiempo (períodos)' }] : []),
    { value: NO_DIM, label: 'Sin columnas (solo totales)' },
  ];

  const metricOptions: Option[] = [
    ...measures.map((column) => ({ value: column.name, label: column.name })),
    { value: COUNT_COLUMN, label: 'Número de filas' },
  ];

  const isCount = settings.metricColumn === COUNT_COLUMN;
  const usesTime = settings.colDim === TIME_DIM;

  if (dimensions.length === 0) {
    return (
      <SetupCard
        title="Tabla dinámica"
        description="Una métrica repartida entre dos ejes de categorías."
      >
        <Alert role="status">
          <Info className="size-4" />
          <AlertTitle>Sin dimensiones</AlertTitle>
          <AlertDescription>
            No hay ninguna columna de texto o booleana por la que abrir las filas. Si
            alguna columna contiene categorías, corrige su tipo en el paso anterior.
          </AlertDescription>
        </Alert>
      </SetupCard>
    );
  }

  return (
    <SetupCard
      title="Tabla dinámica"
      description="Elige qué va en las filas, qué en las columnas y qué cifra ocupa cada cruce. Los tres ejes se pueden cambiar luego sin volver aquí."
    >
      <SetupGrid>
        <SetupField label="Filas" hint="La categoría principal, una por línea.">
          <OptionSelect
            value={settings.rowDim}
            options={dimensionOptions}
            ariaLabel="Dimensión de las filas"
            onChange={(value) => update({ rowDim: value })}
          />
        </SetupField>

        <SetupField label="Columnas" hint="La segunda apertura, o el tiempo.">
          <OptionSelect
            value={settings.colDim}
            options={colOptions}
            ariaLabel="Dimensión de las columnas"
            onChange={(value) => update({ colDim: value })}
          />
        </SetupField>

        <SetupField label="Métrica" hint="La cifra de cada cruce.">
          <OptionSelect
            value={settings.metricColumn}
            options={metricOptions}
            ariaLabel="Métrica"
            onChange={(value) => update({ metricColumn: value })}
          />
        </SetupField>
      </SetupGrid>

      {usesTime && (
        <SetupGrid>
          <SetupField label="Columna de fecha" hint="Sobre la que se forman los períodos.">
            <OptionSelect
              value={settings.dateColumn ?? ''}
              options={dateColumns.map((column) => ({
                value: column.name,
                label: column.name,
              }))}
              ariaLabel="Columna de fecha"
              onChange={(value) => update({ dateColumn: value })}
            />
          </SetupField>

          <SetupField label="Grano" hint="Ancho de cada columna de tiempo.">
            <OptionSelect
              value={settings.grain}
              options={[...GRANULARITIES, 'anio' as Granularity].map((grain) => ({
                value: grain,
                label: GRANULARITY_LABEL[grain],
              }))}
              ariaLabel="Grano temporal"
              onChange={(value) => update({ grain: value as Granularity })}
            />
          </SetupField>
        </SetupGrid>
      )}

      <div className="grid gap-4 border-t pt-4 sm:grid-cols-2 lg:grid-cols-3">
        <SetupField
          label="Agregación"
          hint={isCount ? 'El recuento de filas no se agrega de otra forma.' : undefined}
        >
          <OptionSelect
            value={settings.agg}
            options={[
              { value: 'sum', label: METRIC_AGG_LABEL.sum },
              { value: 'avg', label: METRIC_AGG_LABEL.avg },
            ]}
            ariaLabel="Agregación de la métrica"
            disabled={isCount}
            onChange={(value) => update({ agg: value as 'sum' | 'avg' })}
          />
        </SetupField>

        <SetupField label="Formato" hint="Cómo se leen las cifras de la tabla.">
          <OptionSelect
            value={settings.format}
            options={METRIC_FORMATS.map((format) => ({
              value: format,
              label: METRIC_FORMAT_LABEL[format],
            }))}
            ariaLabel="Formato de la métrica"
            disabled={isCount}
            onChange={(value) => update({ format: value as MetricFormat })}
          />
        </SetupField>

        {settings.format === 'moneda' && !isCount && (
          <SetupField label="Moneda">
            <OptionSelect
              value={settings.currency}
              options={CURRENCIES.map((currency) => ({
                value: currency,
                label: CURRENCY_LABEL[currency],
              }))}
              ariaLabel="Moneda"
              onChange={(value) => update({ currency: value as Currency })}
            />
          </SetupField>
        )}

        <SetupField label="Orden de las categorías">
          <OptionSelect
            value={settings.sort}
            options={SORTS}
            ariaLabel="Orden de las categorías"
            onChange={(value) => update({ sort: value as AxisSort })}
          />
        </SetupField>

        <SetupField
          label="Máximo de filas"
          hint="Lo que sobra se pliega en «Otros» y sigue sumando al total."
        >
          <OptionSelect
            value={String(settings.maxRows)}
            options={LIMITS.map((limit) => ({ value: String(limit), label: String(limit) }))}
            ariaLabel="Máximo de filas"
            onChange={(value) => update({ maxRows: Number(value) })}
          />
        </SetupField>

        <SetupField label="Máximo de columnas">
          <OptionSelect
            value={String(settings.maxCols)}
            options={COL_LIMITS.map((limit) => ({
              value: String(limit),
              label: String(limit),
            }))}
            ariaLabel="Máximo de columnas"
            disabled={settings.colDim === NO_DIM}
            onChange={(value) => update({ maxCols: Number(value) })}
          />
        </SetupField>
      </div>
    </SetupCard>
  );
}
