import { useCallback, useMemo, useState } from 'react';
import { profileColumn } from '@/features/dataset/lib/infer-columns';
import type { ColumnProfile, ColumnType } from '@/features/dataset/lib/column-types';
import type { ParsedDataset } from '@/features/dataset/types';
import { needsMeasure, type Aggregation, type ChartMapping } from './types';

export interface ColumnMappingState {
  /** Columnas con las correcciones del usuario ya aplicadas. */
  columns: ColumnProfile[];
  dimensions: ColumnProfile[];
  measures: ColumnProfile[];
  mapping: ChartMapping;
  setColumnType: (name: string, type: ColumnType) => void;
  setDimension: (name: string) => void;
  setMeasure: (name: string) => void;
  setAggregation: (aggregation: Aggregation) => void;
}

export function useColumnMapping(dataset: ParsedDataset): ColumnMappingState {
  const [overrides, setOverrides] = useState<Record<string, ColumnType>>({});
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

  const setDimension = useCallback((name: string) => {
    setSelection((current) => ({ ...current, dimension: name }));
  }, []);

  const setMeasure = useCallback((name: string) => {
    setSelection((current) => ({ ...current, measure: name }));
  }, []);

  const setAggregation = useCallback((aggregation: Aggregation) => {
    setSelection((current) => ({ ...current, aggregation }));
  }, []);

  return {
    columns,
    dimensions,
    measures,
    mapping,
    setColumnType,
    setDimension,
    setMeasure,
    setAggregation,
  };
}

/** Mantiene la elección del usuario si sigue siendo válida; si no, la primera opción. */
function resolve(chosen: string | null, available: readonly ColumnProfile[]): string | null {
  if (chosen !== null && available.some((column) => column.name === chosen)) return chosen;
  return available[0]?.name ?? null;
}
