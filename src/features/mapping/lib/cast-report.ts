import type { CellValue, ParsedDataset } from '@/features/dataset/types';
import type { ColumnFormat, ColumnType } from '@/features/dataset/lib/column-types';
import { coerceValue } from '@/features/dataset/lib/infer-columns';

export interface CastFailure {
  sourceFile: string;
  rowNumber: number; // 1-indexed, human-friendly
  originalValue: string; // display-friendly representation
}

/**
 * Genera un informe de las filas cuyo valor no se puede convertir al tipo indicado.
 * Recorre todas las filas y devuelve las que fallan la coerción.
 */
export function generateCastReport(
  dataset: ParsedDataset,
  columnName: string,
  type: ColumnType,
  format: ColumnFormat,
): CastFailure[] {
  const failures: CastFailure[] = [];

  for (let i = 0; i < dataset.rows.length; i++) {
    const row = dataset.rows[i];
    if (!row) continue;
    const value = row[columnName];
    
    // Skip nulls — they aren't cast failures
    if (value === null || value === undefined) continue;
    
    const coerced = coerceValue(value, type, format);
    if (coerced === null) {
      // Determine source file from rowMeta if available
      const meta = dataset.rowMeta?.[i];
      failures.push({
        sourceFile: meta?.sourceFile ?? dataset.fileName,
        rowNumber: meta?.sourceRowNumber ?? (i + 1),
        originalValue: displayValue(value),
      });
    }
  }

  return failures;
}

function displayValue(value: CellValue): string {
  if (value === null) return '';
  if (value instanceof Date) return value.toISOString();
  return String(value);
}
