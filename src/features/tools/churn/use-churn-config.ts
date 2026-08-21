import { useCallback, useMemo } from 'react';
import type { Currency, Granularity } from '@/features/analysis/types';
import type { ColumnMappingState } from '@/features/mapping/use-column-mapping';
import { toolStorageKey, usePersistedState } from '../use-persisted-state';
import { useToolSlots, type SlotDef, type ToolSlotsState } from '../use-tool-slots';

export const CHURN_SLOTS: SlotDef[] = [
  {
    id: 'cliente',
    label: 'Cliente',
    description: 'La columna que identifica a cada cliente o usuario.',
    kind: 'dimension',
    required: true,
    hints: [
      'cliente',
      'customer',
      'id_cliente',
      'cuenta',
      'account',
      'usuario',
      'user',
      'socio',
      'email',
      'correo',
      'comprador',
    ],
    cardinality: 'alta',
  },
  {
    id: 'fecha',
    label: 'Fecha de transacción',
    description: 'Fecha en la que se registra la actividad o compra.',
    kind: 'date',
    required: true,
    hints: ['fecha', 'date', 'pedido', 'compra', 'venta', 'order', 'emision', 'transaccion'],
  },
  {
    id: 'importe',
    label: 'Importe (opcional)',
    description: 'Para calcular también el movimiento y pérdida de ingresos.',
    kind: 'measure',
    required: false,
    hints: [
      'importe',
      'total',
      'monto',
      'amount',
      'revenue',
      'ingreso',
      'venta',
      'sales',
      'neto',
      'subtotal',
      'precio',
      'valor',
    ],
  },
];

export interface ChurnSettings {
  grain: Granularity;
  currency: Currency;
}

export interface ChurnConfigState {
  slots: ToolSlotsState;
  settings: ChurnSettings;
  update: (patch: Partial<ChurnSettings>) => void;
  ready: boolean;
}

const DEFAULTS: ChurnSettings = {
  grain: 'mes',
  currency: 'EUR',
};

export function useChurnConfig(mapping: ColumnMappingState): ChurnConfigState {
  const slots = useToolSlots('churn', CHURN_SLOTS, mapping);

  const columnNames = useMemo(
    () => mapping.columns.map((column) => column.name),
    [mapping.columns],
  );

  const [settings, setSettings] = usePersistedState<ChurnSettings>(
    toolStorageKey('churn', columnNames),
    DEFAULTS,
  );

  const update = useCallback(
    (patch: Partial<ChurnSettings>) => {
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
