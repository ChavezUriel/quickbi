import { CURRENCIES, CURRENCY_LABEL } from '@/features/analysis/labels';
import type { Currency } from '@/features/analysis/types';
import { OptionSelect } from '../../components/option-select';
import { SetupCard, SetupField, SetupGrid } from '../../components/setup-card';
import { SlotPicker } from '../../components/slot-picker';
import { CONCENTRATION_SLOTS, type ConcentrationConfigState } from '../use-concentration-config';

const TOP_LIMITS = [
  { value: '10', label: 'Top 10 clientes' },
  { value: '20', label: 'Top 20 clientes (Recomendado)' },
  { value: '50', label: 'Top 50 clientes' },
  { value: '100', label: 'Top 100 clientes' },
];

export function ConcentrationSetup({ state }: { state: ConcentrationConfigState }) {
  const { slots, settings, update } = state;

  return (
    <SetupCard
      title="Concentración de clientes y Riesgo de cartera"
      description="Mide el grado de dependencia de tus mayores cuentas mediante la curva de Lorenz, el coeficiente de Gini y el índice Herfindahl-Hirschman (HHI)."
    >
      <SlotPicker slots={CONCENTRATION_SLOTS} state={slots} />

      <SetupGrid>
        <SetupField label="Moneda" hint="Cómo se expresan las cifras de facturación.">
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

        <SetupField
          label="Visualización del ranking"
          hint="Cuántos clientes principales mostrar en el detalle inicial."
        >
          <OptionSelect
            value={String(settings.topLimit)}
            options={TOP_LIMITS}
            ariaLabel="Límite del ranking"
            onChange={(value) => update({ topLimit: Number(value) })}
          />
        </SetupField>
      </SetupGrid>

      <SetupGrid>
        <p className="col-span-full text-xs text-pretty text-muted-foreground">
          <b>Coeficiente de Gini:</b> Varía de 0 (igualdad total, todos los clientes facturan lo mismo)
          a 1 (concentración extrema en un solo cliente). Un Gini superior a 0,7 o un índice HHI superior
          a 2.500 indican vulnerabilidad financiera ante bajas de clientes clave.
        </p>
      </SetupGrid>
    </SetupCard>
  );
}
