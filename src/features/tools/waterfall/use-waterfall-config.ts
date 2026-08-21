import { useCallback, useMemo } from 'react';
import type { Currency, DateWindow, Granularity } from '@/features/analysis/types';
import type { ColumnMappingState } from '@/features/mapping/use-column-mapping';
import { toolStorageKey, usePersistedState } from '../use-persisted-state';
import { useToolSlots, type SlotDef, type ToolSlotsState } from '../use-tool-slots';
import type { SplitMode } from './lib/waterfall';

export const WATERFALL_SLOTS: SlotDef[] = [
  {
    id: 'dimension',
    label: 'Dimensión o categoría',
    description: 'La categoría cuyos aportes explican el cambio entre períodos.',
    kind: 'dimension',
    required: true,
    hints: [
      'categoria',
      'category',
      'producto',
      'product',
      'segmento',
      'segment',
      'canal',
      'channel',
      'pais',
      'region',
      'linea',
      'familia',
      'marca',
      'tipo',
    ],
  },
  {
    id: 'measure',
    label: 'Métrica o importe',
    description: 'El valor numérico que se descompone (ventas, margen, cantidad).',
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
      'beneficio',
      'margen',
      'ganancia',
    ],
  },
  {
    id: 'date',
    label: 'Fecha',
    description: 'Permite separar los dos períodos a comparar.',
    kind: 'date',
    required: true,
    hints: ['fecha', 'date', 'pedido', 'compra', 'venta', 'order', 'emision', 'dia', 'timestamp'],
  },
];

export interface WaterfallSettings {
  splitMode: SplitMode;
  periodUnit: Granularity;
  maxCategories: number;
  currency: Currency;
  customPeriod1: DateWindow;
  customPeriod2: DateWindow;
}

export interface WaterfallConfigState {
  slots: ToolSlotsState;
  settings: WaterfallSettings;
  update: (patch: Partial<WaterfallSettings>) => void;
  ready: boolean;
}

const DEFAULTS: WaterfallSettings = {
  splitMode: 'mitades',
  periodUnit: 'mes',
  maxCategories: 7,
  currency: 'EUR',
  customPeriod1: { desde: '', hasta: '' },
  customPeriod2: { desde: '', hasta: '' },
};

export function useWaterfallConfig(mapping: ColumnMappingState): WaterfallConfigState {
  const slots = useToolSlots('waterfall', WATERFALL_SLOTS, mapping);

  const columnNames = useMemo(
    () => mapping.columns.map((column) => column.name),
    [mapping.columns],
  );

  const [settings, setSettings] = usePersistedState<WaterfallSettings>(
    toolStorageKey('waterfall', columnNames),
    DEFAULTS,
  );

  const update = useCallback(
    (patch: Partial<WaterfallSettings>) => {
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
