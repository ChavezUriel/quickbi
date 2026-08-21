import { CURRENCIES, CURRENCY_LABEL, GRANULARITY_LABEL } from '@/features/analysis/labels';
import type { Currency, Granularity } from '@/features/analysis/types';
import { OptionSelect } from '../../components/option-select';
import { SetupCard, SetupField, SetupGrid } from '../../components/setup-card';
import { SlotPicker } from '../../components/slot-picker';
import type { AnomalyMethod, AnomalySensitivity } from '../lib/anomalies';
import { ANOMALIES_SLOTS, type AnomaliesConfigState } from '../use-anomalies-config';

const METHODS: { value: AnomalyMethod; label: string }[] = [
  { value: 'rolling_zscore', label: 'Media móvil + Z-Score (Estándar)' },
  { value: 'rolling_median', label: 'Mediana móvil + MAD (Robusto a outliers)' },
  { value: 'iqr', label: 'Rango Intercuartil (IQR)' },
];

const SENSITIVITIES: { value: AnomalySensitivity; label: string }[] = [
  { value: 'muy_alta', label: 'Muy alta (1.5x - Detecta variaciones leves)' },
  { value: 'alta', label: 'Alta (2.0x - Recomendado para series normales)' },
  { value: 'media', label: 'Media (2.5x - Solo desvíos notorios)' },
  { value: 'baja', label: 'Baja (3.0x - Solo eventos extremos)' },
];

const WINDOW_SIZES = [
  { value: '7', label: '7 períodos' },
  { value: '14', label: '14 períodos' },
  { value: '30', label: '30 períodos' },
];

const GRAINS: { value: Granularity; label: string }[] = [
  { value: 'dia', label: GRANULARITY_LABEL.dia },
  { value: 'semana', label: GRANULARITY_LABEL.semana },
  { value: 'mes', label: GRANULARITY_LABEL.mes },
];

export function AnomaliesSetup({ state }: { state: AnomaliesConfigState }) {
  const { slots, settings, update } = state;

  return (
    <SetupCard
      title="Detección de anomalías en series de tiempo"
      description="Supervisa la evolución temporal identificando automáticamente picos inusuales y caídas bruscas mediante bandas estadísticas de confianza."
    >
      <SlotPicker slots={ANOMALIES_SLOTS} state={slots} />

      <div className="grid gap-4 border-t pt-4 sm:grid-cols-2 lg:grid-cols-3">
        <SetupField
          label="Método de detección"
          hint="Cómo se calcula el valor esperado y el intervalo normal."
        >
          <OptionSelect
            value={settings.method}
            options={METHODS}
            ariaLabel="Método de detección"
            onChange={(value) => update({ method: value as AnomalyMethod })}
          />
        </SetupField>

        <SetupField
          label="Sensibilidad del umbral"
          hint="Multiplicador de dispersión para considerar un punto como atípico."
        >
          <OptionSelect
            value={settings.sensitivity}
            options={SENSITIVITIES}
            ariaLabel="Sensibilidad del umbral"
            onChange={(value) => update({ sensitivity: value as AnomalySensitivity })}
          />
        </SetupField>

        <SetupField
          label="Ventana móvil"
          hint="Número de períodos utilizados para el cálculo de la media/mediana."
        >
          <OptionSelect
            value={String(settings.windowSize)}
            options={WINDOW_SIZES}
            ariaLabel="Ventana móvil"
            onChange={(value) => update({ windowSize: Number(value) })}
          />
        </SetupField>

        <SetupField label="Agrupación temporal" hint="Grano de análisis de la serie.">
          <OptionSelect
            value={settings.grain}
            options={GRAINS}
            ariaLabel="Agrupación temporal"
            onChange={(value) => update({ grain: value as Granularity })}
          />
        </SetupField>

        <SetupField label="Moneda / Formato" hint="Formato con el que se leen los valores.">
          <OptionSelect
            value={settings.currency}
            options={CURRENCIES.map((c) => ({ value: c, label: CURRENCY_LABEL[c] }))}
            ariaLabel="Moneda"
            onChange={(value) => update({ currency: value as Currency })}
          />
        </SetupField>
      </div>

      <SetupGrid>
        <p className="col-span-full text-xs text-pretty text-muted-foreground">
          Los puntos fuera de la banda de confianza se marcan con chinchetas de advertencia en el
          gráfico y se clasifican por severidad en la tabla inferior.
        </p>
      </SetupGrid>
    </SetupCard>
  );
}
