import { CURRENCIES, CURRENCY_LABEL } from '@/features/analysis/labels';
import type { Currency } from '@/features/analysis/types';
import { OptionSelect } from '../../components/option-select';
import { SetupCard, SetupField, SetupGrid } from '../../components/setup-card';
import { SlotPicker } from '../../components/slot-picker';
import { RFM_SLOTS, type ReferenceMode, type RfmConfigState } from '../use-rfm-config';

const REFERENCE_MODES: { value: ReferenceMode; label: string }[] = [
  { value: 'dataset', label: 'Último día del dataset' },
  { value: 'hoy', label: 'Hoy' },
  { value: 'personalizada', label: 'Una fecha concreta' },
];

/**
 * Qué columna hace de cliente, de fecha y de importe.
 *
 * Llega todo propuesto por el nombre de las columnas, así que lo habitual es
 * no tocar nada. Lo que sí conviene mirar es el día de referencia: medir la
 * recencia contra hoy en un fichero de hace un año pinta a toda la cartera
 * como perdida.
 */
export function RfmSetup({ state }: { state: RfmConfigState }) {
  const { slots, settings, update } = state;

  return (
    <SetupCard
      title="Matriz RFM"
      description="Segmenta la cartera por lo reciente, lo frecuente y lo que gasta cada cliente. Necesita saber qué columna es cada cosa."
    >
      <SlotPicker slots={RFM_SLOTS} state={slots} />

      <div className="grid gap-4 border-t pt-4 sm:grid-cols-2 lg:grid-cols-3">
        <SetupField
          label="Medir la recencia desde"
          hint="El día contra el que se cuenta «cuánto hace de su última compra»."
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
              onChange={(event) => update({ referenceDay: event.target.value })}
              aria-label="Fecha de referencia"
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            />
          </SetupField>
        )}

        <SetupField label="Moneda" hint="Cómo se leen los importes de la cartera.">
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
          Las notas de 1 a 5 salen de comparar cada cliente con el resto de la cartera,
          no con umbrales fijos: «hace 40 días» es reciente en un negocio y una eternidad
          en otro, y solo tus propios datos saben cuál es cuál.
        </p>
      </SetupGrid>
    </SetupCard>
  );
}
