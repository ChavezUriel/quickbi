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
import { SUPPORTS_SERIES } from '../lib/build-chart';
import {
  COUNT_COLUMN,
  NO_DIM,
  TIME_DIM,
  type BuilderConfigState,
} from '../use-builder-config';
import { ChartKindPicker } from './chart-kind-picker';

const GRAINS: Granularity[] = [...GRANULARITIES, 'anio'];

/**
 * El punto de partida del gráfico.
 *
 * Aquí no se decide nada irreversible: todo lo de esta pantalla se puede
 * seguir cambiando sobre el propio gráfico. Lo que hace es evitar el lienzo
 * en blanco, que es el problema real de un constructor genérico.
 */
export function BuilderSetup({ state }: { state: BuilderConfigState }) {
  const { settings, update, dimensions, measures, dateColumns } = state;

  const categoryOptions: Option[] = [
    ...(dateColumns.length > 0 ? [{ value: TIME_DIM, label: 'Tiempo (períodos)' }] : []),
    ...dimensions.map((column) => ({ value: column.name, label: column.name })),
  ];

  const seriesOptions: Option[] = [
    { value: NO_DIM, label: 'Una sola serie' },
    ...dimensions
      .filter((column) => column.name !== settings.categoryDim)
      .map((column) => ({ value: column.name, label: column.name })),
  ];

  const metricOptions: Option[] = [
    ...measures.map((column) => ({ value: column.name, label: column.name })),
    { value: COUNT_COLUMN, label: 'Número de filas' },
  ];

  const isCount = settings.metricColumn === COUNT_COLUMN;
  const isScatter = settings.kind === 'dispersion';

  return (
    <SetupCard
      title="Constructor de gráficos"
      description="Elige la forma y qué va en cada eje. Después podrás cambiarlo todo sobre el propio gráfico sin volver aquí."
    >
      <SetupField label="Tipo de gráfico">
        <ChartKindPicker
          value={settings.kind}
          onChange={(kind) => update({ kind })}
        />
      </SetupField>

      <SetupGrid>
        <SetupField
          label={isScatter ? 'Un punto por' : 'Eje de categorías'}
          hint={isScatter ? 'Cada categoría será un punto.' : 'Qué reparte los datos.'}
        >
          <OptionSelect
            value={settings.categoryDim}
            options={categoryOptions}
            ariaLabel="Eje de categorías"
            onChange={(value) => update({ categoryDim: value })}
          />
        </SetupField>

        <SetupField
          label={isScatter ? 'Eje X' : 'Métrica'}
          hint="La cifra que se dibuja."
        >
          <OptionSelect
            value={settings.metricColumn}
            options={metricOptions}
            ariaLabel="Métrica"
            onChange={(value) => update({ metricColumn: value })}
          />
        </SetupField>

        {isScatter ? (
          <SetupField label="Eje Y" hint="La segunda cifra, contra la que se compara.">
            <OptionSelect
              value={settings.metricYColumn}
              options={metricOptions}
              ariaLabel="Métrica del eje Y"
              onChange={(value) => update({ metricYColumn: value })}
            />
          </SetupField>
        ) : (
          <SetupField
            label="Series"
            hint={
              SUPPORTS_SERIES[settings.kind]
                ? 'Una línea o barra por cada valor.'
                : 'Este tipo de gráfico dibuja una sola serie.'
            }
          >
            <OptionSelect
              value={settings.seriesDim}
              options={seriesOptions}
              ariaLabel="Dimensión de las series"
              disabled={!SUPPORTS_SERIES[settings.kind]}
              onChange={(value) => update({ seriesDim: value })}
            />
          </SetupField>
        )}
      </SetupGrid>

      {settings.categoryDim === TIME_DIM && (
        <SetupGrid>
          <SetupField label="Columna de fecha">
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

          <SetupField label="Grano" hint="Ancho de cada punto del eje.">
            <OptionSelect
              value={settings.grain}
              options={GRAINS.map((grain) => ({
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
        <SetupField label="Agregación">
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

        <SetupField label="Formato">
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
      </div>
    </SetupCard>
  );
}
