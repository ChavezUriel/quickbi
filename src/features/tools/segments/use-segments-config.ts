import { useCallback, useMemo } from 'react';
import type { Currency } from '@/features/analysis/types';
import type { ColumnMappingState } from '@/features/mapping/use-column-mapping';
import { toolStorageKey, usePersistedState } from '../use-persisted-state';
import { useToolSlots, type SlotDef, type ToolSlotsState } from '../use-tool-slots';

export const SEGMENTS_SLOTS: SlotDef[] = [
  {
    id: 'dimension_segmento',
    label: 'Dimensión para segmentar',
    description: 'La columna cuyos valores definen el Segmento A y el Segmento B.',
    kind: 'dimension',
    required: true,
    hints: [
      'segmento',
      'tipo',
      'canal',
      'categoria',
      'region',
      'pais',
      'zona',
      'genero',
      'estado',
      'cliente_tipo',
    ],
  },
  {
    id: 'metrica_principal',
    label: 'Métrica principal',
    description: 'La métrica clave para comparar volumen, media y efecto mix.',
    kind: 'measure',
    required: true,
    hints: [
      'importe',
      'total',
      'venta',
      'revenue',
      'monto',
      'beneficio',
      'margen',
      'unidades',
      'cantidad',
      'precio',
    ],
  },
  {
    id: 'dimension_desglose',
    label: 'Dimensión de desglose (Mix-Shift)',
    description: 'Opcional: analiza si la diferencia de rendimiento se debe al mix de esta subcategoría.',
    kind: 'dimension',
    required: false,
    hints: [
      'categoria',
      'familia',
      'producto',
      'canal',
      'region',
      'dispositivo',
      'subcategoria',
    ],
  },
];

export interface SegmentsSettings {
  segmentAValues: string[];
  segmentBValues: string[];
  segmentAName: string;
  segmentBName: string;
  currency: Currency;
}

export interface SegmentsConfigState {
  slots: ToolSlotsState;
  settings: SegmentsSettings;
  update: (patch: Partial<SegmentsSettings>) => void;
  segmentDim: string | null;
  primaryMeasure: string | null;
  breakdownDim: string | null;
  availableMeasures: string[];
  ready: boolean;
}

const DEFAULTS: SegmentsSettings = {
  segmentAValues: [],
  segmentBValues: [],
  segmentAName: 'Segmento A',
  segmentBName: 'Segmento B',
  currency: 'EUR',
};

export function useSegmentsConfig(mapping: ColumnMappingState): SegmentsConfigState {
  const slots = useToolSlots('segments', SEGMENTS_SLOTS, mapping);

  const columnNames = useMemo(
    () => mapping.columns.map((column) => column.name),
    [mapping.columns],
  );

  const availableMeasures = useMemo(
    () => mapping.measures.map((m) => m.name),
    [mapping.measures],
  );

  const [settings, setSettings] = usePersistedState<SegmentsSettings>(
    toolStorageKey('segments', columnNames),
    DEFAULTS,
  );

  const update = useCallback(
    (patch: Partial<SegmentsSettings>) => {
      setSettings((current) => ({ ...current, ...patch }));
    },
    [setSettings],
  );

  const segmentDim = slots.assignments.dimension_segmento ?? null;
  const primaryMeasure = slots.assignments.metrica_principal ?? availableMeasures[0] ?? null;
  const breakdownDim = slots.assignments.dimension_desglose ?? null;

  const ready =
    slots.ready &&
    segmentDim !== null &&
    primaryMeasure !== null;

  return {
    slots,
    settings: { ...DEFAULTS, ...settings },
    update,
    segmentDim,
    primaryMeasure,
    breakdownDim,
    availableMeasures,
    ready,
  };
}
