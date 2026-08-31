/**
 * Normaliza la fila de cabecera de un fichero a nombres de columna únicos.
 *
 * Sin esto, dos columnas con el mismo nombre se sobrescribirían silenciosamente
 * al construir los objetos fila (`Record<columna, valor>`), perdiendo datos.
 *
 * Reglas:
 *  - se recortan los espacios extremos (`" total "` → `"total"`),
 *  - una cabecera vacía recibe un nombre posicional (`columna_3`),
 *  - los duplicados se desambiguan con el primer sufijo libre.
 *
 * El sufijo se busca contra los nombres ya emitidos, no con un contador ciego:
 * `["total", "total", "total_2"]` → `["total", "total_2", "total_2_2"]`.
 * Un contador ciego habría producido `total_2` dos veces.
 */
const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export function normalizeHeaders(headerRow: readonly unknown[]): string[] {
  const used = new Set<string>();

  return headerRow.map((cell, index) => {
    let base = String(cell ?? '').trim() || `columna_${index + 1}`;

    if (DANGEROUS_KEYS.has(base)) {
      base = `${base}_col`;
    }

    if (!used.has(base)) {
      used.add(base);
      return base;
    }

    let suffix = 2;
    while (used.has(`${base}_${suffix}`)) suffix += 1;

    const unique = `${base}_${suffix}`;
    used.add(unique);
    return unique;
  });
}
