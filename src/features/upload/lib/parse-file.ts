import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import type { CellValue, DataRow, ParsedDataset } from '../types';

const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB, límite defensivo en memoria

/** Error de dominio para fallos de parsing (permite distinguirlos de errores inesperados). */
export class FileParseError extends Error {}

/**
 * Punto de entrada único: detecta el formato por extensión y delega en el parser.
 * Garantiza que SIEMPRE devolvemos la misma estructura `ParsedDataset`,
 * independientemente del formato de origen.
 */
export async function parseFile(file: File): Promise<ParsedDataset> {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new FileParseError(
      `El archivo supera el máximo de 100 MB (${formatBytes(file.size)}).`,
    );
  }

  const extension = file.name.split('.').pop()?.toLowerCase();

  switch (extension) {
    case 'csv':
      return parseCsv(file);
    case 'xlsx':
    case 'xls':
      return parseExcel(file);
    default:
      throw new FileParseError(
        `Formato ".${extension ?? 'desconocido'}" no soportado. Usa .csv o .xlsx.`,
      );
  }
}

function parseCsv(file: File): Promise<ParsedDataset> {
  return new Promise((resolve, reject) => {
    const dedupe = createHeaderDeduper();

    Papa.parse<DataRow>(file, {
      header: true,
      dynamicTyping: true, // infiere number/boolean automáticamente
      skipEmptyLines: 'greedy',
      transformHeader: (header) => dedupe(header),
      complete: ({ data, meta, errors }) => {
        if (data.length === 0 && errors.length > 0) {
          reject(new FileParseError(`CSV inválido: ${errors[0].message}`));
          return;
        }
        resolve({
          fileName: file.name,
          fileType: 'csv',
          columns: meta.fields ?? [],
          rows: data,
          rowCount: data.length,
        });
      },
      error: (error) =>
        reject(new FileParseError(`No se pudo leer el CSV: ${error.message}`)),
    });
  });
}

async function parseExcel(file: File): Promise<ParsedDataset> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new FileParseError('El libro de Excel no contiene ninguna hoja.');
  }

  // Parseamos como array-de-arrays (header: 1) para tener control total
  // sobre el orden de columnas y los nombres de cabecera.
  const aoa = XLSX.utils.sheet_to_json<CellValue[]>(workbook.Sheets[sheetName], {
    header: 1,
    defval: null,
    raw: true,
    blankrows: false,
  });

  if (aoa.length === 0) {
    throw new FileParseError(`La hoja "${sheetName}" está vacía.`);
  }

  const dedupe = createHeaderDeduper();
  const columns = (aoa[0] ?? []).map((cell, i) =>
    dedupe(String(cell ?? '').trim() || `columna_${i + 1}`),
  );

  const rows: DataRow[] = aoa
    .slice(1)
    .map((row) => Object.fromEntries(columns.map((col, i) => [col, row[i] ?? null])));

  return {
    fileName: file.name,
    fileType: 'xlsx',
    columns,
    rows,
    rowCount: rows.length,
  };
}

/**
 * Evita colisiones de cabeceras duplicadas, que de otro modo sobrescribirían
 * datos silenciosamente al construir los objetos fila.
 * Ej.: ["total", "total"] → ["total", "total_2"]
 */
function createHeaderDeduper(): (header: string) => string {
  const counts = new Map<string, number>();
  return (header) => {
    const base = header || 'columna';
    const seen = counts.get(base) ?? 0;
    counts.set(base, seen + 1);
    return seen === 0 ? base : `${base}_${seen + 1}`;
  };
}

function formatBytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
