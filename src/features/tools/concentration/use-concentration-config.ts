import { useCallback, useMemo } from 'react';
import type { Currency } from '@/features/analysis/types';
import type { ColumnMappingState } from '@/features/mapping/use-column-mapping';
import { toolStorageKey, usePersistedState } from '../use-persisted-state';
import { useToolSlots, type SlotDef, type ToolSlotsState } from '../use-tool-slots';

export const CONCENTRATION_SLOTS: SlotDef[] = [
  {
    id: 'cliente',
    label: 'Cliente / Entidad',
    description: 'La columna que identifica a cada cliente, empresa o comprador.',
    kind: 'dimension',
    required: true,
    hints: [
      'cliente',
      'customer',
      'id_cliente',
      'cuenta',
      'account',
      'usuario',
      'user',
      'empresa',
      'comprador',
      'socio',
    ],
    cardinality: 'alta',
  },
  {
    id: 'importe',
    label: 'Importe / Facturación',
    description: 'La columna con el total facturado o valor económico de cada venta.',
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
      'facturacion',
      'neto',
      'valor',
    ],
  },
  {
    id: 'segmento',
    label: 'Segmento / Categoría (opcional)',
    description: 'Para clasificar o filtrar la procedencia de los clientes.',
    kind: 'dimension',
    required: false,
    hints: ['segmento', 'categoria', 'tipo', 'sector', 'pais', 'region', 'zona', 'canal'],
  },
];

export interface ConcentrationSettings {
  currency: Currency;
  topLimit: number;
}

export interface ConcentrationConfigState {
  slots: ToolSlotsState;
  settings: ConcentrationSettings;
  update: (patch: Partial<ConcentrationSettings>) => void;
  ready: boolean;
}

const DEFAULTS: ConcentrationSettings = {
  currency: 'EUR',
  topLimit: 20,
};

export function useConcentrationConfig(mapping: ColumnMappingState): ConcentrationConfigState {
  const slots = useToolSlots('concentration', CONCENTRATION_SLOTS, mapping);

  const columnNames = useMemo(
    () => mapping.columns.map((column) => column.name),
    [mapping.columns],
  );

  const [settings, setSettings] = usePersistedState<ConcentrationSettings>(
    toolStorageKey('concentration', columnNames),
    DEFAULTS,
  );

  const update = useCallback(
    (patch: Partial<ConcentrationSettings>) => {
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
