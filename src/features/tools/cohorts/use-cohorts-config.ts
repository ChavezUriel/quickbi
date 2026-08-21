import { useCallback, useMemo } from 'react';
import type { Currency, Granularity } from '@/features/analysis/types';
import type { ColumnMappingState } from '@/features/mapping/use-column-mapping';
import { toolStorageKey, usePersistedState } from '../use-persisted-state';
import { useToolSlots, type SlotDef, type ToolSlotsState } from '../use-tool-slots';

export const COHORTS_SLOTS: SlotDef[] = [
  {
    id: 'cliente',
    label: 'Cliente',
    description: 'La columna que identifica al cliente y asigna su cohorte.',
    kind: 'dimension',
    required: true,
    hints: [
      'cliente',
      'customer',
      'comprador',
      'buyer',
      'id_cliente',
      'cuenta',
      'account',
      'usuario',
      'user',
      'socio',
      'email',
      'correo',
    ],
    cardinality: 'alta',
  },
  {
    id: 'fecha',
    label: 'Fecha de compra',
    description: 'Determina la fecha de primera compra y las recompras posteriores.',
    kind: 'date',
    required: true,
    hints: ['fecha', 'date', 'pedido', 'compra', 'venta', 'order', 'emision'],
  },
  {
    id: 'importe',
    label: 'Importe',
    description: 'El valor monetario para calcular la retención de ingresos.',
    kind: 'measure',
    required: true,
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
  {
    id: 'pedido',
    label: 'Pedido (opcional)',
    description: 'Si cada fila es un ítem, la columna de pedido que los agrupa.',
    kind: 'dimension',
    required: false,
    hints: ['pedido', 'order', 'factura', 'invoice', 'ticket', 'transaccion', 'folio'],
    cardinality: 'alta',
  },
];

export interface CohortsSettings {
  grain: Granularity;
  metricType: 'clientes' | 'ingresos';
  displayMode: 'porcentaje' | 'absoluto';
  currency: Currency;
}

export interface CohortsConfigState {
  slots: ToolSlotsState;
  settings: CohortsSettings;
  update: (patch: Partial<CohortsSettings>) => void;
  ready: boolean;
}

const DEFAULTS: CohortsSettings = {
  grain: 'mes',
  metricType: 'clientes',
  displayMode: 'porcentaje',
  currency: 'EUR',
};

export function useCohortsConfig(mapping: ColumnMappingState): CohortsConfigState {
  const slots = useToolSlots('cohorts', COHORTS_SLOTS, mapping);

  const columnNames = useMemo(
    () => mapping.columns.map((column) => column.name),
    [mapping.columns],
  );

  const [settings, setSettings] = usePersistedState<CohortsSettings>(
    toolStorageKey('cohorts', columnNames),
    DEFAULTS,
  );

  const update = useCallback(
    (patch: Partial<CohortsSettings>) => {
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
