import { useCallback, useMemo } from 'react';
import type { Currency } from '@/features/analysis/types';
import type { ColumnMappingState } from '@/features/mapping/use-column-mapping';
import { toolStorageKey, usePersistedState } from '../use-persisted-state';
import { useToolSlots, type SlotDef, type ToolSlotsState } from '../use-tool-slots';

export const DISTRIBUTIONS_SLOTS: SlotDef[] = [
  {
    id: 'medida',
    label: 'Métrica a analizar',
    description: 'La variable numérica de la que se calculará la distribución y los atípicos.',
    kind: 'measure',
    required: true,
    hints: [
      'importe',
      'total',
      'precio',
      'monto',
      'cantidad',
      'duracion',
      'edad',
      'tiempo',
      'valor',
      'ingreso',
      'coste',
      'revenue',
      'sales',
    ],
  },
  {
    id: 'grupo',
    label: 'Dimensión de agrupación',
    description: 'Opcional: compara las distribuciones y diagramas de caja por categoría.',
    kind: 'dimension',
    required: false,
    hints: [
      'categoria',
      'tipo',
      'segmento',
      'region',
      'zona',
      'grupo',
      'genero',
      'canal',
      'estado',
      'pais',
      'sucursal',
    ],
  },
];

export interface DistributionsSettings {
  binCount: string; // 'auto' | '5' | '10' | '15' | '20' | '30' | '50'
  currency: Currency;
}

export interface DistributionsConfigState {
  slots: ToolSlotsState;
  settings: DistributionsSettings;
  update: (patch: Partial<DistributionsSettings>) => void;
  measureColumn: string | null;
  groupDim: string | null;
  effectiveBinCount: number | 'auto';
  ready: boolean;
}

const DEFAULTS: DistributionsSettings = {
  binCount: 'auto',
  currency: 'EUR',
};

export function useDistributionsConfig(mapping: ColumnMappingState): DistributionsConfigState {
  const slots = useToolSlots('distributions', DISTRIBUTIONS_SLOTS, mapping);

  const columnNames = useMemo(
    () => mapping.columns.map((column) => column.name),
    [mapping.columns],
  );

  const [settings, setSettings] = usePersistedState<DistributionsSettings>(
    toolStorageKey('distributions', columnNames),
    DEFAULTS,
  );

  const update = useCallback(
    (patch: Partial<DistributionsSettings>) => {
      setSettings((current) => ({ ...current, ...patch }));
    },
    [setSettings],
  );

  const measureColumn = slots.assignments.medida ?? null;
  const groupDim = slots.assignments.grupo ?? null;

  const effectiveBinCount = useMemo<number | 'auto'>(() => {
    if (settings.binCount === 'auto') return 'auto';
    const parsed = parseInt(settings.binCount, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 'auto';
  }, [settings.binCount]);

  return {
    slots,
    settings: { ...DEFAULTS, ...settings },
    update,
    measureColumn,
    groupDim,
    effectiveBinCount,
    ready: slots.ready && measureColumn !== null,
  };
}
