import { useCallback, useMemo } from 'react';
import { toIso } from '@/features/analysis/lib/dates';
import type { Currency } from '@/features/analysis/types';
import type { ColumnMappingState } from '@/features/mapping/use-column-mapping';
import { toolStorageKey, usePersistedState } from '../use-persisted-state';
import { useToolSlots, type SlotDef, type ToolSlotsState } from '../use-tool-slots';

export const CLV_SLOTS: SlotDef[] = [
  {
    id: 'cliente',
    label: 'Cliente',
    description: 'La columna que identifica a cada cliente.',
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
    description: 'Permite calcular la recencia, primera/última compra y vida del cliente.',
    kind: 'date',
    required: true,
    hints: ['fecha', 'date', 'pedido', 'compra', 'venta', 'order', 'emision'],
  },
  {
    id: 'importe',
    label: 'Importe',
    description: 'El gasto acumulado que determina el valor monetario del cliente.',
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
    label: 'Identificador de pedido (opcional)',
    description: 'Si cada fila es una línea de artículo, la columna que agrupa el pedido.',
    kind: 'dimension',
    required: false,
    hints: ['pedido', 'order', 'factura', 'invoice', 'ticket', 'transaccion', 'folio'],
    cardinality: 'alta',
  },
];

export type ReferenceMode = 'dataset' | 'hoy' | 'personalizada';

export interface ClvSettings {
  churnDays: number;
  marginRate: number;
  projectionYears: number;
  referenceMode: ReferenceMode;
  referenceDay: string;
  currency: Currency;
}

export interface ClvConfigState {
  slots: ToolSlotsState;
  settings: ClvSettings;
  update: (patch: Partial<ClvSettings>) => void;
  referenceDay: string | null;
  ready: boolean;
}

const DEFAULTS: ClvSettings = {
  churnDays: 180,
  marginRate: 1.0,
  projectionYears: 1,
  referenceMode: 'dataset',
  referenceDay: '',
  currency: 'EUR',
};

export function useClvConfig(mapping: ColumnMappingState): ClvConfigState {
  const slots = useToolSlots('clv', CLV_SLOTS, mapping);

  const columnNames = useMemo(
    () => mapping.columns.map((column) => column.name),
    [mapping.columns],
  );

  const [settings, setSettings] = usePersistedState<ClvSettings>(
    toolStorageKey('clv', columnNames),
    DEFAULTS,
  );

  const update = useCallback(
    (patch: Partial<ClvSettings>) => {
      setSettings((current) => ({ ...current, ...patch }));
    },
    [setSettings],
  );

  const referenceDay = useMemo<string | null>(() => {
    if (settings.referenceMode === 'hoy') return toIso(new Date());
    if (settings.referenceMode === 'personalizada' && settings.referenceDay !== '') {
      return settings.referenceDay;
    }
    return null;
  }, [settings.referenceMode, settings.referenceDay]);

  return {
    slots,
    settings: { ...DEFAULTS, ...settings },
    update,
    referenceDay,
    ready: slots.ready,
  };
}
