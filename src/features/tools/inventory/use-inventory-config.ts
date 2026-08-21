import { useCallback, useMemo } from 'react';
import { toIso } from '@/features/analysis/lib/dates';
import type { Currency } from '@/features/analysis/types';
import type { ColumnMappingState } from '@/features/mapping/use-column-mapping';
import { toolStorageKey, usePersistedState } from '../use-persisted-state';
import { useToolSlots, type SlotDef, type ToolSlotsState } from '../use-tool-slots';

export const INVENTORY_SLOTS: SlotDef[] = [
  {
    id: 'producto',
    label: 'Producto / SKU',
    description: 'La columna que identifica a cada artículo, referencia o SKU.',
    kind: 'dimension',
    required: true,
    hints: [
      'producto',
      'product',
      'sku',
      'articulo',
      'item',
      'referencia',
      'ref',
      'codigo',
      'material',
      'descripcion',
    ],
    cardinality: 'alta',
  },
  {
    id: 'stock',
    label: 'Stock / Existencias',
    description: 'Cantidad o valor monetario de existencias actualmente en almacén.',
    kind: 'measure',
    required: true,
    hints: [
      'stock',
      'inventario',
      'existencias',
      'cantidad_stock',
      'inventory',
      'on_hand',
      'unidades_stock',
      'stock_actual',
      'qty',
    ],
  },
  {
    id: 'ventas',
    label: 'Ventas / Demanda (opcional)',
    description: 'Ventas o coste de ventas del período para calcular la velocidad de rotación.',
    kind: 'measure',
    required: false,
    hints: [
      'ventas',
      'coste_ventas',
      'cogs',
      'costo_ventas',
      'salidas',
      'demanda',
      'consumo',
      'sales',
      'unidades_vendidas',
      'sold',
    ],
  },
  {
    id: 'dias_o_fecha',
    label: 'Días o Fecha de ingreso (opcional)',
    description: 'Días de permanencia en almacén o fecha de entrada del lote.',
    kind: 'measure',
    required: false,
    hints: [
      'dias_stock',
      'dias',
      'antiguedad',
      'age',
      'fecha_ingreso',
      'fecha_recepcion',
      'fecha_compra',
      'receipt_date',
      'entry_date',
    ],
  },
  {
    id: 'categoria',
    label: 'Categoría / Familia (opcional)',
    description: 'Familia o departamento para clasificar el catálogo.',
    kind: 'dimension',
    required: false,
    hints: [
      'categoria',
      'category',
      'familia',
      'family',
      'linea',
      'tipo',
      'grupo',
      'departamento',
    ],
  },
];

export type InventoryRefMode = 'dataset' | 'hoy' | 'personalizada';

export interface InventorySettings {
  periodDays: number;
  currency: Currency;
  referenceMode: InventoryRefMode;
  referenceDay: string;
}

export interface InventoryConfigState {
  slots: ToolSlotsState;
  settings: InventorySettings;
  update: (patch: Partial<InventorySettings>) => void;
  referenceDay: string | null;
  ready: boolean;
}

const DEFAULTS: InventorySettings = {
  periodDays: 365,
  currency: 'EUR',
  referenceMode: 'dataset',
  referenceDay: '',
};

export function useInventoryConfig(mapping: ColumnMappingState): InventoryConfigState {
  const slots = useToolSlots('inventory', INVENTORY_SLOTS, mapping);

  const columnNames = useMemo(
    () => mapping.columns.map((column) => column.name),
    [mapping.columns],
  );

  const [settings, setSettings] = usePersistedState<InventorySettings>(
    toolStorageKey('inventory', columnNames),
    DEFAULTS,
  );

  const update = useCallback(
    (patch: Partial<InventorySettings>) => {
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
