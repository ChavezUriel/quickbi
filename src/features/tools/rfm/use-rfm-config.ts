import { useCallback, useMemo } from 'react';
import { toIso } from '@/features/analysis/lib/dates';
import type { Currency } from '@/features/analysis/types';
import type { ColumnMappingState } from '@/features/mapping/use-column-mapping';
import { toolStorageKey, usePersistedState } from '../use-persisted-state';
import { useToolSlots, type SlotDef, type ToolSlotsState } from '../use-tool-slots';

/**
 * Los cuatro huecos de RFM. Los tres primeros son la definición misma del
 * análisis; el cuarto solo afina la frecuencia: con una columna de pedido se
 * cuentan pedidos, y sin ella, días con compra —que en una tabla de líneas de
 * factura es la aproximación honesta, porque contar filas contaría artículos.
 */
export const RFM_SLOTS: SlotDef[] = [
  {
    id: 'cliente',
    label: 'Cliente',
    description: 'La columna que identifica a cada cliente.',
    kind: 'dimension',
    required: true,
    hints: [
      'cliente',
      'customer',
      'comprador',
      'buyer',
      'id_cliente',
      'cuenta',
      'account',
      'usuario',
      'user',
      'socio',
      'email',
      'correo',
    ],
    cardinality: 'alta',
  },
  {
    id: 'fecha',
    label: 'Fecha de compra',
    description: 'Sobre ella se mide cuánto hace de la última compra.',
    kind: 'date',
    required: true,
    hints: ['fecha', 'date', 'pedido', 'compra', 'venta', 'order', 'emision'],
  },
  {
    id: 'importe',
    label: 'Importe',
    description: 'Lo que se suma para saber cuánto vale cada cliente.',
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
      'neto',
      'subtotal',
      'precio',
      'valor',
    ],
  },
  {
    id: 'pedido',
    label: 'Pedido',
    description: 'Si cada fila es una línea de factura, la columna del pedido.',
    kind: 'dimension',
    required: false,
    hints: ['pedido', 'order', 'factura', 'invoice', 'ticket', 'transaccion', 'folio'],
    cardinality: 'alta',
  },
];

/** Desde cuándo se mide la recencia. */
export type ReferenceMode = 'dataset' | 'hoy' | 'personalizada';

export interface RfmSettings {
  referenceMode: ReferenceMode;
  /** Solo se usa con `personalizada`. */
  referenceDay: string;
  currency: Currency;
}

export interface RfmConfigState {
  slots: ToolSlotsState;
  settings: RfmSettings;
  update: (patch: Partial<RfmSettings>) => void;
  /** Día de referencia efectivo, o `null` para «el último del dataset». */
  referenceDay: string | null;
  ready: boolean;
}

const DEFAULTS: RfmSettings = {
  referenceMode: 'dataset',
  referenceDay: '',
  currency: 'EUR',
};

export function useRfmConfig(mapping: ColumnMappingState): RfmConfigState {
  const slots = useToolSlots('rfm', RFM_SLOTS, mapping);

  const columnNames = useMemo(
    () => mapping.columns.map((column) => column.name),
    [mapping.columns],
  );

  const [settings, setSettings] = usePersistedState<RfmSettings>(
    toolStorageKey('rfm', columnNames),
    DEFAULTS,
  );

  const update = useCallback(
    (patch: Partial<RfmSettings>) => {
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
