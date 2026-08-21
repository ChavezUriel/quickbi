import { CURRENCIES, CURRENCY_LABEL } from '@/features/analysis/labels';
import type { Currency, MetricFormat } from '@/features/analysis/types';
import { OptionSelect } from '../../components/option-select';
import { SetupCard, SetupField, SetupGrid } from '../../components/setup-card';
import { SlotPicker } from '../../components/slot-picker';
import { SPC_SLOTS, type SpcConfigState } from '../use-spc-config';

const FORMAT_OPTIONS = [
  { value: 'numero', label: 'Número' },
  { value: 'moneda', label: 'Moneda' },
  { value: 'porcentaje', label: 'Porcentaje' },
];

const SIGMA_OPTIONS = [
  { value: 'moving-range', label: 'Rango móvil (MR / d₂) — Estándar Shewhart' },
  { value: 'sample-stddev', label: 'Desviación estándar muestral (s)' },
];

export function SpcSetup({ state }: { state: SpcConfigState }) {
  const { slots, settings, update } = state;

  return (
    <SetupCard
      title="Control estadístico de proceso (SPC)"
      description="Gráfica de control Shewhart con Línea Central (Media), Límites UCL/LCL (±3σ), Zonas de advertencia y detección de violaciones a las reglas de Western Electric / Nelson."
    >
      <SlotPicker slots={SPC_SLOTS} state={slots} />

      <div className="grid gap-4 border-t pt-4 sm:grid-cols-2 lg:grid-cols-3">
        <SetupField
          label="Estimación de dispersión (σ)"
          hint="Método para calcular la desviación típica del proceso."
        >
          <OptionSelect
            value={settings.sigmaMethod}
            options={SIGMA_OPTIONS}
            ariaLabel="Método de Sigma"
            onChange={(val) =>
              update({ sigmaMethod: val as 'moving-range' | 'sample-stddev' })
            }
          />
        </SetupField>

        <SetupField label="Formato numérico" hint="Cómo visualizar los valores y límites.">
          <OptionSelect
            value={settings.format}
            options={FORMAT_OPTIONS}
            ariaLabel="Formato numérico"
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
      </div>

      <SetupGrid>
        <p className="col-span-full text-xs text-pretty text-muted-foreground">
          El sistema evalúa continuamente 8 reglas estadísticas para detectar causas especiales de variación: puntos fuera de 3σ, desplazamientos de media, tendencias monótonas y estratificación.
        </p>
      </SetupGrid>
    </SetupCard>
  );
}
