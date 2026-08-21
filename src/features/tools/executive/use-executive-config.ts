import { useCallback, useMemo } from 'react';
import type { Currency, Granularity, MetricFormat } from '@/features/analysis/types';
import type { ColumnMappingState } from '@/features/mapping/use-column-mapping';
import { toolStorageKey, usePersistedState } from '../use-persisted-state';
import { useToolSlots, type SlotDef, type ToolSlotsState } from '../use-tool-slots';

export const EXECUTIVE_SLOTS: SlotDef[] = [
  {
    id: 'metrica',
    label: 'Métrica principal',
    description: 'La columna numérica sobre la que se calcularán los indicadores y el resumen.',
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
      'precio',
      'cantidad',
      'valor',
      'subtotal',
    ],
  },
  {
    id: 'fecha',
    label: 'Fecha (opcional)',
    description: 'Permite calcular trayectoria, tendencias, estacionalidad y anomalías.',
    kind: 'date',
    required: false,
    hints: ['fecha', 'date', 'pedido', 'compra', 'venta', 'order', 'timestamp', 'dia'],
  },
  {
    id: 'dimension',
    label: 'Dimensión / Categoría (opcional)',
    description: 'Permite desglosar el análisis de Pareto y concentración de volumen.',
    kind: 'dimension',
    required: false,
    hints: [
      'categoria',
      'category',
      'producto',
      'product',
      'tipo',
      'type',
      'segmento',
      'region',
      'canal',
      'pais',
      'cliente',
    ],
  },
];

export interface ExecutiveSettings {
  currency: Currency;
  format: MetricFormat;
  grain: Granularity;
  agg: 'sum' | 'avg' | 'count';
}

export interface ExecutiveConfigState {
  slots: ToolSlotsState;
  settings: ExecutiveSettings;
  update: (patch: Partial<ExecutiveSettings>) => void;
  ready: boolean;
}

const DEFAULTS: ExecutiveSettings = {
  currency: 'EUR',
  format: 'moneda',
  grain: 'mes',
  agg: 'sum',
};

export function useExecutiveConfig(mapping: ColumnMappingState): ExecutiveConfigState {
  const slots = useToolSlots('executive', EXECUTIVE_SLOTS, mapping);

  const columnNames = useMemo(
    () => mapping.columns.map((col) => col.name),
    [mapping.columns],
  );

  const [settings, setSettings] = usePersistedState<ExecutiveSettings>(
    toolStorageKey('executive', columnNames),
    DEFAULTS,
  );

  const update = useCallback(
    (patch: Partial<ExecutiveSettings>) => {
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
