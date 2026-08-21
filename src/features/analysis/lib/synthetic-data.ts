import type { DataRow, ParsedDataset } from '../../dataset/types';
import type { AnalysisRow } from '../types';

export interface SyntheticRowSpec {
  fecha: string | null;
  categoria: string;
  region: string;
  cliente_id: string;
  ventas: number | null;
  unidades: number | null;
  descuento: number | null;
}

/**
 * Genera un conjunto sintético determinista de transacciones e-commerce / BI.
 * Contiene importes, fechas en múltiples períodos, categorías, regiones, clientes,
 * valores nulos y casos borde conocidos.
 */
export function generateSyntheticRows(): SyntheticRowSpec[] {
  return [
    // --- Período Actual (Julio 2026) ---
    { fecha: '2026-07-01', categoria: 'Electrónica', region: 'Norte', cliente_id: 'C001', ventas: 100, unidades: 2, descuento: 10 },
    { fecha: '2026-07-05', categoria: 'Electrónica', region: 'Norte', cliente_id: 'C001', ventas: 200, unidades: 4, descuento: 20 },
    { fecha: '2026-07-10', categoria: 'Electrónica', region: 'Sur', cliente_id: 'C002', ventas: 150, unidades: 3, descuento: 0 },
    { fecha: '2026-07-12', categoria: 'Hogar', region: 'Norte', cliente_id: 'C003', ventas: 80, unidades: 1, descuento: 5 },
    { fecha: '2026-07-15', categoria: 'Hogar', region: 'Sur', cliente_id: 'C004', ventas: 120, unidades: 2, descuento: 15 },
    { fecha: '2026-07-20', categoria: 'Ropa', region: 'Este', cliente_id: 'C005', ventas: 50, unidades: 1, descuento: 0 },
    { fecha: '2026-07-25', categoria: 'Ropa', region: 'Oeste', cliente_id: 'C006', ventas: 30, unidades: 1, descuento: null },

    // --- Período Anterior Implicito (Junio 2026) ---
    { fecha: '2026-06-01', categoria: 'Electrónica', region: 'Norte', cliente_id: 'C001', ventas: 250, unidades: 5, descuento: 25 },
    { fecha: '2026-06-10', categoria: 'Electrónica', region: 'Sur', cliente_id: 'C002', ventas: 100, unidades: 2, descuento: 10 },
    { fecha: '2026-06-15', categoria: 'Hogar', region: 'Norte', cliente_id: 'C003', ventas: 100, unidades: 2, descuento: 10 },
    { fecha: '2026-06-20', categoria: 'Jardín', region: 'Norte', cliente_id: 'C007', ventas: 90, unidades: 3, descuento: 0 }, // Categoria que desaparece en Julio
    { fecha: '2026-06-25', categoria: 'Ropa', region: 'Este', cliente_id: 'C005', ventas: 40, unidades: 1, descuento: 5 },

    // --- Mismo Período Año Anterior (Julio 2025) ---
    { fecha: '2025-07-01', categoria: 'Electrónica', region: 'Norte', cliente_id: 'C001', ventas: 80, unidades: 2, descuento: 0 },
    { fecha: '2025-07-15', categoria: 'Hogar', region: 'Sur', cliente_id: 'C004', ventas: 60, unidades: 1, descuento: 0 },

    // --- Filas Especiales / Casos Borde ---
    { fecha: null, categoria: 'SinFechaCat', region: 'Norte', cliente_id: 'C099', ventas: 500, unidades: 10, descuento: 0 }, // Sin fecha
    { fecha: '2026-07-28', categoria: 'Electrónica', region: 'Norte', cliente_id: 'C010', ventas: null, unidades: null, descuento: null }, // Venta nula
  ];
}

/**
 * Convierte las filas especificados a `AnalysisRow[]` directamente para testear el motor de exploración.
 */
export function buildSyntheticAnalysisRows(specs = generateSyntheticRows()): AnalysisRow[] {
  return specs.map((s) => ({
    day: s.fecha,
    dims: {
      categoria: s.categoria,
      region: s.region,
      cliente_id: s.cliente_id,
    },
    values: {
      ventas: s.ventas,
      unidades: s.unidades,
      descuento: s.descuento,
    },
  }));
}

/**
 * Convierte las filas especificados a `ParsedDataset` emulando el parsing crudo de ficheros CSV/Excel.
 */
export function buildSyntheticParsedDataset(specs = generateSyntheticRows()): ParsedDataset {
  const rows: DataRow[] = specs.map((s) => ({
    Fecha: s.fecha,
    Categoría: s.categoria,
    Región: s.region,
    ClienteID: s.cliente_id,
    Ventas: s.ventas !== null ? String(s.ventas) : null,
    Unidades: s.unidades !== null ? String(s.unidades) : null,
    Descuento: s.descuento !== null ? String(s.descuento) : null,
  }));

  return {
    id: 'synthetic-dataset-001',
    fileName: 'synthetic_transactions.csv',
    fileType: 'csv',
    columns: [
      { name: 'Fecha', type: 'date', format: { kind: 'date', order: 'iso' }, role: 'dimension', nullCount: 1, invalidCount: 0, distinctCount: 14, distinctCountExact: true, samples: ['2026-07-01'] },
      { name: 'Categoría', type: 'text', format: { kind: 'none' }, role: 'dimension', nullCount: 0, invalidCount: 0, distinctCount: 5, distinctCountExact: true, samples: ['Electrónica'] },
      { name: 'Región', type: 'text', format: { kind: 'none' }, role: 'dimension', nullCount: 0, invalidCount: 0, distinctCount: 4, distinctCountExact: true, samples: ['Norte'] },
      { name: 'ClienteID', type: 'text', format: { kind: 'none' }, role: 'dimension', nullCount: 0, invalidCount: 0, distinctCount: 8, distinctCountExact: true, samples: ['C001'] },
      { name: 'Ventas', type: 'number', format: { kind: 'number', decimal: '.' }, role: 'measure', nullCount: 1, invalidCount: 0, distinctCount: 12, distinctCountExact: true, samples: ['100'] },
      { name: 'Unidades', type: 'number', format: { kind: 'number', decimal: '.' }, role: 'measure', nullCount: 1, invalidCount: 0, distinctCount: 5, distinctCountExact: true, samples: ['2'] },
      { name: 'Descuento', type: 'number', format: { kind: 'number', decimal: '.' }, role: 'measure', nullCount: 2, invalidCount: 0, distinctCount: 5, distinctCountExact: true, samples: ['10'] },
    ],
    rows,
    rowCount: rows.length,
    warnings: [],
  };
}
