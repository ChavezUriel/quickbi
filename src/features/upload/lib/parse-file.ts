import Papa from 'papaparse';
import { normalizeHeaders } from './headers';
import { FileParseError } from './parse-error';
import { profileColumns } from '@/features/dataset/lib/infer-columns';
import type {
  CellValue,
  DataRow,
  ParsedDataset,
  SupportedFileType,
} from '@/features/dataset/types';

/** Límite defensivo: todo el dataset vive en memoria, no hay servidor donde delegar. */
export const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024;

/**
 * Deriva el formato de la extensión. Se exporta para poder validar el fichero
 * antes de pagar el coste de leerlo.
 */
export function detectFileType(fileName: string): SupportedFileType {
  const extension = fileName.split('.').pop()?.toLowerCase();

  switch (extension) {
    case 'csv':
      return 'csv';
    case 'xlsx':
      return 'xlsx';
    case 'xls':
      return 'xls';
    default:
      throw new FileParseError(
        `Formato ".${extension ?? 'desconocido'}" no soportado. Usa .csv, .xlsx o .xls.`,
      );
  }
}

/**
 * Punto de entrada único: detecta el formato por extensión y delega en el parser.
 * Garantiza que SIEMPRE devolvemos la misma estructura `ParsedDataset`,
 * independientemente del formato de origen.
 *
 * Pensado para ejecutarse dentro de un Web Worker (ver `parse-file.worker.ts`):
 * ambos parsers son intensivos en CPU y bloquearían la UI en el hilo principal.
 */
export async function parseFile(file: File): Promise<ParsedDataset> {
  if (file.size === 0) {
    throw new FileParseError('El archivo está vacío.');
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new FileParseError(
      `El archivo supera el máximo de 100 MB (${formatBytes(file.size)}).`,
    );
  }

  const fileType = detectFileType(file.name);

  return fileType === 'csv' ? parseCsv(file, fileType) : parseExcel(file, fileType);
}

async function parseCsv(file: File, fileType: SupportedFileType): Promise<ParsedDataset> {
  const { data, errors } = Papa.parse<string[]>(await file.text(), {
    // Leemos como array-de-arrays para que la normalización de cabeceras sea
    // idéntica a la ruta de Excel, en lugar de delegarla en Papa.
    header: false,
    // Deliberadamente desactivado: la inferencia automática destruye datos
    // (`"007"` → `7`, teléfonos, IDs por encima de MAX_SAFE_INTEGER).
    // Los tipos se deciden en el paso de mapeo, donde el usuario los ve.
    dynamicTyping: false,
    skipEmptyLines: 'greedy',
  });

  const blocking = errors.find(
    (error) => error.type === 'Delimiter' || error.type === 'Quotes',
  );

  if (data.length === 0) {
    throw new FileParseError(
      blocking ? `CSV inválido: ${blocking.message}` : 'El archivo CSV no tiene filas.',
    );
  }

  const [headerRow = [], ...bodyRows] = data;

  return buildDataset({
    fileName: file.name,
    fileType,
    headerRow,
    bodyRows,
    warnings: blocking ? [`Se han encontrado filas malformadas: ${blocking.message}`] : [],
  });
}

async function parseExcel(file: File, fileType: SupportedFileType): Promise<ParsedDataset> {
  // Import diferido: SheetJS pesa ~430 KB minificado y los usuarios que solo
  // suben CSV no deberían descargarlo.
  const XLSX = await import('xlsx');

  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });

  const [sheetName, ...ignoredSheets] = workbook.SheetNames;
  if (!sheetName) {
    throw new FileParseError('El libro de Excel no contiene ninguna hoja.');
  }

  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new FileParseError(`No se pudo leer la hoja "${sheetName}".`);
  }

  // `header: 1` nos da array-de-arrays: control total sobre el orden de las
  // columnas y sobre los nombres de cabecera.
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: null,
    raw: true,
    blankrows: false,
  });

  if (aoa.length === 0) {
    throw new FileParseError(`La hoja "${sheetName}" está vacía.`);
  }

  const [headerRow = [], ...bodyRows] = aoa;

  return buildDataset({
    fileName: file.name,
    fileType,
    headerRow,
    bodyRows,
    // Un libro multi-hoja es lo normal: decirlo evita que el usuario crea que
    // ha importado todo el fichero.
    warnings:
      ignoredSheets.length > 0
        ? [
            `Se ha importado la hoja "${sheetName}". Se han ignorado ${ignoredSheets.length} hoja(s): ${ignoredSheets.join(', ')}.`,
          ]
        : [],
  });
}

interface BuildDatasetInput {
  fileName: string;
  fileType: SupportedFileType;
  headerRow: readonly unknown[];
  bodyRows: readonly (readonly unknown[])[];
  warnings: string[];
}

/**
 * Tronco común de ambos formatos: cabecera + filas crudas → `ParsedDataset`.
 * Mantenerlo compartido garantiza que un CSV y un XLSX con el mismo contenido
 * produzcan exactamente la misma estructura.
 */
function buildDataset({
  fileName,
  fileType,
  headerRow,
  bodyRows,
  warnings,
}: BuildDatasetInput): ParsedDataset {
  const names = normalizeHeaders(headerRow);

  const rows = bodyRows.map((cells) => {
    const row: DataRow = {};
    for (const [index, name] of names.entries()) {
      row[name] = normalizeCell(cells[index]);
    }
    return row;
  });

  // Celdas más allá de la última cabecera: se pierden al construir la fila.
  const widestRow = bodyRows.reduce((widest, cells) => Math.max(widest, cells.length), 0);
  const allWarnings =
    widestRow > names.length
      ? [
          ...warnings,
          `Algunas filas tienen más valores (${widestRow}) que columnas de cabecera (${names.length}); el exceso se ha descartado.`,
        ]
      : warnings;

  return {
    fileName,
    fileType,
    // El perfilado recorre todas las filas, así que se hace aquí —dentro del
    // worker— y no al pintar el mapeo en el hilo principal.
    columns: profileColumns(names, rows),
    rows,
    rowCount: rows.length,
    warnings: allWarnings,
  };
}

/**
 * Reduce cualquier valor crudo al conjunto `CellValue`, tratando como nulo
 * lo que no representa un dato (cadenas vacías, NaN, fechas inválidas).
 */
function normalizeCell(value: unknown): CellValue {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'boolean') return value;

  const text = String(value);
  return text.trim() === '' ? null : text;
}

function formatBytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
