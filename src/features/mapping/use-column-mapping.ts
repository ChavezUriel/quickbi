import { useCallback, useMemo, useState } from 'react';
import { coerceValue, profileColumn } from '@/features/dataset/lib/infer-columns';
import type { ColumnProfile, ColumnType } from '@/features/dataset/lib/column-types';
import type { ParsedDataset } from '@/features/dataset/types';

export interface ColumnMappingState {
  /** Columnas con las correcciones del usuario ya aplicadas. */
  columns: ColumnProfile[];
  /** Columnas por las que se puede agrupar (texto y booleanos). */
  dimensions: ColumnProfile[];
  /** Columnas numéricas: las únicas que se pueden agregar. */
  measures: ColumnProfile[];
  /** Candidatas a eje temporal del cuadro de mando. */
  dateColumns: ColumnProfile[];
  preserveInvalid: Record<string, boolean>;
  effectiveRowCount: number;
  setColumnType: (name: string, type: ColumnType) => void;
  setPreserveInvalid: (columnName: string, preserve: boolean) => void;
}

export function useColumnMapping(dataset: ParsedDataset): ColumnMappingState {
  const [overrides, setOverrides] = useState<Record<string, ColumnType>>({});
  const [preserveInvalid, setPreserveInvalidState] = useState<Record<string, boolean>>({});

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
    dateColumns,
    preserveInvalid,
    effectiveRowCount,
    setColumnType,
    setPreserveInvalid,
  };
}
