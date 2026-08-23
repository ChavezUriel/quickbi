import { CURRENCIES, CURRENCY_LABEL } from '@/features/analysis/labels';
import type { Currency } from '@/features/analysis/types';
import { OptionSelect } from '../../components/option-select';
import { SetupCard, SetupField, SetupNote } from '../../components/setup-card';
import { SlotPicker } from '../../components/slot-picker';
import { PARETO_SLOTS, type ParetoConfigState } from '../use-pareto-config';

const THRESHOLD_PRESETS = [
  { value: '80-95', label: '80 / 15 / 5 % (Regla clásica de Pareto)' },
  { value: '70-90', label: '70 / 20 / 10 % (Clasificación conservadora)' },
  { value: '85-98', label: '85 / 13 / 2 % (Alta concentración)' },
];

export function ParetoSetup({ state }: { state: ParetoConfigState }) {
  const { slots, settings, update } = state;

  const currentPreset = `${settings.thresholdA}-${settings.thresholdB}`;

  const handlePresetChange = (val: string) => {
    const [aStr, bStr] = val.split('-');
    const a = parseInt(aStr ?? '80', 10);
    const b = parseInt(bStr ?? '95', 10);
    update({ thresholdA: a, thresholdB: b });
  };

  return (
    <SetupCard
      title="Curva de Pareto y Clasificación ABC (80/20)"
      description="Identifica el 20 % de productos, clientes o referencias que concentran el 80 % de tus ingresos o volumen, y optimiza el foco en tu catálogo."
    >
      <SlotPicker slots={PARETO_SLOTS} state={slots} />

      <div className="grid gap-4 border-t border-border/80 pt-4 sm:grid-cols-2 lg:grid-cols-3">
        <SetupField
          label="Bandas de clasificación ABC"
          hint="Límites de corte para Clase A (foco estratégico), B y C."
        >
          <OptionSelect
            value={currentPreset}
            options={THRESHOLD_PRESETS}
            ariaLabel="Bandas ABC"
            onChange={handlePresetChange}
          />
        </SetupField>

        <SetupField label="Moneda" hint="Cómo se expresan los valores monetarios.">
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

      <SetupNote>
        La <strong>Clase A</strong> representa los elementos críticos que generan la gran mayoría del
        valor. La <strong>Clase B</strong> tiene un impacto moderado, y la <strong>Clase C</strong> agrupa la
        larga cola de baja contribución individual.
      </SetupNote>
    </SetupCard>
  );
}
