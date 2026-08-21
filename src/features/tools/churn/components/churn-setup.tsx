import { CURRENCIES, CURRENCY_LABEL, GRANULARITIES, GRANULARITY_LABEL } from '@/features/analysis/labels';
import type { Currency, Granularity } from '@/features/analysis/types';
import { OptionSelect } from '../../components/option-select';
import { SetupCard, SetupField, SetupGrid } from '../../components/setup-card';
import { SlotPicker } from '../../components/slot-picker';
import { CHURN_SLOTS, type ChurnConfigState } from '../use-churn-config';

const GRAINS: Granularity[] = [...GRANULARITIES, 'anio'];

export function ChurnSetup({ state }: { state: ChurnConfigState }) {
  const { slots, settings, update } = state;

  return (
    <SetupCard
      title="Movimiento de clientes y Churn"
      description="Analiza la entrada y salida de clientes período a período: nuevos, recurrentes, reactivados y perdidos, y el impacto directo en tus ingresos."
    >
      <SlotPicker slots={CHURN_SLOTS} state={slots} />

      <SetupGrid>
        <SetupField
          label="Período de análisis"
          hint="Cada cuánto tiempo se agrupa la actividad para medir la retención."
        >
          <OptionSelect
            value={settings.grain}
            options={GRAINS.map((grain) => ({
              value: grain,
              label: GRANULARITY_LABEL[grain],
            }))}
            ariaLabel="Período de análisis"
            onChange={(value) => update({ grain: value as Granularity })}
          />
        </SetupField>

        <SetupField label="Moneda" hint="Cómo se expresan los importes de ingresos.">
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
      </SetupGrid>

      <SetupGrid>
        <p className="col-span-full text-xs text-pretty text-muted-foreground">
          Un Quick Ratio superior a 1 indica crecimiento neto (entran más clientes o ingresos
          de los que se pierden). En modelos de suscripción y SaaS, un valor superior a 2–4 es
          considerado óptimo.
        </p>
      </SetupGrid>
    </SetupCard>
  );
}
