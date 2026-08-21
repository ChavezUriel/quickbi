import { useCallback, useMemo } from 'react';
import type { Currency } from '@/features/analysis/types';
import type { ColumnMappingState } from '@/features/mapping/use-column-mapping';
import { toolStorageKey, usePersistedState } from '../use-persisted-state';
import { useToolSlots, type SlotDef, type ToolSlotsState } from '../use-tool-slots';

export const RECONCILIATION_SLOTS: SlotDef[] = [
  {
    id: 'clave',
    label: 'Clave identificadora / ID',
    description: 'La clave única por la que cruzar y emparejar los registros (factura, ID, folio, etc.).',
    kind: 'dimension',
    required: true,
    hints: [
      'id',
      'clave',
      'key',
      'factura',
      'invoice',
      'transaccion',
      'transaction',
      'referencia',
      'ref',
      'ticket',
      'folio',
      'codigo',
      'cuenta',
      'account',
      'pedido',
      'order',
    ],
    cardinality: 'alta',
  },
  {
    id: 'valorA',
    label: 'Importe Fuente A / Primer valor',
    description: 'Columna de importe de la primera fuente (o importe registrado).',
    kind: 'measure',
    required: true,
    hints: [
      'importe',
      'importe_a',
      'monto_a',
      'sistema_a',
      'banco',
      'teorico',
      'contabilidad',
      'registrado',
      'facturado',
      'valor_a',
      'monto',
      'total',
    ],
  },
  {
    id: 'valorB',
    label: 'Importe Fuente B / Segundo valor (opcional)',
    description: 'Columna de importe de la segunda fuente (si ambas fuentes están en la misma fila).',
    kind: 'measure',
    required: false,
    hints: [
      'importe_b',
      'monto_b',
      'sistema_b',
      'real',
      'fisico',
      'cobrado',
      'extracto',
      'valor_b',
      'pasarela',
      'erp',
      'segundo_importe',
    ],
  },
  {
    id: 'fuente',
    label: 'Columna de origen / Fuente (opcional)',
    description: 'Columna que indica si la fila pertenece a la Fuente A o a la Fuente B.',
    kind: 'dimension',
    required: false,
    hints: [
      'fuente',
      'origen',
      'source',
      'sistema',
      'tipo',
      'fichero',
      'archivo',
      'periodo',
      'entidad',
    ],
  },
];

export type ReconciliationMode = 'dual_columns' | 'source_dimension';

export interface ReconciliationSettings {
  mode: ReconciliationMode;
  sourceAValue: string;
  sourceBValue: string;
  tolerance: number;
  currency: Currency;
}

export interface ReconciliationConfigState {
  slots: ToolSlotsState;
  settings: ReconciliationSettings;
  update: (patch: Partial<ReconciliationSettings>) => void;
  ready: boolean;
}

const DEFAULTS: ReconciliationSettings = {
  mode: 'dual_columns',
  sourceAValue: '',
  sourceBValue: '',
  tolerance: 0.01,
  currency: 'EUR',
};

export function useReconciliationConfig(
  mapping: ColumnMappingState,
): ReconciliationConfigState {
  const slots = useToolSlots('reconciliation', RECONCILIATION_SLOTS, mapping);

  const columnNames = useMemo(
    () => mapping.columns.map((column) => column.name),
    [mapping.columns],
  );

  const [settings, setSettings] = usePersistedState<ReconciliationSettings>(
    toolStorageKey('reconciliation', columnNames),
    DEFAULTS,
  );

  const update = useCallback(
    (patch: Partial<ReconciliationSettings>) => {
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
