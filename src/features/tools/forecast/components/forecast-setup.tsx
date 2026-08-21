import { CURRENCIES, CURRENCY_LABEL, GRANULARITIES, GRANULARITY_LABEL } from '@/features/analysis/labels';
import type { Currency, Granularity, MetricFormat } from '@/features/analysis/types';
import { OptionSelect } from '../../components/option-select';
import { SetupCard, SetupField, SetupGrid } from '../../components/setup-card';
import { SlotPicker } from '../../components/slot-picker';
import { FORECAST_SLOTS, type ForecastConfigState } from '../use-forecast-config';

const FORMAT_OPTIONS = [
  { value: 'moneda', label: 'Moneda' },
  { value: 'numero', label: 'Número' },
  { value: 'porcentaje', label: 'Porcentaje' },
];

const HORIZON_OPTIONS = [
  { value: '3', label: '3 períodos hacia adelante' },
  { value: '6', label: '6 períodos hacia adelante' },
  { value: '12', label: '12 períodos (1 año)' },
  { value: '24', label: '24 períodos (2 años)' },
];

const MODEL_OPTIONS = [
  { value: 'auto', label: 'Automático (Selección óptima)' },
  { value: 'holt-winters', label: 'Holt-Winters (Tendencia + Estacionalidad)' },
  { value: 'linear-seasonal', label: 'Regresión Lineal Estacional' },
];

const CONFIDENCE_OPTIONS = [
  { value: '95', label: '95% (Estándar recomendado)' },
  { value: '80', label: '80% (Banda más estrecha)' },
];

export function ForecastSetup({ state }: { state: ForecastConfigState }) {
  const { slots, settings, update } = state;

  return (
    <SetupCard
      title="Pronóstico y proyecciones"
      description="Proyecta el comportamiento futuro con modelos de series temporales (Holt-Winters / Regresión estacional), intervalos de confianza y validación retrospectiva (backtesting)."
    >
      <SlotPicker slots={FORECAST_SLOTS} state={slots} />

      <div className="grid gap-4 border-t pt-4 sm:grid-cols-2 lg:grid-cols-3">
        <SetupField label="Granularidad temporal" hint="Frecuencia de agregación de la serie.">
          <OptionSelect
            value={settings.grain}
            options={[...GRANULARITIES, 'anio'].map((g) => ({
              value: g,
              label: GRANULARITY_LABEL[g as Granularity] ?? g,
            }))}
            ariaLabel="Granularidad temporal"
            onChange={(val) => update({ grain: val as Granularity })}
          />
        </SetupField>

        <SetupField label="Horizonte de proyección" hint="Cuántos períodos futuros proyectar.">
          <OptionSelect
            value={String(settings.horizon)}
            options={HORIZON_OPTIONS}
            ariaLabel="Horizonte de proyección"
            onChange={(val) => update({ horizon: Number(val) })}
          />
        </SetupField>

        <SetupField label="Modelo estadístico" hint="Algoritmo de estimación.">
          <OptionSelect
            value={settings.model}
            options={MODEL_OPTIONS}
            ariaLabel="Modelo estadístico"
            onChange={(val) => update({ model: val as 'auto' | 'holt-winters' | 'linear-seasonal' })}
          />
        </SetupField>

        <SetupField label="Intervalo de confianza" hint="Nivel de certidumbre de las bandas.">
          <OptionSelect
            value={String(settings.confidenceLevel)}
            options={CONFIDENCE_OPTIONS}
            ariaLabel="Intervalo de confianza"
            onChange={(val) => update({ confidenceLevel: Number(val) as 80 | 95 })}
          />
        </SetupField>

        <SetupField label="Formato de la métrica" hint="Visualización de las cifras.">
          <OptionSelect
            value={settings.format}
            options={FORMAT_OPTIONS}
            ariaLabel="Formato de métrica"
            onChange={(val) => update({ format: val as MetricFormat })}
          />
        </SetupField>

        {settings.format === 'moneda' && (
          <SetupField label="Moneda" hint="Divisa para importes monetarios.">
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
      </div>

      <SetupGrid>
        <p className="col-span-full text-xs text-pretty text-muted-foreground">
          El motor calculará el ajuste histórico y evaluará el error MAPE y RMSE mediante backtesting para garantizar la confiabilidad estadística del pronóstico.
        </p>
      </SetupGrid>
    </SetupCard>
  );
}
