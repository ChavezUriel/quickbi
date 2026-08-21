import { CURRENCIES, CURRENCY_LABEL } from '@/features/analysis/labels';
import type { Currency } from '@/features/analysis/types';
import { OptionSelect } from '../../components/option-select';
import { SetupCard, SetupField, SetupGrid } from '../../components/setup-card';
import { SlotPicker } from '../../components/slot-picker';
import { SEGMENTS_SLOTS, type SegmentsConfigState } from '../use-segments-config';

export function SegmentsSetup({ state }: { state: SegmentsConfigState }) {
  const { slots, settings, update } = state;

  return (
    <SetupCard
      title="Comparador de segmentos y análisis Mix-Shift"
      description="Compara dos grupos de datos (clientes, canales, periodos o regiones) frente a todas tus métricas y descompón la diferencia en efecto composición (mix) y efecto tasa (rendimiento)."
    >
      <SlotPicker slots={SEGMENTS_SLOTS} state={slots} />

      <div className="grid gap-4 border-t pt-4 sm:grid-cols-2 lg:grid-cols-3">
        <SetupField
          label="Nombre del Segmento A"
          hint="Etiqueta para el grupo base de comparación."
        >
          <input
            type="text"
            value={settings.segmentAName}
            onChange={(e) => update({ segmentAName: e.target.value })}
            placeholder="Segmento A"
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </SetupField>

        <SetupField
          label="Nombre del Segmento B"
          hint="Etiqueta para el grupo objetivo o variante."
        >
          <input
            type="text"
            value={settings.segmentBName}
            onChange={(e) => update({ segmentBName: e.target.value })}
            placeholder="Segmento B"
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </SetupField>

        <SetupField label="Moneda" hint="Cómo se leen las métricas monetarias.">
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
          En el cuadro de mando podrás seleccionar interactivamente qué categorías forman el
          Segmento A y el Segmento B mediante selectores visuales.
        </p>
      </SetupGrid>
    </SetupCard>
  );
}
