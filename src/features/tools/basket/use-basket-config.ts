import { useCallback, useMemo } from 'react';
import type { ColumnMappingState } from '@/features/mapping/use-column-mapping';
import { toolStorageKey, usePersistedState } from '../use-persisted-state';
import { useToolSlots, type SlotDef, type ToolSlotsState } from '../use-tool-slots';

export const BASKET_SLOTS: SlotDef[] = [
  {
    id: 'producto',
    label: 'Producto / Artículo',
    description: 'La columna que contiene los productos o conceptos comprados.',
    kind: 'dimension',
    required: true,
    hints: ['producto', 'item', 'articulo', 'product', 'descripcion', 'sku', 'concepto', 'servicio'],
  },
  {
    id: 'pedido',
    label: 'Pedido / Ticket / Cesta',
    description: 'El identificador común de los artículos comprados en la misma transacción.',
    kind: 'dimension',
    required: true,
    hints: [
      'pedido',
      'order',
      'ticket',
      'factura',
      'invoice',
      'cesta',
      'basket',
      'transaccion',
      'folio',
      'id_compra',
      'id_venta',
    ],
    cardinality: 'alta',
  },
  {
    id: 'cantidad',
    label: 'Cantidad (opcional)',
    description: 'Unidades o volumen de cada artículo en la línea de compra.',
    kind: 'measure',
    required: false,
    hints: ['cantidad', 'unidades', 'qty', 'quantity', 'piezas', 'volumen', 'total'],
  },
];

export interface BasketSettings {
  minSupport: number; // e.g. 0.01 (1%)
  minConfidence: number; // e.g. 0.1 (10%)
  minLift: number; // e.g. 1.0
  topMatrixLimit: number;
}

export interface BasketConfigState {
  slots: ToolSlotsState;
  settings: BasketSettings;
  update: (patch: Partial<BasketSettings>) => void;
  ready: boolean;
}

const DEFAULTS: BasketSettings = {
  minSupport: 0.01,
  minConfidence: 0.05,
  minLift: 1.0,
  topMatrixLimit: 10,
};

export function useBasketConfig(mapping: ColumnMappingState): BasketConfigState {
  const slots = useToolSlots('basket', BASKET_SLOTS, mapping);

  const columnNames = useMemo(
    () => mapping.columns.map((column) => column.name),
    [mapping.columns],
  );

  const [settings, setSettings] = usePersistedState<BasketSettings>(
    toolStorageKey('basket', columnNames),
    DEFAULTS,
  );

  const update = useCallback(
    (patch: Partial<BasketSettings>) => {
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
