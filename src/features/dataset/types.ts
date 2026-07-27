/**
 * Tipos del dominio de ingesta de datos.
 * Todo el parsing ocurre en memoria: los datos NUNCA salen del navegador.
 */

import type { ColumnProfile } from './lib/column-types';

/** Valor crudo de una celda tras el parsing (antes de la inferencia de tipos del mapeo). */
export type CellValue = string | number | boolean | Date | null;

/** Fila del dataset: mapa columna → valor. */
export type DataRow = Record<string, CellValue>;

export type SupportedFileType = 'csv' | 'xlsx' | 'xls';

/** Dataset parseado y residente en memoria. */
export interface ParsedDataset {
  fileName: string;
  /** Formato real de origen: un `.xls` no se etiqueta como `xlsx`. */
  fileType: SupportedFileType;
  /**
   * Columnas en orden, con el nombre ya normalizado (sin duplicados ni espacios
   * extremos) y el perfil de tipos inferido durante el parsing.
   */
  columns: ColumnProfile[];
  rows: DataRow[];
  rowCount: number;
  /**
   * Avisos no fatales que el usuario debe ver: hojas de Excel ignoradas,
   * filas malformadas descartadas, etc. Nunca se descartan en silencio.
   */
  warnings: string[];
}
