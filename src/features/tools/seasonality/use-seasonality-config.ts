import { useCallback, useMemo } from 'react';
import type { Currency, MetricFormat } from '@/features/analysis/types';
import type { ColumnMappingState } from '@/features/mapping/use-column-mapping';
import { toolStorageKey, usePersistedState } from '../use-persisted-state';
import { useToolSlots, type SlotDef, type ToolSlotsState } from '../use-tool-slots';

export const SEASONALITY_SLOTS: SlotDef[] = [
  {
    id: 'fecha',
    label: 'Fecha',
    description: 'La columna temporal sobre la que se calcularán los patrones cíclicos.',
    kind: 'date',
    required: true,
    hints: ['fecha', 'date', 'pedido', 'compra', 'venta', 'order', 'timestamp', 'dia', 'registro'],
  },
  {
    id: 'metrica',
    label: 'Métrica',
    description: 'El valor numérico cuya estacionalidad se desea medir.',
    kind: 'measure',
    required: true,
    hints: [
      'importe',
      'total',
      'monto',
      'amount',
      'revenue',
      'venta',
      'sales',
      'cantidad',
      'ingreso',
      'unidades',
    ],
  },
];

export interface SeasonalitySettings {
  currency: Currency;
  format: MetricFormat;
  agg: 'sum' | 'avg';
  movingAvgWindow: number;
}

export interface SeasonalityConfigState {
  slots: ToolSlotsState;
  settings: SeasonalitySettings;
  update: (patch: Partial<SeasonalitySettings>) => void;
  ready: boolean;
}

const DEFAULTS: SeasonalitySettings = {
  currency: 'EUR',
  format: 'moneda',
  agg: 'sum',
  movingAvgWindow: 7,
};

export function useSeasonalityConfig(mapping: ColumnMappingState): SeasonalityConfigState {
  const slots = useToolSlots('seasonality', SEASONALITY_SLOTS, mapping);

  const columnNames = useMemo(
    () => mapping.columns.map((col) => col.name),
    [mapping.columns],
  );

  const [settings, setSettings] = usePersistedState<SeasonalitySettings>(
    toolStorageKey('seasonality', columnNames),
    DEFAULTS,
  );

  const update = useCallback(
    (patch: Partial<SeasonalitySettings>) => {
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
