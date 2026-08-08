import { useCallback, useMemo, useState } from 'react';
import { coerceValue, profileColumn } from '@/features/dataset/lib/infer-columns';
import type { ColumnProfile, ColumnType } from '@/features/dataset/lib/column-types';
import type { ParsedDataset } from '@/features/dataset/types';
import { needsMeasure, type Aggregation, type ChartMapping } from './types';

export interface ColumnMappingState {
  /** Columnas con las correcciones del usuario ya aplicadas. */
  columns: ColumnProfile[];
  dimensions: ColumnProfile[];
  measures: ColumnProfile[];
  mapping: ChartMapping;
  preserveInvalid: Record<string, boolean>;
  effectiveRowCount: number;
  setColumnType: (name: string, type: ColumnType) => void;
  setDimension: (name: string) => void;
  setMeasure: (name: string) => void;
  setAggregation: (aggregation: Aggregation) => void;
  setPreserveInvalid: (columnName: string, preserve: boolean) => void;
}

export function useColumnMapping(dataset: ParsedDataset): ColumnMappingState {
  const [overrides, setOverrides] = useState<Record<string, ColumnType>>({});
  const [preserveInvalid, setPreserveInvalidState] = useState<Record<string, boolean>>({});
  const [selection, setSelection] = useState<ChartMapping>({
    dimension: null,
    measure: null,
    aggregation: 'sum',
  });

  // Al corregir un tipo hay que reperfilar la columna, no solo reetiquetarla:
  // así el usuario ve al momento cuántos valores no sobrevivirán a su elección.
  const columns = useMemo(
    () =>
      dataset.columns.map((column) => {
        const forced = overrides[column.name];
        return forced === undefined
          ? column
          : profileColumn(column.name, dataset.rows, forced);
      }),
    [dataset, overrides],
  );

  // Una columna sin un solo valor no agrupa ni mide: no se ofrece.
  const dimensions = useMemo(
    () => columns.filter((column) => column.role === 'dimension' && column.type !== 'empty'),
    [columns],
  );

  const measures = useMemo(
    () => columns.filter((column) => column.role === 'measure'),
    [columns],
  );

  // El mapeo se deriva en vez de sincronizarse: corregir un tipo puede dejar la
  // selección apuntando a una columna que ya no es válida, y recalcularla aquí
  // evita tener que reconciliar estado en un efecto.
  const mapping = useMemo<ChartMapping>(
    () => ({
      dimension: resolve(selection.dimension, dimensions),
      measure: needsMeasure(selection.aggregation)
        ? resolve(selection.measure, measures)
        : null,
      aggregation: selection.aggregation,
    }),
    [selection, dimensions, measures],
  );

  const setColumnType = useCallback((name: string, type: ColumnType) => {
    setOverrides((current) => ({ ...current, [name]: type }));
  }, []);

  const setPreserveInvalid = useCallback((columnName: string, preserve: boolean) => {
    setPreserveInvalidState((current) => ({ ...current, [columnName]: preserve }));
  }, []);

  const setDimension = useCallback((name: string) => {
    setSelection((current) => ({ ...current, dimension: name }));
  }, []);

  const setMeasure = useCallback((name: string) => {
    setSelection((current) => ({ ...current, measure: name }));
  }, []);

  const setAggregation = useCallback((aggregation: Aggregation) => {
    setSelection((current) => ({ ...current, aggregation }));
  }, []);

  const effectiveRowCount = useMemo(() => {
    if (!dataset.rows || dataset.rows.length === 0) return 0;

    const columnsWithExclusion = columns.filter(
      (col) => col.invalidCount > 0 && !preserveInvalid[col.name],
    );

    if (columnsWithExclusion.length === 0) {
      return dataset.rowCount;
    }

    let count = 0;
    for (const row of dataset.rows) {
      if (!row) continue;
      let isValid = true;
      for (const col of columnsWithExclusion) {
        const val = row[col.name];
        if (val !== null && val !== undefined) {
          if (coerceValue(val, col.type, col.format) === null) {
            isValid = false;
            break;
          }
        }
      }
      if (isValid) {
        count++;
      }
    }
    return count;
  }, [dataset.rows, dataset.rowCount, columns, preserveInvalid]);

  return {
    columns,
    dimensions,
    measures,
    mapping,
    preserveInvalid,
    effectiveRowCount,
    setColumnType,
    setDimension,
    setMeasure,
    setAggregation,
    setPreserveInvalid,
  };
}

/** Mantiene la elección del usuario si sigue siendo válida; si no, la primera opción. */
function resolve(chosen: string | null, available: readonly ColumnProfile[]): string | null {
  if (chosen !== null && available.some((column) => column.name === chosen)) return chosen;
  return available[0]?.name ?? null;
}
