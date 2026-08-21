import type { ColumnProfile } from '@/features/dataset/lib/column-types';
import type { ColumnMappingState } from '@/features/mapping/use-column-mapping';
import type { DatasetCapabilities } from './types';

/**
 * A partir de cuántos valores distintos una columna de texto deja de parecer
 * una clasificación y empieza a parecer un identificador. No es una frontera
 * exacta —un catálogo de 30 productos identifica igual—, solo el criterio con
 * el que la galería decide si tiene sentido ofrecer RFM.
 */
const IDENTIFIER_MIN_DISTINCT = 5;

export function isIdentifierCandidate(column: ColumnProfile): boolean {
  return column.distinctCount >= IDENTIFIER_MIN_DISTINCT;
}

/** Qué ofrece el dataset, resumido para decidir qué herramientas caben. */
export function datasetCapabilities(mapping: ColumnMappingState): DatasetCapabilities {
  const rows = mapping.effectiveRowCount;

  return {
    rowCount: rows,
    columnCount: mapping.columns.length,
    dates: mapping.dateColumns.length,
    dimensions: mapping.dimensions.length,
    measures: mapping.measures.length,
    identifiers: mapping.dimensions.filter(isIdentifierCandidate).length,
  };
}
