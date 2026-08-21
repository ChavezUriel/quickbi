import { CURRENCIES, CURRENCY_LABEL } from '@/features/analysis/labels';
import type { Currency, MetricFormat } from '@/features/analysis/types';
import { OptionSelect } from '../../components/option-select';
import { SetupCard, SetupField, SetupGrid } from '../../components/setup-card';
import { SlotPicker } from '../../components/slot-picker';
import { SEASONALITY_SLOTS, type SeasonalityConfigState } from '../use-seasonality-config';

const FORMAT_OPTIONS = [
  { value: 'moneda', label: 'Moneda' },
  { value: 'numero', label: 'Número' },
  { value: 'porcentaje', label: 'Porcentaje' },
];

const AGG_OPTIONS = [
  { value: 'sum', label: 'Suma total diaria' },
  { value: 'avg', label: 'Promedio diario' },
];

const WINDOW_OPTIONS = [
  { value: '7', label: '7 días (1 semana)' },
  { value: '14', label: '14 días (2 semanas)' },
  { value: '30', label: '30 días (1 mes)' },
  { value: '60', label: '60 días (2 meses)' },
];

export function SeasonalitySetup({ state }: { state: SeasonalityConfigState }) {
  const { slots, settings, update } = state;

  return (
    <SetupCard
      title="Análisis de estacionalidad"
      description="Descubre patrones recurrentes por día de la semana, mes del año, medias móviles y mapas de calor diarios."
    >
      <SlotPicker slots={SEASONALITY_SLOTS} state={slots} />

      <div className="grid gap-4 border-t pt-4 sm:grid-cols-2 lg:grid-cols-4">
        <SetupField label="Formato de la métrica" hint="Visualización de importes o conteos.">
          <OptionSelect
            value={settings.format}
            options={FORMAT_OPTIONS}
            ariaLabel="Formato de métrica"
            onChange={(val) => update({ format: val as MetricFormat })}
          />
        </SetupField>

        {settings.format === 'moneda' && (
          <SetupField label="Moneda" hint="Divisa para valores económicos.">
            <OptionSelect
              value={settings.currency}
              options={CURRENCIES.map((cur) => ({
                value: cur,
                label: CURRENCY_LABEL[cur],
              }))}
              ariaLabel="Moneda"
              onChange={(val) => update({ currency: val as Currency })}
            />
          </SetupField>
        )}

        <SetupField label="Agregación diaria" hint="Cómo combinar múltiples filas del mismo día.">
          <OptionSelect
            value={settings.agg}
            options={AGG_OPTIONS}
            ariaLabel="Agregación diaria"
            onChange={(val) => update({ agg: val as 'sum' | 'avg' })}
          />
        </SetupField>

        <SetupField label="Ventana de media móvil" hint="Suavizado de la tendencia general.">
          <OptionSelect
            value={String(settings.movingAvgWindow)}
            options={WINDOW_OPTIONS}
            ariaLabel="Ventana de media móvil"
            onChange={(val) => update({ movingAvgWindow: Number(val) })}
          />
        </SetupField>
      </div>

      <SetupGrid>
        <p className="col-span-full text-xs text-pretty text-muted-foreground">
          El análisis identificará automáticamente picos y valles recurrentes, el sesgo entre días laborables y fines de semana, y los índices estacionales base 100.
        </p>
      </SetupGrid>
    </SetupCard>
  );
}
