import { CURRENCIES, CURRENCY_LABEL } from '@/features/analysis/labels';
import type { Currency } from '@/features/analysis/types';
import { OptionSelect } from '../../components/option-select';
import { SetupCard, SetupField, SetupGrid } from '../../components/setup-card';
import { SlotPicker } from '../../components/slot-picker';
import {
  RECONCILIATION_SLOTS,
  type ReconciliationConfigState,
  type ReconciliationMode,
} from '../use-reconciliation-config';

const MODES: { value: ReconciliationMode; label: string }[] = [
  {
    value: 'dual_columns',
    label: 'Dos columnas de importe (ej. Importe Real vs Teórico)',
  },
  {
    value: 'source_dimension',
    label: 'Columna discriminadora de origen (ej. Banco vs ERP)',
  },
];

const TOLERANCES = [
  { value: '0', label: '0,00 (Coincidencia exacta al céntimo)' },
  { value: '0.01', label: '0,01 (Tolerancia estándar por redondeos)' },
  { value: '0.05', label: '0,05 (Margen de 5 céntimos)' },
  { value: '1', label: '1,00 (Margen de 1 unidad entera)' },
];

export function ReconciliationSetup({
  state,
}: {
  state: ReconciliationConfigState;
}) {
  const { slots, settings, update } = state;

  return (
    <SetupCard
      title="Conciliación de datos y cuadre de ficheros"
      description="Compara registros por clave identificadora, detecta descuadres de importe y localiza transacciones huérfanas presentes en solo una de las fuentes."
    >
      <SlotPicker slots={RECONCILIATION_SLOTS} state={slots} />

      <div className="grid gap-4 border-t pt-4 sm:grid-cols-2 lg:grid-cols-4">
        <SetupField
          label="Modo de comparación"
          hint="Cómo están organizadas las dos fuentes en los datos."
        >
          <OptionSelect
            value={settings.mode}
            options={MODES}
            ariaLabel="Modo de comparación"
            onChange={(value) => update({ mode: value as ReconciliationMode })}
          />
        </SetupField>

        {settings.mode === 'source_dimension' && (
          <>
            <SetupField
              label="Etiqueta Fuente A"
              hint="Texto exacto que identifica la Fuente A en la columna de origen."
            >
              <input
                type="text"
                placeholder="ej. Banco o Sistema 1"
                value={settings.sourceAValue}
                onChange={(e) => update({ sourceAValue: e.target.value })}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
              />
            </SetupField>

            <SetupField
              label="Etiqueta Fuente B"
              hint="Texto exacto que identifica la Fuente B en la columna de origen."
            >
              <input
                type="text"
                placeholder="ej. ERP o Contabilidad"
                value={settings.sourceBValue}
                onChange={(e) => update({ sourceBValue: e.target.value })}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
              />
            </SetupField>
          </>
        )}

        <SetupField
          label="Margen de tolerancia"
          hint="Diferencia máxima permitida para considerar exacto."
        >
          <OptionSelect
            value={String(settings.tolerance)}
            options={TOLERANCES}
            ariaLabel="Margen de tolerancia"
            onChange={(value) => update({ tolerance: Number(value) })}
          />
        </SetupField>

        <SetupField label="Moneda" hint="Moneda para importes y descuadres.">
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
          La conciliación clasifica cada registro automáticamente y calcula el descuadre
          neto y la discrepancia acumulada, facilitando auditorías financieras y operativas.
        </p>
      </SetupGrid>
    </SetupCard>
  );
}
