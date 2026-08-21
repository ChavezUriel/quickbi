import { CURRENCIES, CURRENCY_LABEL } from '@/features/analysis/labels';
import type { Currency } from '@/features/analysis/types';
import { OptionSelect } from '../../components/option-select';
import { SetupCard, SetupField, SetupGrid } from '../../components/setup-card';
import { SlotPicker } from '../../components/slot-picker';
import { CORRELATIONS_SLOTS, type CorrelationsConfigState } from '../use-correlations-config';

export function CorrelationsSetup({ state }: { state: CorrelationsConfigState }) {
  const { slots, settings, update, availableMeasures, selectedX, selectedY } = state;

  const measureOptions = availableMeasures.map((m) => ({
    value: m,
    label: m,
  }));

  return (
    <SetupCard
      title="Matriz de correlaciones"
      description="Analiza la relación lineal entre todas las variables numéricas de tu dataset y profundiza en pares con diagramas de dispersión y regresión."
    >
      <SlotPicker slots={CORRELATIONS_SLOTS} state={slots} />

      <div className="grid gap-4 border-t pt-4 sm:grid-cols-2 lg:grid-cols-3">
        <SetupField
          label="Variable X inicial"
          hint="Métrica para el eje horizontal del diagrama de dispersión."
        >
          <OptionSelect
            value={selectedX ?? ''}
            options={measureOptions}
            ariaLabel="Variable X"
            onChange={(value) => update({ selectedX: value })}
          />
        </SetupField>

        <SetupField
          label="Variable Y inicial"
          hint="Métrica para el eje vertical del diagrama de dispersión."
        >
          <OptionSelect
            value={selectedY ?? ''}
            options={measureOptions}
            ariaLabel="Variable Y"
            onChange={(value) => update({ selectedY: value })}
          />
        </SetupField>

        <SetupField label="Moneda" hint="Para dar formato adecuado a métricas monetarias.">
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
          El coeficiente de correlación de Pearson (r) oscila entre -1 (relación inversa
          perfecta) y +1 (relación directa perfecta). Valores cercanos a 0 indican ausencia de
          relación lineal.
        </p>
      </SetupGrid>
    </SetupCard>
  );
}
