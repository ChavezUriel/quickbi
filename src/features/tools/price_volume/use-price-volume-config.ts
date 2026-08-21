import { useCallback, useMemo } from 'react';
import type { Currency } from '@/features/analysis/types';
import type { ColumnMappingState } from '@/features/mapping/use-column-mapping';
import { toolStorageKey, usePersistedState } from '../use-persisted-state';
import { useToolSlots, type SlotDef, type ToolSlotsState } from '../use-tool-slots';

export const PRICE_VOLUME_SLOTS: SlotDef[] = [
  {
    id: 'producto',
    label: 'Producto / Concepto',
    description: 'La columna que clasifica los productos, artículos o servicios.',
    kind: 'dimension',
    required: true,
    hints: [
      'producto',
      'item',
      'articulo',
      'product',
      'concepto',
      'sku',
      'descripcion',
      'linea',
      'familia',
      'servicio',
    ],
  },
  {
    id: 'volumen',
    label: 'Volumen / Cantidad',
    description: 'Número de unidades vendidas o volumen de demanda.',
    kind: 'measure',
    required: true,
    hints: ['volumen', 'cantidad', 'unidades', 'qty', 'quantity', 'piezas', 'total_unidades', 'horas'],
  },
  {
    id: 'importe',
    label: 'Importe total o Precio',
    description: 'Facturación total obtenida o precio unitario por fila.',
    kind: 'measure',
    required: true,
    hints: [
      'importe',
      'precio',
      'total',
      'monto',
      'amount',
      'revenue',
      'ingreso',
      'venta',
      'sales',
      'facturacion',
      'valor',
    ],
  },
  {
    id: 'fecha',
    label: 'Fecha / Período (opcional)',
    description: 'Para descomponer variaciones temporales en Efecto Precio, Volumen y Mix.',
    kind: 'date',
    required: false,
    hints: ['fecha', 'date', 'periodo', 'mes', 'año', 'year', 'emision', 'dia'],
  },
];

export interface PriceVolumeSettings {
  currency: Currency;
  priceInputType: 'importe_total' | 'precio_unitario';
}

export interface PriceVolumeConfigState {
  slots: ToolSlotsState;
  settings: PriceVolumeSettings;
  update: (patch: Partial<PriceVolumeSettings>) => void;
  ready: boolean;
}

const DEFAULTS: PriceVolumeSettings = {
  currency: 'EUR',
  priceInputType: 'importe_total',
};

export function usePriceVolumeConfig(mapping: ColumnMappingState): PriceVolumeConfigState {
  const slots = useToolSlots('price_volume', PRICE_VOLUME_SLOTS, mapping);

  const columnNames = useMemo(
    () => mapping.columns.map((column) => column.name),
    [mapping.columns],
  );

  const [settings, setSettings] = usePersistedState<PriceVolumeSettings>(
    toolStorageKey('price_volume', columnNames),
    DEFAULTS,
  );

  const update = useCallback(
    (patch: Partial<PriceVolumeSettings>) => {
      setSettings((current) => ({ ...current, ...patch }));
    },
    [setSettings],
  );

  return {
    slots,
    settings: { ...DEFAULTS, ...settings },
    update,
    ready: slots.ready,
  };
}
