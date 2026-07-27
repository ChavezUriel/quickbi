/**
 * Tipos del dominio de ingesta de datos.
 * Todo el parsing ocurre en memoria: los datos NUNCA salen del navegador.
 */

/** Valor crudo de una celda tras el parsing (antes de la inferencia de tipos del mapeo). */
export type CellValue = string | number | boolean | Date | null;

/** Fila del dataset: mapa columna → valor. */
export type DataRow = Record<string, CellValue>;

export type SupportedFileType = 'csv' | 'xlsx';

/** Dataset parseado y residente en memoria. */
export interface ParsedDataset {
  fileName: string;
  fileType: SupportedFileType;
  /** Nombres de columna normalizados (sin duplicados, sin espacios extremos). */
  columns: string[];
  rows: DataRow[];
  rowCount: number;
}
