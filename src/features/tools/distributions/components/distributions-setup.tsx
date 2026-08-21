import { CURRENCIES, CURRENCY_LABEL } from '@/features/analysis/labels';
import type { Currency } from '@/features/analysis/types';
import { OptionSelect } from '../../components/option-select';
import { SetupCard, SetupField, SetupGrid } from '../../components/setup-card';
import { SlotPicker } from '../../components/slot-picker';
import { DISTRIBUTIONS_SLOTS, type DistributionsConfigState } from '../use-distributions-config';

const BIN_OPTIONS = [
  { value: 'auto', label: 'Automático (Freedman-Diaconis)' },
  { value: '5', label: '5 intervalos' },
  { value: '10', label: '10 intervalos' },
  { value: '15', label: '15 intervalos' },
  { value: '20', label: '20 intervalos' },
  { value: '30', label: '30 intervalos' },
  { value: '50', label: '50 intervalos' },
];

export function DistributionsSetup({ state }: { state: DistributionsConfigState }) {
  const { slots, settings, update } = state;

  return (
    <SetupCard
      title="Distribución y valores atípicos"
      description="Examina la dispersión, cuartiles, simetría y anomalías de una variable numérica con histograma dinámico y diagramas de caja (boxplots)."
    >
      <SlotPicker slots={DISTRIBUTIONS_SLOTS} state={slots} />

      <div className="grid gap-4 border-t pt-4 sm:grid-cols-2 lg:grid-cols-3">
        <SetupField
          label="Número de intervalos (Bins)"
          hint="Cómo de fino se divide el eje en el histograma."
        >
          <OptionSelect
            value={settings.binCount}
            options={BIN_OPTIONS}
            ariaLabel="Número de intervalos"
            onChange={(value) => update({ binCount: value })}
          />
        </SetupField>

        <SetupField label="Moneda" hint="Para dar formato a los valores si son importes.">
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
      </div>

      <SetupGrid>
        <p className="col-span-full text-xs text-pretty text-muted-foreground">
          Los valores atípicos se identifican según la regla de Tukey: cualquier observación
          situada a más de 1.5 veces el rango intercuartílico (IQR = Q3 - Q1) respecto a los
          cuartiles.
        </p>
      </SetupGrid>
    </SetupCard>
  );
}
