/** Tipo de dato de una columna, inferido o confirmado por el usuario. */
export type ColumnType = 'number' | 'date' | 'boolean' | 'text' | 'empty';

/** Papel que puede jugar una columna en un gráfico. */
export type ColumnRole = 'measure' | 'dimension';

export type DecimalSeparator = '.' | ',';
export type DateOrder = 'iso' | 'dmy' | 'mdy';

/**
 * Cómo hay que leer el texto de una columna para convertirlo a su tipo.
 *
 * Se detecta una vez por columna y no por celda, porque valores como `"1.234"`
 * son ambiguos en aislamiento (¿1234 o 1,234?) y solo el resto de la columna
 * permite resolverlos de forma coherente.
 */
export type ColumnFormat =
  | { kind: 'number'; decimal: DecimalSeparator }
  | { kind: 'date'; order: DateOrder }
  | { kind: 'none' };

export interface ColumnProfile {
  name: string;
  type: ColumnType;
  format: ColumnFormat;
  role: ColumnRole;
  /** Celdas vacías. */
  nullCount: number;
  /** Celdas no vacías que no encajan en el tipo: datos que se perderían al convertir. */
  invalidCount: number;
  distinctCount: number;
  /** `false` si se dejó de contar al alcanzar el tope (datasets muy grandes). */
  distinctCountExact: boolean;
  /** Primeros valores no vacíos, para que el usuario reconozca la columna. */
  samples: string[];
}

/**
 * Solo los números se agregan (suma, media…); todo lo demás sirve para agrupar.
 */
export function roleForType(type: ColumnType): ColumnRole {
  return type === 'number' ? 'measure' : 'dimension';
}
