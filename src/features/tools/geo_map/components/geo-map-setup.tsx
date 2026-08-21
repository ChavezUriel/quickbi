import { CURRENCIES, CURRENCY_LABEL, METRIC_FORMAT_LABEL } from '@/features/analysis/labels';
import type { Currency, MetricFormat } from '@/features/analysis/types';
import { OptionSelect } from '../../components/option-select';
import { SetupCard, SetupField, SetupGrid } from '../../components/setup-card';
import { SlotPicker } from '../../components/slot-picker';
import {
  GEO_MAP_SLOTS,
  type GeoMapConfigState,
} from '../use-geo-map-config';
import type { GeoAggregation } from '../lib/geo_map';

const AGGREGATIONS: { value: GeoAggregation; label: string }[] = [
  { value: 'sum', label: 'Sumar valores por territorio' },
  { value: 'avg', label: 'Promediar valores por territorio' },
  { value: 'count', label: 'Contar registros por territorio' },
];

const TOP_N_OPTIONS = [
  { value: '0', label: 'Todos los territorios' },
  { value: '10', label: 'Top 10 territorios' },
  { value: '20', label: 'Top 20 territorios' },
  { value: '50', label: 'Top 50 territorios' },
];

const FORMAT_OPTIONS: { value: MetricFormat; label: string }[] = [
  { value: 'moneda', label: METRIC_FORMAT_LABEL.moneda },
  { value: 'numero', label: METRIC_FORMAT_LABEL.numero },
  { value: 'porcentaje', label: METRIC_FORMAT_LABEL.porcentaje },
];

export function GeoMapSetup({ state }: { state: GeoMapConfigState }) {
  const { slots, settings, update } = state;

  return (
    <SetupCard
      title="Mapa geográfico y análisis territorial"
      description="Agrupa y analiza métricas por país, región, provincia o ciudad. Calcula concentración regional y ranking territorial de forma 100% offline."
    >
      <SlotPicker slots={GEO_MAP_SLOTS} state={slots} />

      <div className="grid gap-4 border-t pt-4 sm:grid-cols-2 lg:grid-cols-4">
        <SetupField
          label="Operación de cálculo"
          hint="Cómo agregar la métrica numérica."
        >
          <OptionSelect
            value={settings.aggregation}
            options={AGGREGATIONS}
            ariaLabel="Operación"
            onChange={(value) => update({ aggregation: value as GeoAggregation })}
          />
        </SetupField>

        <SetupField label="Formato de la métrica">
          <OptionSelect
            value={settings.format}
            options={FORMAT_OPTIONS}
            ariaLabel="Formato de métrica"
            onChange={(value) => update({ format: value as MetricFormat })}
          />
        </SetupField>

        {settings.format === 'moneda' && (
          <SetupField label="Moneda" hint="Moneda para importes territoriales.">
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

        <SetupField
          label="Alcance / Límite"
          hint="Filtrar por los territorios con mayor volumen."
        >
          <OptionSelect
            value={String(settings.topN)}
            options={TOP_N_OPTIONS}
            ariaLabel="Límite de territorios"
            onChange={(value) => update({ topN: Number(value) })}
          />
        </SetupField>
      </div>

      <SetupGrid>
        <p className="col-span-full text-xs text-pretty text-muted-foreground">
          El análisis reconoce automáticamente nombres y códigos ISO de países,
          comunidades autónomas españolas, estados latinoamericanos y principales regiones globales,
          agrupándolos en zonas territoriales sin depender de conexiones a internet.
        </p>
      </SetupGrid>
    </SetupCard>
  );
}
