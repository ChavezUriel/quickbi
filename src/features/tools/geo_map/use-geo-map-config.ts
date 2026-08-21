import { useCallback, useMemo } from 'react';
import type { Currency, MetricFormat } from '@/features/analysis/types';
import type { ColumnMappingState } from '@/features/mapping/use-column-mapping';
import { toolStorageKey, usePersistedState } from '../use-persisted-state';
import { useToolSlots, type SlotDef, type ToolSlotsState } from '../use-tool-slots';
import type { GeoAggregation } from './lib/geo_map';

export const GEO_MAP_SLOTS: SlotDef[] = [
  {
    id: 'territorio',
    label: 'Territorio / País / Región',
    description: 'La columna geográfica que divide los datos (país, comunidad, estado, provincia o ciudad).',
    kind: 'dimension',
    required: true,
    hints: [
      'pais',
      'country',
      'estado',
      'state',
      'region',
      'provincia',
      'province',
      'ciudad',
      'city',
      'comunidad',
      'zona',
      'territorio',
      'ubicacion',
      'location',
      'sucursal',
      'sede',
    ],
  },
  {
    id: 'metrica',
    label: 'Métrica principal',
    description: 'La métrica numérica a agregar por cada territorio (ej. ventas, volumen, población).',
    kind: 'measure',
    required: true,
    hints: [
      'importe',
      'total',
      'monto',
      'venta',
      'revenue',
      'sales',
      'valor',
      'cantidad',
      'unidades',
      'poblacion',
      'volumen',
    ],
  },
  {
    id: 'secundaria',
    label: 'Métrica secundaria (opcional)',
    description: 'Métrica complementaria para contrastar (ej. margen, costes, unidades).',
    kind: 'measure',
    required: false,
    hints: [
      'beneficio',
      'margen',
      'coste',
      'costo',
      'pedidos',
      'cantidad',
      'volumen',
      'unidades',
      'unidades_vendidas',
    ],
  },
];

export interface GeoMapSettings {
  aggregation: GeoAggregation;
  format: MetricFormat;
  currency: Currency;
  topN: number;
  visualMode: 'bar' | 'treemap' | 'ranking';
}

export interface GeoMapConfigState {
  slots: ToolSlotsState;
  settings: GeoMapSettings;
  update: (patch: Partial<GeoMapSettings>) => void;
  ready: boolean;
}

const DEFAULTS: GeoMapSettings = {
  aggregation: 'sum',
  format: 'moneda',
  currency: 'EUR',
  topN: 0,
  visualMode: 'bar',
};

export function useGeoMapConfig(mapping: ColumnMappingState): GeoMapConfigState {
  const slots = useToolSlots('geo_map', GEO_MAP_SLOTS, mapping);

  const columnNames = useMemo(
    () => mapping.columns.map((column) => column.name),
    [mapping.columns],
  );

  const [settings, setSettings] = usePersistedState<GeoMapSettings>(
    toolStorageKey('geo_map', columnNames),
    DEFAULTS,
  );

  const update = useCallback(
    (patch: Partial<GeoMapSettings>) => {
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
