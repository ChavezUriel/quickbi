import { EMPTY_LABEL, type AnalysisRow } from '@/features/analysis/types';

/**
 * Conciliación de datos y ficheros.
 *
 * Empareja registros por una clave identificadora (factura, transacción, SKU, ID)
 * comparando dos fuentes o dos campos de importe. Clasifica cada registro en:
 * - Exacto: Coincidencia perfecta (dentro del margen de tolerancia).
 * - Discrepancia: Presente en ambos pero con descuadre de importe.
 * - Solo en A: Registrado en la Fuente/Columna A pero ausente en B.
 * - Solo en B: Registrado en la Fuente/Columna B pero ausente en A.
 */

export type ReconciliationStatus = 'exacto' | 'discrepancia' | 'solo_a' | 'solo_b';

export interface ReconciledRecord {
  /** Clave identificadora del registro. */
  key: string;
  /** Importe o valor registrado en la Fuente A. */
  valueA: number;
  /** Importe o valor registrado en la Fuente B. */
  valueB: number;
  /** Diferencia con signo (`valueA - valueB`). */
  delta: number;
  /** Diferencia en valor absoluto (`|valueA - valueB|`). */
  absDelta: number;
  /** Variación porcentual (`(valueA - valueB) / valueB * 100`) o null si valueB = 0. */
  deltaPercent: number | null;
  /** Clasificación del estado de conciliación. */
  status: ReconciliationStatus;
  /** Descripción explicativa del descuadre. */
  explanation: string;
}

export interface StatusDistribution {
  status: ReconciliationStatus;
  label: string;
  count: number;
  valueA: number;
  valueB: number;
  netDelta: number;
  absDelta: number;
  share: number;
  tone: 'bueno' | 'aviso' | 'malo' | 'neutro';
}

export interface ReconciliationSummary {
  /** Total acumulado en Fuente A. */
  totalA: number;
  /** Total acumulado en Fuente B. */
  totalB: number;
  /** Descuadre neto global (`totalA - totalB`). */
  netDelta: number;
  /** Suma total de diferencias absolutas (`Sum(|A - B|)`). */
  totalDiscrepancy: number;
  /** Cantidad total de claves únicas analizadas. */
  totalKeys: number;
  /** Tasa de registros que coinciden exactamente (`exactCount / totalKeys * 100`). */
  exactMatchRate: number;
  /** Tasa de emparejamiento general (`(exactCount + discrepancyCount) / totalKeys * 100`). */
  matchRate: number;
  /** Desglose por estado de conciliación. */
  statusBreakdown: StatusDistribution[];
}

export interface ReconciliationResult {
  /** Lista de registros conciliados ordenados por diferencia absoluta descendente. */
  records: ReconciledRecord[];
  /** Resumen global del cuadre. */
  summary: ReconciliationSummary;
  /** Filas ignoradas por falta de clave identificadora. */
  ignoredRows: number;
}

export interface ReconciliationParams {
  /** Columna de dimensión que actúa como clave única de cruce. */
  keyDim: string;
  /** Columna de importe principal (o importe de Fuente A). */
  valueAColumn: string;
  /** Columna de importe secundario (Fuente B, en modo dual_columns). */
  valueBColumn?: string | null;
  /** Columna discriminadora de fuente (en modo source_dimension). */
  sourceDim?: string | null;
  /** Valor de la dimensión que identifica a la Fuente A. */
  sourceAValue?: string;
  /** Valor de la dimensión que identifica a la Fuente B. */
  sourceBValue?: string;
  /** Margen de tolerancia para considerar dos valores exactos (por defecto 0.01). */
  tolerance?: number;
}

/**
 * Realiza el cruce y cálculo de conciliación de registros.
 * Función pura: segura ante valores nulos, divisiones por cero y registros huérfanos.
 */
