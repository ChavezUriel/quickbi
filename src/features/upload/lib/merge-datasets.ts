import type { ParsedDataset, RowMeta } from '@/features/dataset/types';

/**
 * Genera la huella digital (fingerprint) de la estructura de un dataset.
 * Ordena alfabéticamente los nombres de las columnas y los une por '|'.
 */
export function getSchemaFingerprint(dataset: ParsedDataset): string {
  return dataset.columns
    .map((c) => c.name)
    .slice()
    .sort((a, b) => a.localeCompare(b))
    .join('|');
}

/**
 * Fusiona múltiples datasets que comparten la misma estructura de columnas.
 * Concatena filas, toma las columnas del primer dataset, suma rowCount,
 * combina avisos y asigna un id único.
 */
export function mergeDatasets(datasets: ParsedDataset[]): ParsedDataset | null {
  if (!datasets || datasets.length === 0) {
    return null;
  }

  const first = datasets[0];
  if (!first) {
    return null;
  }

  if (datasets.length === 1) {
    return first;
  }

  const allRows = datasets.flatMap((d) => d.rows);
  const totalRowCount = datasets.reduce((acc, d) => acc + d.rowCount, 0);
  const allWarnings = Array.from(new Set(datasets.flatMap((d) => d.warnings)));
  const fileNames = datasets.map((d) => d.fileName).join(', ');

  const rowMeta: RowMeta[] = datasets.flatMap((d) =>
    d.rows.map((_, i) => ({
      sourceFile: d.rowMeta?.[i]?.sourceFile ?? d.fileName,
      sourceRowNumber: d.rowMeta?.[i]?.sourceRowNumber ?? i + 1,
    })),
  );

  return {
    id: `merged-${datasets.map((d) => d.id).join('-')}`,
    fileName: `Combinado: ${fileNames}`,
    fileType: first.fileType,
    columns: first.columns,
    rows: allRows,
    rowCount: totalRowCount,
    warnings: allWarnings,
    rowMeta,
  };
}

