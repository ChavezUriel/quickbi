import { useCallback, useMemo } from 'react';
import type { Currency } from '@/features/analysis/types';
import type { ColumnMappingState } from '@/features/mapping/use-column-mapping';
import { toolStorageKey, usePersistedState } from '../use-persisted-state';
import { useToolSlots, type SlotDef, type ToolSlotsState } from '../use-tool-slots';

export const CORRELATIONS_SLOTS: SlotDef[] = [
  {
    id: 'etiqueta',
    label: 'Dimensión de etiqueta',
    description: 'Columna para identificar los puntos en el diagrama de dispersión.',
    kind: 'dimension',
    required: false,
    hints: [
      'nombre',
      'cliente',
      'producto',
      'item',
      'articulo',
      'id',
      'codigo',
      'region',
      'pais',
      'ciudad',
    ],
    cardinality: 'alta',
  },
];

export interface CorrelationsSettings {
  selectedX: string;
  selectedY: string;
  currency: Currency;
}

export interface CorrelationsConfigState {
  slots: ToolSlotsState;
  settings: CorrelationsSettings;
  update: (patch: Partial<CorrelationsSettings>) => void;
  selectedX: string | null;
  selectedY: string | null;
  labelDim: string | null;
  availableMeasures: string[];
  ready: boolean;
}

const DEFAULTS: CorrelationsSettings = {
  selectedX: '',
  selectedY: '',
  currency: 'EUR',
};

export function useCorrelationsConfig(mapping: ColumnMappingState): CorrelationsConfigState {
  const slots = useToolSlots('correlations', CORRELATIONS_SLOTS, mapping);

  const columnNames = useMemo(
    () => mapping.columns.map((column) => column.name),
    [mapping.columns],
  );

  const availableMeasures = useMemo(
    () => mapping.measures.map((m) => m.name),
    [mapping.measures],
  );

  const [settings, setSettings] = usePersistedState<CorrelationsSettings>(
    toolStorageKey('correlations', columnNames),
    DEFAULTS,
  );

  const update = useCallback(
    (patch: Partial<CorrelationsSettings>) => {
      setSettings((current) => ({ ...current, ...patch }));
    },
    [setSettings],
  );

  const selectedX = useMemo(() => {
    if (settings.selectedX && availableMeasures.includes(settings.selectedX)) {
      return settings.selectedX;
    }
    return availableMeasures[0] ?? null;
  }, [settings.selectedX, availableMeasures]);

  const selectedY = useMemo(() => {
    if (settings.selectedY && availableMeasures.includes(settings.selectedY)) {
      return settings.selectedY;
    }
    return availableMeasures.length > 1 ? availableMeasures[1]! : availableMeasures[0] ?? null;
  }, [settings.selectedY, availableMeasures]);

  const labelDim = slots.assignments.etiqueta ?? null;
  const ready = availableMeasures.length >= 2;

  return {
    slots,
    settings: { ...DEFAULTS, ...settings },
    update,
    selectedX,
    selectedY,
    labelDim,
    availableMeasures,
    ready,
  };
}
