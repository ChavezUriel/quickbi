import { CURRENCIES, CURRENCY_LABEL } from '@/features/analysis/labels';
import type { Currency } from '@/features/analysis/types';
import { OptionSelect } from '../../components/option-select';
import { SetupCard, SetupField, SetupGrid } from '../../components/setup-card';
import { SlotPicker } from '../../components/slot-picker';
import {
  INVENTORY_SLOTS,
  type InventoryConfigState,
  type InventoryRefMode,
} from '../use-inventory-config';

const PERIOD_OPTIONS = [
  { value: '30', label: '30 días (Mensual)' },
  { value: '90', label: '90 días (Trimestral)' },
  { value: '180', label: '180 días (Semestral)' },
  { value: '365', label: '365 días (Anual)' },
];

const REF_MODES: { value: InventoryRefMode; label: string }[] = [
  { value: 'dataset', label: 'Última fecha del dataset' },
  { value: 'hoy', label: 'Hoy' },
  { value: 'personalizada', label: 'Fecha específica' },
];

export function InventorySetup({ state }: { state: InventoryConfigState }) {
  const { slots, settings, update } = state;

  return (
    <SetupCard
      title="Rotación de inventario y antigüedad"
      description="Analiza la velocidad de salida de los productos, calcula el ratio de rotación y DSI, y segmenta el stock por tramos de antigüedad para detectar stock muerto."
    >
      <SlotPicker slots={INVENTORY_SLOTS} state={slots} />

      <div className="grid gap-4 border-t pt-4 sm:grid-cols-2 lg:grid-cols-4">
        <SetupField
          label="Período de análisis de ventas"
          hint="Horizonte temporal para anualizar el ratio de rotación."
        >
          <OptionSelect
            value={String(settings.periodDays)}
            options={PERIOD_OPTIONS}
            ariaLabel="Período"
            onChange={(value) => update({ periodDays: Number(value) })}
          />
        </SetupField>

        <SetupField label="Moneda" hint="Moneda para valorar existencias y ventas.">
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
          label="Referencia de antigüedad"
          hint="Desde cuándo contar los días de inventario."
        >
          <OptionSelect
            value={settings.referenceMode}
            options={REF_MODES}
            ariaLabel="Referencia de antigüedad"
            onChange={(value) => update({ referenceMode: value as InventoryRefMode })}
          />
        </SetupField>

        {settings.referenceMode === 'personalizada' && (
          <SetupField label="Fecha de referencia">
            <input
              type="date"
              value={settings.referenceDay}
              onChange={(e) => update({ referenceDay: e.target.value })}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            />
          </SetupField>
        )}
      </div>

      <SetupGrid>
        <p className="col-span-full text-xs text-pretty text-muted-foreground">
          Los productos sin ventas en el período o con más de 90 días en almacén se catalogan
          automáticamente como <b>stock muerto</b> para facilitar decisiones de rebajas y liquidación.
        </p>
      </SetupGrid>
    </SetupCard>
  );
}