export function computeReconciliation(
  rows: readonly AnalysisRow[],
  params: ReconciliationParams,
): ReconciliationResult {
  const {
    keyDim,
    valueAColumn,
    valueBColumn = null,
    sourceDim = null,
    sourceAValue = '',
    sourceBValue = '',
    tolerance = 0.01,
  } = params;

  let ignoredRows = 0;

  interface KeyDraft {
    valA: number;
    valB: number;
    hasA: boolean;
    hasB: boolean;
  }

  const drafts = new Map<string, KeyDraft>();

  const isSourceDimMode = sourceDim !== null && sourceDim !== '' && sourceAValue !== '' && sourceBValue !== '';

  for (const row of rows) {
    const key = row.dims[keyDim];

    if (key === undefined || key === EMPTY_LABEL || key.trim() === '') {
      ignoredRows += 1;
      continue;
    }

    const trimmedKey = key.trim();

    let existing = drafts.get(trimmedKey);
    if (!existing) {
      existing = { valA: 0, valB: 0, hasA: false, hasB: false };
      drafts.set(trimmedKey, existing);
    }

    if (isSourceDimMode) {
      // Modo por columna de fuente
      const sourceVal = row.dims[sourceDim!];
      const amount = row.values[valueAColumn] ?? 0;

      if (sourceVal === sourceAValue) {
        existing.valA += Number.isFinite(amount) ? amount : 0;
        existing.hasA = true;
      } else if (sourceVal === sourceBValue) {
        existing.valB += Number.isFinite(amount) ? amount : 0;
        existing.hasB = true;
      }
    } else {
      // Modo por dos columnas de importe en la misma fila
      const valA = row.values[valueAColumn];
      const valB = valueBColumn ? row.values[valueBColumn] : undefined;

      if (valA !== undefined && valA !== null && Number.isFinite(valA)) {
        existing.valA += valA;
        existing.hasA = true;
      }

      if (valB !== undefined && valB !== null && Number.isFinite(valB)) {
        existing.valB += valB;
        existing.hasB = true;
      }
    }
  }

  if (drafts.size === 0) {
    return {
      records: [],
      summary: emptySummary(),
      ignoredRows,
    };
  }

  const records: ReconciledRecord[] = Array.from(drafts.entries()).map(([key, draft]) => {
    const valA = Math.round(draft.valA * 100) / 100;
    const valB = Math.round(draft.valB * 100) / 100;
    const delta = Math.round((valA - valB) * 100) / 100;
    const absDelta = Math.abs(delta);

    let status: ReconciliationStatus = 'exacto';
    let explanation = 'Cuadre exacto';

    if (!draft.hasA && draft.hasB) {
      status = 'solo_b';
      explanation = 'Falta en Fuente A (solo registrado en B)';
    } else if (draft.hasA && !draft.hasB) {
      status = 'solo_a';
      explanation = 'Falta en Fuente B (solo registrado en A)';
    } else if (absDelta > tolerance) {
      status = 'discrepancia';
      explanation = `Diferencia de ${delta > 0 ? '+' : ''}${delta.toFixed(2)}`;
    }

    let deltaPercent: number | null = null;
    if (valB !== 0 && draft.hasA && draft.hasB) {
      deltaPercent = Math.round(((valA - valB) / Math.abs(valB)) * 10000) / 100;
    }

    return {
      key,
      valueA: valA,
      valueB: valB,
      delta,
      absDelta,
      deltaPercent,
      status,
      explanation,
    };
  });

  // Ordenar por descuadre absoluto descendente (los mayores descuadres primero)
  records.sort((a, b) => b.absDelta - a.absDelta);

  const totalA = records.reduce((acc, r) => acc + r.valueA, 0);
  const totalB = records.reduce((acc, r) => acc + r.valueB, 0);
  const netDelta = Math.round((totalA - totalB) * 100) / 100;
  const totalDiscrepancy = Math.round(records.reduce((acc, r) => acc + r.absDelta, 0) * 100) / 100;
  const totalKeys = records.length;

  const exactRecords = records.filter((r) => r.status === 'exacto');
  const discrepancyRecords = records.filter((r) => r.status === 'discrepancia');
  const onlyARecords = records.filter((r) => r.status === 'solo_a');
  const onlyBRecords = records.filter((r) => r.status === 'solo_b');

  const exactMatchRate = totalKeys > 0 ? Math.round((exactRecords.length / totalKeys) * 10000) / 100 : 0;
  const matchRate = totalKeys > 0 ? Math.round(((exactRecords.length + discrepancyRecords.length) / totalKeys) * 10000) / 100 : 0;

  const statusBreakdown: StatusDistribution[] = [
    {
      status: 'exacto',
      label: 'Coincidencias exactas',
      count: exactRecords.length,
      valueA: exactRecords.reduce((acc, r) => acc + r.valueA, 0),
      valueB: exactRecords.reduce((acc, r) => acc + r.valueB, 0),
      netDelta: 0,
      absDelta: 0,
      share: totalKeys > 0 ? Math.round((exactRecords.length / totalKeys) * 10000) / 100 : 0,
      tone: 'bueno',
    },
    {
      status: 'discrepancia',
      label: 'Discrepancias de importe',
      count: discrepancyRecords.length,
      valueA: discrepancyRecords.reduce((acc, r) => acc + r.valueA, 0),
      valueB: discrepancyRecords.reduce((acc, r) => acc + r.valueB, 0),
      netDelta: discrepancyRecords.reduce((acc, r) => acc + r.delta, 0),
      absDelta: discrepancyRecords.reduce((acc, r) => acc + r.absDelta, 0),
      share: totalKeys > 0 ? Math.round((discrepancyRecords.length / totalKeys) * 10000) / 100 : 0,
      tone: 'aviso',
    },
    {
      status: 'solo_a',
      label: 'Solo en Fuente A',
      count: onlyARecords.length,
      valueA: onlyARecords.reduce((acc, r) => acc + r.valueA, 0),
      valueB: 0,
      netDelta: onlyARecords.reduce((acc, r) => acc + r.valueA, 0),
      absDelta: onlyARecords.reduce((acc, r) => acc + r.valueA, 0),
      share: totalKeys > 0 ? Math.round((onlyARecords.length / totalKeys) * 10000) / 100 : 0,
      tone: 'malo',
    },
    {
      status: 'solo_b',
      label: 'Solo en Fuente B',
      count: onlyBRecords.length,
      valueA: 0,
      valueB: onlyBRecords.reduce((acc, r) => acc + r.valueB, 0),
      netDelta: -onlyBRecords.reduce((acc, r) => acc + r.valueB, 0),
      absDelta: onlyBRecords.reduce((acc, r) => acc + r.valueB, 0),
      share: totalKeys > 0 ? Math.round((onlyBRecords.length / totalKeys) * 10000) / 100 : 0,
      tone: 'malo',
    },
  ];

  return {
    records,
    summary: {
      totalA: Math.round(totalA * 100) / 100,
      totalB: Math.round(totalB * 100) / 100,
      netDelta,
      totalDiscrepancy,
      totalKeys,
      exactMatchRate,
      matchRate,
      statusBreakdown,
    },
    ignoredRows,
  };
}

function emptySummary(): ReconciliationSummary {
  return {
    totalA: 0,
    totalB: 0,
    netDelta: 0,
    totalDiscrepancy: 0,
    totalKeys: 0,
    exactMatchRate: 0,
    matchRate: 0,
    statusBreakdown: [],
  };
}
