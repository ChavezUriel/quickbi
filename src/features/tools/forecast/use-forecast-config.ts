import { useCallback, useMemo } from 'react';
import type { Currency, Granularity, MetricFormat } from '@/features/analysis/types';
import type { ColumnMappingState } from '@/features/mapping/use-column-mapping';
import { toolStorageKey, usePersistedState } from '../use-persisted-state';
import { useToolSlots, type SlotDef, type ToolSlotsState } from '../use-tool-slots';

export const FORECAST_SLOTS: SlotDef[] = [
  {
    id: 'fecha',
    label: 'Fecha',
    description: 'La columna temporal base para entrenar y proyectar la serie temporal.',
    kind: 'date',
    required: true,
    hints: ['fecha', 'date', 'pedido', 'compra', 'venta', 'order', 'timestamp', 'dia', 'periodo'],
  },
  {
    id: 'metrica',
    label: 'Métrica a proyectar',
    description: 'El indicador cuantitativo que el modelo proyectará a futuro.',
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
      'cantidad',
      'demanda',
      'unidades',
    ],
  },
];

export interface ForecastSettings {
  currency: Currency;
  format: MetricFormat;
  grain: Granularity;
  horizon: number;
  model: 'auto' | 'holt-winters' | 'linear-seasonal';
  confidenceLevel: 80 | 95;
  agg: 'sum' | 'avg';
}

export interface ForecastConfigState {
  slots: ToolSlotsState;
  settings: ForecastSettings;
  update: (patch: Partial<ForecastSettings>) => void;
  ready: boolean;
}

const DEFAULTS: ForecastSettings = {
  currency: 'EUR',
  format: 'moneda',
  grain: 'mes',
  horizon: 6,
  model: 'auto',
  confidenceLevel: 95,
  agg: 'sum',
};

export function useForecastConfig(mapping: ColumnMappingState): ForecastConfigState {
  const slots = useToolSlots('forecast', FORECAST_SLOTS, mapping);

  const columnNames = useMemo(
    () => mapping.columns.map((col) => col.name),
    [mapping.columns],
  );

  const [settings, setSettings] = usePersistedState<ForecastSettings>(
    toolStorageKey('forecast', columnNames),
    DEFAULTS,
  );

  const update = useCallback(
    (patch: Partial<ForecastSettings>) => {
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
