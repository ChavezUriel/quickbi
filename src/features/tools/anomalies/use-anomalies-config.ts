import { useCallback, useMemo } from 'react';
import type { Currency, Granularity } from '@/features/analysis/types';
import type { ColumnMappingState } from '@/features/mapping/use-column-mapping';
import { toolStorageKey, usePersistedState } from '../use-persisted-state';
import { useToolSlots, type SlotDef, type ToolSlotsState } from '../use-tool-slots';
import type { AnomalyMethod, AnomalySensitivity } from './lib/anomalies';

export const ANOMALIES_SLOTS: SlotDef[] = [
  {
    id: 'fecha',
    label: 'Fecha',
    description: 'Eje temporal sobre el que se analiza la evolución.',
    kind: 'date',
    required: true,
    hints: ['fecha', 'date', 'pedido', 'compra', 'dia', 'timestamp', 'emision', 'created_at'],
  },
  {
    id: 'metrica',
    label: 'Métrica a supervisar',
    description: 'El indicador cuantitativo donde se buscan picos y caídas.',
    kind: 'measure',
    required: true,
    hints: [
      'importe',
      'total',
      'monto',
      'ventas',
      'revenue',
      'pedidos',
      'visitas',
      'usuarios',
      'cantidad',
      'transacciones',
      'unidades',
      'precio',
    ],
  },
  {
    id: 'dimension',
    label: 'Dimensión para filtrar (opcional)',
    description: 'Permite aislar la detección a una categoría o región específica.',
    kind: 'dimension',
    required: false,
    hints: ['categoria', 'pais', 'region', 'canal', 'segmento', 'tipo', 'sucursal'],
  },
];

export interface AnomaliesSettings {
  method: AnomalyMethod;
  sensitivity: AnomalySensitivity;
  windowSize: number;
  grain: Granularity;
  currency: Currency;
  selectedDimensionValue: string | null;
}

export interface AnomaliesConfigState {
  slots: ToolSlotsState;
  settings: AnomaliesSettings;
  update: (patch: Partial<AnomaliesSettings>) => void;
  ready: boolean;
}

const DEFAULTS: AnomaliesSettings = {
  method: 'rolling_zscore',
  sensitivity: 'alta',
  windowSize: 7,
  grain: 'dia',
  currency: 'EUR',
  selectedDimensionValue: null,
};

export function useAnomaliesConfig(mapping: ColumnMappingState): AnomaliesConfigState {
  const slots = useToolSlots('anomalies', ANOMALIES_SLOTS, mapping);

  const columnNames = useMemo(
    () => mapping.columns.map((column) => column.name),
    [mapping.columns],
  );

  const [settings, setSettings] = usePersistedState<AnomaliesSettings>(
    toolStorageKey('anomalies', columnNames),
    DEFAULTS,
  );

  const update = useCallback(
    (patch: Partial<AnomaliesSettings>) => {
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
