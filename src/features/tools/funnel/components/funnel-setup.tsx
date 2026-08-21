import { CURRENCIES, CURRENCY_LABEL } from '@/features/analysis/labels';
import type { Currency } from '@/features/analysis/types';
import { OptionSelect } from '../../components/option-select';
import { SetupCard, SetupField, SetupGrid } from '../../components/setup-card';
import { SlotPicker } from '../../components/slot-picker';
import {
  FUNNEL_SLOTS,
  type FunnelConfigState,
} from '../use-funnel-config';
import type { FunnelAggregation } from '../lib/funnel';

const AGGREGATION_OPTIONS: { value: FunnelAggregation; label: string }[] = [
  { value: 'count', label: 'Contar registros por etapa' },
  { value: 'sum', label: 'Sumar métrica numérica seleccionada' },
  { value: 'count_distinct', label: 'Contar IDs únicos (usuarios/leads)' },
];

export function FunnelSetup({ state }: { state: FunnelConfigState }) {
  const { slots, settings, update } = state;

  return (
    <SetupCard
      title="Embudo de conversión"
      description="Analiza la pérdida de usuarios o volumen paso a paso, detecta cuellos de botella y mide la tasa de conversión en cada fase."
    >
      <SlotPicker slots={FUNNEL_SLOTS} state={slots} />

      <div className="grid gap-4 border-t pt-4 sm:grid-cols-2 lg:grid-cols-3">
        <SetupField
          label="Modo de cálculo"
          hint="Cómo cuantificar el volumen que pasa por cada fase del embudo."
        >
          <OptionSelect
            value={settings.aggregation}
            options={AGGREGATION_OPTIONS}
            ariaLabel="Modo de cálculo"
            onChange={(value) => update({ aggregation: value as FunnelAggregation })}
          />
        </SetupField>

        {settings.aggregation === 'sum' && (
          <SetupField label="Moneda" hint="Símbolo para representar importes en el cuadro.">
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

      <SetupGrid>
        <p className="col-span-full text-xs text-pretty text-muted-foreground">
          El embudo detectará automáticamente la etapa con mayor tasa de abandono y
          calculará la retención paso a paso y respecto a la entrada inicial.
        </p>
      </SetupGrid>
    </SetupCard>
  );
}
