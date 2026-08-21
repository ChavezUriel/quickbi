import { useCallback, useMemo } from 'react';
import type { Currency, MetricFormat } from '@/features/analysis/types';
import type { ColumnMappingState } from '@/features/mapping/use-column-mapping';
import { toolStorageKey, usePersistedState } from '../use-persisted-state';
import { useToolSlots, type SlotDef, type ToolSlotsState } from '../use-tool-slots';

export const SPC_SLOTS: SlotDef[] = [
  {
    id: 'metrica',
    label: 'Variable de control',
    description: 'La columna numérica continua que se supervisará bajo límites estadísticos de Shewhart.',
    kind: 'measure',
    required: true,
    hints: [
      'valor',
      'medicion',
      'tiempo',
      'defecto',
      'error',
      'temperatura',
      'peso',
      'importe',
      'duracion',
      'score',
      'metrica',
      'monto',
      'total',
    ],
  },
  {
    id: 'orden',
    label: 'Orden cronológico / Lote (opcional)',
    description: 'Columna que establece la secuencia temporal de las muestras o subgrupos.',
    kind: 'date',
    required: false,
    hints: ['fecha', 'date', 'lote', 'batch', 'muestra', 'sample', 'orden', 'id', 'tiempo', 'timestamp'],
  },
];

export interface SpcSettings {
  currency: Currency;
  format: MetricFormat;
  sigmaMethod: 'moving-range' | 'sample-stddev';
  targetMean: number | null;
  targetSigma: number | null;
}

export interface SpcConfigState {
  slots: ToolSlotsState;
  settings: SpcSettings;
  update: (patch: Partial<SpcSettings>) => void;
  ready: boolean;
}

const DEFAULTS: SpcSettings = {
  currency: 'EUR',
  format: 'numero',
  sigmaMethod: 'moving-range',
  targetMean: null,
  targetSigma: null,
};

export function useSpcConfig(mapping: ColumnMappingState): SpcConfigState {
  const slots = useToolSlots('spc', SPC_SLOTS, mapping);

  const columnNames = useMemo(
    () => mapping.columns.map((col) => col.name),
    [mapping.columns],
  );

  const [settings, setSettings] = usePersistedState<SpcSettings>(
    toolStorageKey('spc', columnNames),
    DEFAULTS,
  );

  const update = useCallback(
    (patch: Partial<SpcSettings>) => {
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
