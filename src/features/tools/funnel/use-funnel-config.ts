import { useCallback, useMemo } from 'react';
import type { Currency } from '@/features/analysis/types';
import type { ColumnMappingState } from '@/features/mapping/use-column-mapping';
import { toolStorageKey, usePersistedState } from '../use-persisted-state';
import { useToolSlots, type SlotDef, type ToolSlotsState } from '../use-tool-slots';
import type { FunnelAggregation } from './lib/funnel';

export const FUNNEL_SLOTS: SlotDef[] = [
  {
    id: 'etapa',
    label: 'Etapa / Fase',
    description: 'La columna que clasifica cada fila en un paso del embudo.',
    kind: 'dimension',
    required: true,
    hints: [
      'etapa',
      'fase',
      'paso',
      'stage',
      'step',
      'estado',
      'status',
      'funnel',
      'proceso',
      'nivel',
    ],
  },
  {
    id: 'valor',
    label: 'Métrica o Importe (opcional)',
    description: 'Métrica numérica a sumar en cada etapa (si se deja vacía, cuenta registros).',
    kind: 'measure',
    required: false,
    hints: [
      'valor',
      'importe',
      'monto',
      'total',
      'cantidad',
      'count',
      'usuarios',
      'leads',
      'visitas',
      'revenue',
      'amount',
    ],
  },
  {
    id: 'id',
    label: 'Identificador único (opcional)',
    description: 'ID de usuario o transacción si deseas contar entidades únicas por etapa.',
    kind: 'dimension',
    required: false,
    hints: [
      'id',
      'user_id',
      'lead_id',
      'customer_id',
      'usuario',
      'cliente',
      'sesion',
      'session',
      'transaccion',
      'folio',
    ],
    cardinality: 'alta',
  },
];

export interface FunnelSettings {
  aggregation: FunnelAggregation;
  currency: Currency;
  customOrder: string[];
}

export interface FunnelConfigState {
  slots: ToolSlotsState;
  settings: FunnelSettings;
  update: (patch: Partial<FunnelSettings>) => void;
  ready: boolean;
}

const DEFAULTS: FunnelSettings = {
  aggregation: 'count',
  currency: 'EUR',
  customOrder: [],
};

export function useFunnelConfig(mapping: ColumnMappingState): FunnelConfigState {
  const slots = useToolSlots('funnel', FUNNEL_SLOTS, mapping);

  const columnNames = useMemo(
    () => mapping.columns.map((column) => column.name),
    [mapping.columns],
  );

  const [settings, setSettings] = usePersistedState<FunnelSettings>(
    toolStorageKey('funnel', columnNames),
    DEFAULTS,
  );

  const update = useCallback(
    (patch: Partial<FunnelSettings>) => {
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
