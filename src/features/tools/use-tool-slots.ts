import { useCallback, useMemo } from 'react';
import type { ColumnProfile } from '@/features/dataset/lib/column-types';
import type { ColumnMappingState } from '@/features/mapping/use-column-mapping';
import {
  suggestColumn,
  type CardinalityPreference,
} from './lib/slot-suggest';
import { toolStorageKey, usePersistedState } from './use-persisted-state';

/** De qué grupo de columnas puede salir el contenido de un hueco. */
export type SlotKind = 'date' | 'dimension' | 'measure';

/**
 * Hueco con nombre propio de una herramienta.
 *
 * El paso de tipos dice si una columna es texto, número o fecha; qué *papel*
 * juega —cuál es el cliente y cuál el importe— solo lo sabe la herramienta que
 * lo necesita, y por eso lo pide aquí en vez de inferirlo del tipo.
 */
export interface SlotDef {
  id: string;
  label: string;
  description: string;
  kind: SlotKind;
  required: boolean;
  /** Palabras que delatan la columna en su nombre, de más a menos específica. */
  hints: readonly string[];
  cardinality?: CardinalityPreference;
}

export interface ToolSlotsState {
  /** Columna asignada a cada hueco; `null` si está vacío. */
  assignments: Record<string, string | null>;
  candidatesFor: (slotId: string) => ColumnProfile[];
  setSlot: (slotId: string, column: string | null) => void;
  /** Todos los huecos obligatorios tienen columna. */
  ready: boolean;
  /** Rótulos de los huecos obligatorios que siguen vacíos. */
  missing: string[];
}

const NO_OVERRIDES: Record<string, string | null> = {};

/**
 * Asigna columnas a los huecos de una herramienta: propone por el nombre,
 * respeta lo que el usuario cambie y lo recuerda por esquema.
 */
export function useToolSlots(
  toolId: string,
  slots: readonly SlotDef[],
  mapping: ColumnMappingState,
): ToolSlotsState {
  const columnNames = useMemo(
    () => mapping.columns.map((column) => column.name),
    [mapping.columns],
  );

  const [overrides, setOverrides] = usePersistedState<Record<string, string | null>>(
    toolStorageKey(`${toolId}_slots`, columnNames),
    NO_OVERRIDES,
  );

  const candidates = useMemo(() => {
    const byKind: Record<SlotKind, ColumnProfile[]> = {
      date: mapping.dateColumns,
      dimension: mapping.dimensions,
      measure: mapping.measures,
    };
    return byKind;
  }, [mapping.dateColumns, mapping.dimensions, mapping.measures]);

  const assignments = useMemo(() => {
    const result: Record<string, string | null> = {};

    for (const slot of slots) {
      const pool = candidates[slot.kind];
      const override = overrides[slot.id];

      // Una asignación guardada solo vale si la columna sigue existiendo y
      // sigue siendo del tipo que el hueco pide: cambiar un tipo en el paso
      // anterior no debe dejar la herramienta apuntando al vacío.
      if (override !== undefined) {
        if (override === null) {
          result[slot.id] = null;
          continue;
        }
        if (pool.some((column) => column.name === override)) {
          result[slot.id] = override;
          continue;
        }
      }

      result[slot.id] = suggestColumn(pool, {
        hints: slot.hints,
        cardinality: slot.cardinality,
      });
    }

    return result;
  }, [slots, candidates, overrides]);

  const candidatesFor = useCallback(
    (slotId: string) => {
      const slot = slots.find((item) => item.id === slotId);
      return slot === undefined ? [] : candidates[slot.kind];
    },
    [slots, candidates],
  );

  const setSlot = useCallback(
    (slotId: string, column: string | null) => {
      setOverrides((current) => ({ ...current, [slotId]: column }));
    },
    [setOverrides],
  );

  const missing = useMemo(
    () =>
      slots
        .filter((slot) => slot.required && assignments[slot.id] == null)
        .map((slot) => slot.label),
    [slots, assignments],
  );

  return {
    assignments,
    candidatesFor,
    setSlot,
    ready: missing.length === 0,
    missing,
  };
}
