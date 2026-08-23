import { useCallback, useMemo, useState } from 'react';
import { coerceValue, profileColumn } from '@/features/dataset/lib/infer-columns';
import type { ColumnProfile, ColumnType } from '@/features/dataset/lib/column-types';
import type { ParsedDataset } from '@/features/dataset/types';

export interface ColumnMappingState {
  /** Columnas activas con las correcciones del usuario ya aplicadas. */
  columns: ColumnProfile[];
  /** Todas las columnas del dataset con correcciones (activas y excluidas). */
  allColumns: ColumnProfile[];
  /** Columnas por las que se puede agrupar (texto y booleanos) entre las activas. */
  dimensions: ColumnProfile[];
  /** Columnas numéricas activas: las únicas que se pueden agregar. */
  measures: ColumnProfile[];
  /** Candidatas a eje temporal activas del cuadro de mando. */
  dateColumns: ColumnProfile[];
  /** Mapa de columnas excluidas (`true` si no debe usarse en herramientas). */
  excludedColumns: Record<string, boolean>;
  preserveInvalid: Record<string, boolean>;
  effectiveRowCount: number;
  setColumnType: (name: string, type: ColumnType) => void;
  setPreserveInvalid: (columnName: string, preserve: boolean) => void;
  setColumnSelected: (columnName: string, selected: boolean) => void;
  toggleColumnSelection: (columnName: string) => void;
  selectAllColumns: () => void;
  deselectAllColumns: () => void;
  isColumnSelected: (columnName: string) => boolean;
}

/** Determina si una columna está completamente vacía (sin datos válidos). */
export function isColumnEmpty(col: ColumnProfile, rowCount?: number): boolean {
  return (
    col.type === 'empty' ||
    (col.distinctCount === 0 && col.samples.length === 0) ||
    (rowCount !== undefined && rowCount > 0 && col.nullCount >= rowCount)
  );
}

export function useColumnMapping(dataset: ParsedDataset): ColumnMappingState {
  const [overrides, setOverrides] = useState<Record<string, ColumnType>>({});
  const [preserveInvalid, setPreserveInvalidState] = useState<Record<string, boolean>>({});
  const [excludedColumns, setExcludedColumns] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const col of dataset.columns) {
      if (isColumnEmpty(col, dataset.rowCount)) {
        initial[col.name] = true;
      }
    }
    return initial;
  });

  // Al corregir un tipo hay que reperfilar la columna, no solo reetiquetarla:
  // así el usuario ve al momento cuántos valores no sobrevivirán a su elección.
  const allColumns = useMemo(
    () =>
      dataset.columns.map((column) => {
        const forced = overrides[column.name];
        return forced === undefined
          ? column
          : profileColumn(column.name, dataset.rows, forced);
      }),
    [dataset, overrides],
  );

  // Columnas activas (no excluidas por el usuario)
  const columns = useMemo(
    () => allColumns.filter((column) => !excludedColumns[column.name]),
    [allColumns, excludedColumns],
  );

  // Las fechas se excluyen de las dimensiones: su sitio es el eje temporal,
  // y agrupar por día suelto produce miles de categorías de un solo dato.
  const dimensions = useMemo(
    () => columns.filter((column) => column.type === 'text' || column.type === 'boolean'),
    [columns],
  );

  const measures = useMemo(
    () => columns.filter((column) => column.type === 'number'),
    [columns],
  );

  const dateColumns = useMemo(
    () => columns.filter((column) => column.type === 'date'),
    [columns],
  );

  const setColumnType = useCallback((name: string, type: ColumnType) => {
    setOverrides((current) => ({ ...current, [name]: type }));
  }, []);

  const setPreserveInvalid = useCallback((columnName: string, preserve: boolean) => {
    setPreserveInvalidState((current) => ({ ...current, [columnName]: preserve }));
  }, []);

  const setColumnSelected = useCallback((columnName: string, selected: boolean) => {
    setExcludedColumns((current) => {
      if (selected) {
        if (!current[columnName]) return current;
        const next = { ...current };
        delete next[columnName];
        return next;
      } else {
        if (current[columnName]) return current;
        return { ...current, [columnName]: true };
      }
    });
  }, []);

  const toggleColumnSelection = useCallback((columnName: string) => {
    setExcludedColumns((current) => {
      const next = { ...current };
      if (next[columnName]) {
        delete next[columnName];
      } else {
        next[columnName] = true;
      }
      return next;
    });
  }, []);

  const selectAllColumns = useCallback(() => {
    setExcludedColumns({});
  }, []);

  const deselectAllColumns = useCallback(() => {
    const allExcluded: Record<string, boolean> = {};
    for (const col of dataset.columns) {
      allExcluded[col.name] = true;
    }
    setExcludedColumns(allExcluded);
  }, [dataset.columns]);

  const isColumnSelected = useCallback(
    (columnName: string) => !excludedColumns[columnName],
    [excludedColumns],
  );

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
    allColumns,
    dimensions,
    measures,
    dateColumns,
    excludedColumns,
    preserveInvalid,
    effectiveRowCount,
    setColumnType,
    setPreserveInvalid,
    setColumnSelected,
    toggleColumnSelection,
    selectAllColumns,
    deselectAllColumns,
    isColumnSelected,
  };
}
