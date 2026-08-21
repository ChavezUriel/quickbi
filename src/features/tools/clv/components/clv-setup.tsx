import { CURRENCIES, CURRENCY_LABEL } from '@/features/analysis/labels';
import type { Currency } from '@/features/analysis/types';
import { OptionSelect } from '../../components/option-select';
import { SetupCard, SetupField, SetupGrid } from '../../components/setup-card';
import { SlotPicker } from '../../components/slot-picker';
import { CLV_SLOTS, type ClvConfigState, type ReferenceMode } from '../use-clv-config';

const CHURN_OPTIONS = [
  { value: '90', label: '90 días (~3 meses)' },
  { value: '180', label: '180 días (~6 meses - Estándar)' },
  { value: '365', label: '365 días (~1 año)' },
];

const MARGIN_OPTIONS = [
  { value: '1.0', label: '100 % (Ingresos brutos)' },
  { value: '0.5', label: '50 % de margen' },
  { value: '0.3', label: '30 % de margen' },
  { value: '0.2', label: '20 % de margen' },
];

const PROJECTION_OPTIONS = [
  { value: '1', label: '1 año' },
  { value: '2', label: '2 años' },
  { value: '3', label: '3 años' },
];

const REFERENCE_MODES: { value: ReferenceMode; label: string }[] = [
  { value: 'dataset', label: 'Último día del dataset' },
  { value: 'hoy', label: 'Hoy' },
  { value: 'personalizada', label: 'Una fecha concreta' },
];

export function ClvSetup({ state }: { state: ClvConfigState }) {
  const { slots, settings, update } = state;

  return (
    <SetupCard
      title="Valor de vida del cliente (CLV)"
      description="Calcula el valor histórico de cada cliente, ticket medio (AOV), frecuencia de compra, vida media y distribución por deciles."
    >
      <SlotPicker slots={CLV_SLOTS} state={slots} />

      <div className="grid gap-4 border-t pt-4 sm:grid-cols-2 lg:grid-cols-3">
        <SetupField
          label="Umbral de inactividad (Churn)"
          hint="Días sin compras para considerar a un cliente en riesgo o perdido."
        >
          <OptionSelect
            value={String(settings.churnDays)}
            options={CHURN_OPTIONS}
            ariaLabel="Umbral de inactividad"
            onChange={(value) => update({ churnDays: Number(value) })}
          />
        </SetupField>

        <SetupField
          label="Margen bruto estimado"
          hint="Porcentaje de margen aplicado al cálculo del CLV proyectado."
        >
          <OptionSelect
            value={String(settings.marginRate)}
            options={MARGIN_OPTIONS}
            ariaLabel="Margen bruto"
            onChange={(value) => update({ marginRate: Number(value) })}
          />
        </SetupField>

        <SetupField
          label="Horizonte de proyección"
          hint="Años futuros para estimar el valor adicional del cliente."
        >
          <OptionSelect
            value={String(settings.projectionYears)}
            options={PROJECTION_OPTIONS}
            ariaLabel="Horizonte de proyección"
            onChange={(value) => update({ projectionYears: Number(value) })}
          />
        </SetupField>

        <SetupField
          label="Medir la recencia desde"
          hint="Fecha de referencia para calcular los días inactivo."
        >
          <OptionSelect
            value={settings.referenceMode}
            options={REFERENCE_MODES}
            ariaLabel="Día de referencia"
            onChange={(value) => update({ referenceMode: value as ReferenceMode })}
          />
        </SetupField>

        {settings.referenceMode === 'personalizada' && (
          <SetupField label="Fecha de referencia">
            <input
              type="date"
              value={settings.referenceDay}
              onChange={(e) => update({ referenceDay: e.target.value })}
              aria-label="Fecha de referencia"
              className="h-8 w-full rounded-md border border-input bg-transparent px-2.5 text-sm"
            />
          </SetupField>
        )}

        <SetupField label="Moneda" hint="Moneda con la que se expresan los importes.">
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
          La segmentación por deciles (D1 a D10) agrupa a los clientes en 10 partes iguales según su
          gasto acumulado, permitiendo ver qué porcentaje de los ingresos depende del Top 10% y Top 20%.
        </p>
      </SetupGrid>
    </SetupCard>
  );
}
