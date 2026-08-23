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

const SUBTYPE_RELEVANT_HINTS: Record<string, readonly string[]> = {
  geo: ['pais', 'territorio', 'estado', 'region', 'provincia', 'ciudad', 'comunidad', 'zona', 'ubicacion', 'location', 'country', 'city', 'state'],
  customer: ['cliente', 'customer', 'usuario', 'user', 'comprador', 'buyer', 'socio', 'contacto', 'contact', 'titular', 'account'],
  product: ['producto', 'product', 'item', 'articulo', 'sku', 'servicio', 'modelo'],
  currency: ['importe', 'precio', 'monto', 'revenue', 'venta', 'sales', 'coste', 'costo', 'valor', 'total', 'ingreso'],
  funnel_stage: ['etapa', 'fase', 'step', 'stage', 'funnel', 'pipeline', 'embudo', 'proceso'],
  integer: ['cantidad', 'unidades', 'volumen', 'conteo', 'count', 'qty'],
};

/**
 * Columna más probable para un hueco, o `null` si no hay ninguna candidata.
 *
 * El nombre exacto gana al subtipo semántico, este gana al nombre que contiene
 * la pista, y todos ganan a cualquier desempate por cardinalidad.
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

    // 1. Coincidencia exacta por nombre
    const exact = hints.findIndex((hint) => name === normalizeName(hint));
    if (exact >= 0) {
      scored.push({ column, rank: exact });
      continue;
    }

    // 2. Coincidencia por subtipo semántico (ajustado por el usuario o detectado)
    const relevantHints = column.subtype ? SUBTYPE_RELEVANT_HINTS[column.subtype] : undefined;
    if (relevantHints) {
      const subtypeMatchIdx = hints.findIndex((hint) =>
        relevantHints.some((rh) => normalizeName(hint) === rh || normalizeName(hint).includes(rh)),
      );
      if (subtypeMatchIdx >= 0) {
        scored.push({ column, rank: hints.length + subtypeMatchIdx });
        continue;
      }
    }

    // 3. Coincidencia parcial por nombre
    const partial = hints.findIndex((hint) => name.includes(normalizeName(hint)));
    if (partial >= 0) {
      scored.push({ column, rank: hints.length * 2 + partial });
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

