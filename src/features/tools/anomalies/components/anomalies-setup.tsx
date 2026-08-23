import { CURRENCIES, CURRENCY_LABEL, GRANULARITY_LABEL } from '@/features/analysis/labels';
import type { Currency, Granularity } from '@/features/analysis/types';
import { OptionSelect } from '../../components/option-select';
import { SetupCard, SetupField, SetupNote } from '../../components/setup-card';
import { SlotPicker } from '../../components/slot-picker';
import type { AnomalyAgg, AnomalyMethod, AnomalySensitivity } from '../lib/anomalies';
import { ANOMALIES_SLOTS, type AnomaliesConfigState } from '../use-anomalies-config';

const AGG_OPTIONS: { value: AnomalyAgg; label: string }[] = [
  { value: 'sum', label: 'Suma total por período' },
  { value: 'avg', label: 'Promedio por período' },
  { value: 'count', label: 'Recuento de registros' },
];

const METHODS: { value: AnomalyMethod; label: string }[] = [
  { value: 'rolling_zscore', label: 'Media móvil + Z-Score (Estándar)' },
  { value: 'rolling_median', label: 'Mediana móvil + MAD (Robusto)' },
  { value: 'iqr', label: 'Rango Intercuartil (IQR)' },
];

const SENSITIVITIES: { value: AnomalySensitivity; label: string }[] = [
  { value: 'muy_alta', label: 'Muy alta (1.5x - Detecta leves)' },
  { value: 'alta', label: 'Alta (2.0x - Recomendado)' },
  { value: 'media', label: 'Media (2.5x - Solo notorios)' },
  { value: 'baja', label: 'Baja (3.0x - Solo extremos)' },
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

      <div className="grid gap-4 border-t border-border/80 pt-4 sm:grid-cols-2 lg:grid-cols-4">
        <SetupField
          label="Método de detección"
          hint="Cómo se calcula el valor esperado."
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
          hint="Multiplicador de dispersión para atípicos."
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
          hint="Número de períodos para media o mediana."
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

        <SetupField label="Agregación de la métrica" hint="Cómo combinar los registros en cada período.">
          <OptionSelect
            value={settings.agg}
            options={AGG_OPTIONS}
            ariaLabel="Agregación de la métrica"
            onChange={(value) => update({ agg: value as AnomalyAgg })}
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

      <SetupNote>
        Los puntos fuera de la banda de confianza se marcan con chinchetas de advertencia en el
        gráfico y se clasifican por severidad en la tabla inferior.
      </SetupNote>
    </SetupCard>
  );
}

