import { useCallback, useMemo } from 'react';
import type { Currency } from '@/features/analysis/types';
import type { ColumnMappingState } from '@/features/mapping/use-column-mapping';
import { toolStorageKey, usePersistedState } from '../use-persisted-state';
import { useToolSlots, type SlotDef, type ToolSlotsState } from '../use-tool-slots';

export const PARETO_SLOTS: SlotDef[] = [
  {
    id: 'entidad',
    label: 'Entidad a clasificar',
    description: 'La columna de productos, clientes o categorías a ordenar por Pareto.',
    kind: 'dimension',
    required: true,
    hints: [
      'producto',
      'cliente',
      'articulo',
      'item',
      'referencia',
      'sku',
      'proveedor',
      'vendedor',
      'categoria',
      'cuenta',
      'sucursal',
    ],
    cardinality: 'alta',
  },
  {
    id: 'metrica',
    label: 'Métrica de volumen o valor',
    description: 'Lo que se acumula para medir la concentración del 80/20.',
    kind: 'measure',
    required: true,
    hints: [
      'importe',
      'venta',
      'total',
      'revenue',
      'monto',
      'margen',
      'beneficio',
      'coste',
      'cantidad',
      'unidades',
      'precio',
    ],
  },
];

export interface ParetoSettings {
  thresholdA: number; // default 80
  thresholdB: number; // default 95
  currency: Currency;
}

export interface ParetoConfigState {
  slots: ToolSlotsState;
  settings: ParetoSettings;
  update: (patch: Partial<ParetoSettings>) => void;
  entityDim: string | null;
  measureColumn: string | null;
  ready: boolean;
}

const DEFAULTS: ParetoSettings = {
  thresholdA: 80,
  thresholdB: 95,
  currency: 'EUR',
};

export function useParetoConfig(mapping: ColumnMappingState): ParetoConfigState {
  const slots = useToolSlots('pareto', PARETO_SLOTS, mapping);

  const columnNames = useMemo(
    () => mapping.columns.map((column) => column.name),
    [mapping.columns],
  );

  const [settings, setSettings] = usePersistedState<ParetoSettings>(
    toolStorageKey('pareto', columnNames),
    DEFAULTS,
  );

  const update = useCallback(
    (patch: Partial<ParetoSettings>) => {
      setSettings((current) => ({ ...current, ...patch }));
    },
    [setSettings],
  );

  const entityDim = slots.assignments.entidad ?? null;
  const measureColumn = slots.assignments.metrica ?? null;

  return {
    slots,
    settings: { ...DEFAULTS, ...settings },
    update,
    entityDim,
    measureColumn,
    ready: slots.ready && entityDim !== null && measureColumn !== null,
  };
}
