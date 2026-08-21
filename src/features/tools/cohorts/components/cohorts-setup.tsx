import { CURRENCIES, CURRENCY_LABEL } from '@/features/analysis/labels';
import type { Currency, Granularity } from '@/features/analysis/types';
import { OptionSelect } from '../../components/option-select';
import { SetupCard, SetupField, SetupGrid } from '../../components/setup-card';
import { SlotPicker } from '../../components/slot-picker';
import { COHORTS_SLOTS, type CohortsConfigState } from '../use-cohorts-config';

const GRAINS: { value: Granularity; label: string }[] = [
  { value: 'mes', label: 'Mensual (Recomendado)' },
  { value: 'semana', label: 'Semanal' },
  { value: 'trimestre', label: 'Trimestral' },
];

const METRIC_TYPES = [
  { value: 'clientes', label: 'Retención de clientes (% que vuelve)' },
  { value: 'ingresos', label: 'Retención de ingresos (Gasto posterior)' },
];

const DISPLAY_MODES = [
  { value: 'porcentaje', label: 'Porcentaje (%)' },
  { value: 'absoluto', label: 'Valores absolutos (Clientes / Importe)' },
];

export function CohortsSetup({ state }: { state: CohortsConfigState }) {
  const { slots, settings, update } = state;

  return (
    <SetupCard
      title="Cohortes de retención"
      description="Mide la retención de clientes e ingresos agrupándolos por el período de su primera compra (matriz triangular de calor)."
    >
      <SlotPicker slots={COHORTS_SLOTS} state={slots} />

      <div className="grid gap-4 border-t pt-4 sm:grid-cols-2 lg:grid-cols-4">
        <SetupField
          label="Agrupación de cohortes"
          hint="Período temporal para agrupar las altas de clientes."
        >
          <OptionSelect
            value={settings.grain}
            options={GRAINS}
            ariaLabel="Agrupación de cohortes"
            onChange={(value) => update({ grain: value as Granularity })}
          />
        </SetupField>

        <SetupField
          label="Métrica principal"
          hint="Qué magnitud se evalúa en los períodos posteriores."
        >
          <OptionSelect
            value={settings.metricType}
            options={METRIC_TYPES}
            ariaLabel="Métrica principal"
            onChange={(value) => update({ metricType: value as 'clientes' | 'ingresos' })}
          />
        </SetupField>

        <SetupField
          label="Modo de visualización"
          hint="Mostrar como porcentaje de retención o valores absolutos."
        >
          <OptionSelect
            value={settings.displayMode}
            options={DISPLAY_MODES}
            ariaLabel="Modo de visualización"
            onChange={(value) => update({ displayMode: value as 'porcentaje' | 'absoluto' })}
          />
        </SetupField>

        <SetupField label="Moneda" hint="Moneda para los importes e ingresos retenidos.">
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
          La matriz de retención coloca cada cohorte en una fila (mes de adquisición) y los períodos
          transcurridos (M0, M1, M2...) en columnas, iluminando la intensidad de repetición de
          compra.
        </p>
      </SetupGrid>
    </SetupCard>
  );
}
