import { CURRENCIES, CURRENCY_LABEL } from '@/features/analysis/labels';
import type { Currency } from '@/features/analysis/types';
import { OptionSelect } from '../../components/option-select';
import { SetupCard, SetupField, SetupGrid } from '../../components/setup-card';
import { SlotPicker } from '../../components/slot-picker';
import { PRICE_VOLUME_SLOTS, type PriceVolumeConfigState } from '../use-price-volume-config';

const PRICE_TYPE_OPTIONS = [
  {
    value: 'importe_total',
    label: 'Importe total de la fila (Facturación)',
  },
  {
    value: 'precio_unitario',
    label: 'Precio unitario por artículo',
  },
];

export function PriceVolumeSetup({ state }: { state: PriceVolumeConfigState }) {
  const { slots, settings, update } = state;

  return (
    <SetupCard
      title="Precio vs Volumen y Elasticidad (PVM)"
      description="Analiza la sensibilidad de la demanda al precio (Elasticidad Precio) y descompone las variaciones de facturación en Efecto Precio, Efecto Volumen y Efecto Mix."
    >
      <SlotPicker slots={PRICE_VOLUME_SLOTS} state={slots} />

      <SetupGrid>
        <SetupField
          label="La columna de importe contiene"
          hint="Cómo interpretar los valores numéricos monetarios del dataset."
        >
          <OptionSelect
            value={settings.priceInputType}
            options={PRICE_TYPE_OPTIONS}
            ariaLabel="Tipo de dato económico"
            onChange={(value) =>
              update({ priceInputType: value as 'importe_total' | 'precio_unitario' })
            }
          />
        </SetupField>

        <SetupField label="Moneda" hint="Cómo se expresan los precios e ingresos.">
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
      </SetupGrid>

      <SetupGrid>
        <p className="col-span-full text-xs text-pretty text-muted-foreground">
          <b>Descomposición PVM:</b> Si seleccionas una columna de fecha, la herramienta comparará
          automáticamente los dos períodos temporales para explicar qué parte del crecimiento o caída
          se debe a subidas de precio, qué parte a variación de unidades vendidas y qué parte al mix de
          productos.
        </p>
      </SetupGrid>
    </SetupCard>
  );
}
