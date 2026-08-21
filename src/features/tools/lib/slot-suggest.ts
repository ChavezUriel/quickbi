import type { ColumnProfile } from '@/features/dataset/lib/column-types';

/**
 * Propuesta automática de qué columna va en cada hueco de una herramienta.
 *
 * Las herramientas de cliente necesitan saber cuál de las columnas de texto
 * *es* el cliente, y eso el tipo no lo dice. Adivinarlo por el nombre acierta
 * la mayoría de las veces y, cuando falla, el usuario lo cambia en un
 * desplegable: es preferible a obligarle a rellenar tres huecos siempre.
 */

/** Minúsculas y sin acentos: `Año` y `ANO` deben casar con la misma pista. */
export function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('es');
}

export type CardinalityPreference = 'alta' | 'baja' | 'indiferente';

export interface SuggestOptions {
  /**
   * Palabras que delatan la columna, de la más específica a la más genérica.
   * Una pista temprana gana a una tardía aunque la tardía case exacta.
   */
  hints: readonly string[];
  /**
   * Desempate cuando ninguna pista casa: un cliente es la columna con más
   * valores distintos, una categoría la que menos.
   */
  cardinality?: CardinalityPreference;
}

interface Scored {
  column: ColumnProfile;
  /** Menor es mejor. */
  rank: number;
}

/**
 * Columna más probable para un hueco, o `null` si no hay ninguna candidata.
 *
 * El nombre exacto gana al nombre que contiene la pista, y ambos ganan a
 * cualquier desempate por cardinalidad: que una columna se llame «cliente» es
 * mucha más señal que tener muchos valores distintos.
 */
export function suggestColumn(
  candidates: readonly ColumnProfile[],
  options: SuggestOptions,
): string | null {
  if (candidates.length === 0) return null;

  const { hints, cardinality = 'indiferente' } = options;
  const scored: Scored[] = [];

  for (const column of candidates) {
    const name = normalizeName(column.name);
    const exact = hints.findIndex((hint) => name === normalizeName(hint));
    if (exact >= 0) {
      scored.push({ column, rank: exact });
      continue;
    }

    const partial = hints.findIndex((hint) => name.includes(normalizeName(hint)));
    if (partial >= 0) {
      // Detrás de todas las coincidencias exactas, conservando el orden de
      // las pistas entre sí.
      scored.push({ column, rank: hints.length + partial });
    }
  }

  if (scored.length > 0) {
    const best = scored.reduce((a, b) => (b.rank < a.rank ? b : a));
    return best.column.name;
  }

  if (cardinality === 'indiferente') return candidates[0]?.name ?? null;

  const best = candidates.reduce((a, b) =>
    cardinality === 'alta'
      ? b.distinctCount > a.distinctCount
        ? b
        : a
      : b.distinctCount < a.distinctCount
        ? b
        : a,
  );
  return best.name;
}
