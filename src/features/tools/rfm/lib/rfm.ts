import { daysBetween } from '@/features/analysis/lib/dates';
import { EMPTY_LABEL, type AnalysisRow } from '@/features/analysis/types';

/**
 * Segmentación RFM: cuándo compró por última vez, cuántas veces y por cuánto.
 *
 * Las tres cifras se convierten en tres notas del 1 al 5 comparando a cada
 * cliente con el resto, no contra un umbral inventado: «hace 40 días» es
 * reciente en un negocio y una eternidad en otro, y solo la propia cartera
 * sabe cuál es cuál. De la pareja recencia-frecuencia sale el segmento; el
 * importe se reserva para ordenar dentro de él, que es donde importa.
 */

export type RfmSegmentId =
  | 'campeones'
  | 'fieles'
  | 'prometedores'
  | 'atencion'
  | 'no_perder'
  | 'riesgo'
  | 'hibernando'
  | 'perdidos';

export interface RfmSegmentDef {
  id: RfmSegmentId;
  label: string;
  /** Qué hacer con ellos, que es para lo que sirve segmentar. */
  advice: string;
  /** Familia de color: de mejor a peor situación. */
  tone: 'bueno' | 'neutro' | 'aviso' | 'malo';
}

/**
 * Los ocho segmentos, en el orden en que se evalúan: gana la primera regla
 * que encaja. El orden importa —un cliente muy reciente y muy frecuente es
 * campeón antes que fiel— y por eso está escrito y no derivado.
 */
export const RFM_SEGMENTS: RfmSegmentDef[] = [
  {
    id: 'campeones',
    label: 'Campeones',
    advice: 'Compran mucho y hace poco. Prémialos y pídeles recomendaciones.',
    tone: 'bueno',
  },
  {
    id: 'fieles',
    label: 'Clientes fieles',
    advice: 'Compran con regularidad. Buenos candidatos a venta cruzada.',
    tone: 'bueno',
  },
  {
    id: 'prometedores',
    label: 'Nuevos y prometedores',
    advice: 'Han comprado hace poco, pero todavía poco. Ayúdalos a repetir.',
    tone: 'neutro',
  },
  {
    id: 'atencion',
    label: 'Necesitan atención',
    advice: 'Ni recientes ni frecuentes. Una oferta con límite de tiempo.',
    tone: 'neutro',
  },
  {
    id: 'no_perder',
    label: 'No se pueden perder',
    advice: 'Compraban mucho y han desaparecido. Recuperarlos es prioritario.',
    tone: 'aviso',
  },
  {
    id: 'riesgo',
    label: 'En riesgo',
    advice: 'Compraban a menudo y llevan tiempo sin aparecer. Reactívalos.',
    tone: 'aviso',
  },
  {
    id: 'hibernando',
    label: 'Hibernando',
    advice: 'Poca compra y hace tiempo. Campaña masiva de bajo coste.',
    tone: 'malo',
  },
  {
    id: 'perdidos',
    label: 'Perdidos',
    advice: 'Lo más lejano y lo menos frecuente. No inviertas mucho aquí.',
    tone: 'malo',
  },
];

export interface RfmCustomer {
  id: string;
  /** Días desde su última compra hasta el día de referencia. */
  recencyDays: number;
  /** Número de compras: pedidos distintos, o días con compra si no hay pedido. */
  frequency: number;
  monetary: number;
  r: number;
  f: number;
  m: number;
  segment: RfmSegmentId;
}

export interface RfmCell {
  r: number;
  f: number;
  customers: number;
  monetary: number;
}

export interface RfmSummary {
  segment: RfmSegmentId;
  customers: number;
  monetary: number;
  /** Porcentaje del importe total de la cartera. */
  share: number;
  avgRecency: number;
  avgFrequency: number;
  avgMonetary: number;
}

export interface RfmResult {
  customers: RfmCustomer[];
  /** Las 25 celdas de la rejilla, de R=5 a R=1 y de F=1 a F=5. */
  grid: RfmCell[];
  segments: RfmSummary[];
  referenceDay: string;
  totalMonetary: number;
  /** Filas sin cliente, sin fecha o sin importe: no entran en el cálculo. */
  ignoredRows: number;
}

export interface RfmParams {
  customerDim: string;
  amountColumn: string;
  /** Dimensión que identifica el pedido; `null` cuenta días con compra. */
  orderDim: string | null;
  /** Día desde el que se mide la recencia; `null` usa el último del dataset. */
  referenceDay: string | null;
}

interface Draft {
  lastDay: string;
  monetary: number;
  purchases: Set<string>;
}

export function computeRfm(
  rows: readonly AnalysisRow[],
  params: RfmParams,
): RfmResult {
  const { customerDim, amountColumn, orderDim } = params;

  const drafts = new Map<string, Draft>();
  let ignoredRows = 0;
  let maxDay: string | null = null;

  for (const row of rows) {
    const customer = row.dims[customerDim];
    const amount = row.values[amountColumn];

    // Sin cliente o sin fecha la fila no puede entrar: agrupar todos los
    // «(sin valor)» en un cliente inventado produciría un campeón falso.
    if (
      customer === undefined ||
      customer === EMPTY_LABEL ||
      row.day === null ||
      amount === null ||
      amount === undefined
    ) {
      ignoredRows += 1;
      continue;
    }

    if (maxDay === null || row.day > maxDay) maxDay = row.day;

    const purchase = orderDim === null ? row.day : (row.dims[orderDim] ?? row.day);
    const existing = drafts.get(customer);

    if (existing === undefined) {
      drafts.set(customer, {
        lastDay: row.day,
        monetary: amount,
        purchases: new Set([purchase]),
      });
      continue;
    }

    if (row.day > existing.lastDay) existing.lastDay = row.day;
    existing.monetary += amount;
    existing.purchases.add(purchase);
  }

  const referenceDay = params.referenceDay ?? maxDay ?? '';

  if (drafts.size === 0 || referenceDay === '') {
    return {
      customers: [],
      grid: emptyGrid(),
      segments: emptySummaries(),
      referenceDay,
      totalMonetary: 0,
      ignoredRows,
    };
  }

  const entries = [...drafts.entries()];
  const recency = entries.map(([, draft]) => daysBetween(draft.lastDay, referenceDay));
  const frequency = entries.map(([, draft]) => draft.purchases.size);
  const monetary = entries.map(([, draft]) => draft.monetary);

  // La recencia se puntúa al revés: menos días es mejor cliente.
  const rScores = quintileScores(recency, false);
  const fScores = quintileScores(frequency, true);
  const mScores = quintileScores(monetary, true);

  const customers: RfmCustomer[] = entries.map(([id], index) => {
    const r = rScores[index] ?? 1;
    const f = fScores[index] ?? 1;

    return {
      id,
      recencyDays: recency[index] ?? 0,
      frequency: frequency[index] ?? 0,
      monetary: monetary[index] ?? 0,
      r,
      f,
      m: mScores[index] ?? 1,
      segment: segmentOf(r, f),
    };
  });

  customers.sort((a, b) => b.monetary - a.monetary);

  const totalMonetary = customers.reduce((sum, customer) => sum + customer.monetary, 0);

  return {
    customers,
    grid: gridOf(customers),
    segments: summariesOf(customers, totalMonetary),
    referenceDay,
    totalMonetary,
    ignoredRows,
  };
}

/**
 * Nota del 1 al 5 según la posición del valor dentro del conjunto.
 *
 * Los empates comparten nota —se usa el punto medio del bloque de iguales—,
 * porque dos clientes con exactamente tres compras no pueden caer en quintiles
 * distintos por el orden en que estaban en el fichero.
 */
export function quintileScores(
  values: readonly number[],
  higherIsBetter: boolean,
): number[] {
  if (values.length === 0) return [];

  const sorted = [...values].sort((a, b) => a - b);
  const below = new Map<number, number>();
  const equal = new Map<number, number>();

  for (let index = 0; index < sorted.length; index += 1) {
    const value = sorted[index] ?? 0;
    if (!below.has(value)) below.set(value, index);
    equal.set(value, (equal.get(value) ?? 0) + 1);
  }

  return values.map((value) => {
    const midpoint = (below.get(value) ?? 0) + (equal.get(value) ?? 1) / 2;
    const position = Math.min(Math.floor((midpoint / sorted.length) * 5) + 1, 5);
    return higherIsBetter ? position : 6 - position;
  });
}

/**
 * Segmento a partir de la pareja recencia-frecuencia. Gana la primera regla
 * que encaja, y las reglas cubren las 25 combinaciones sin dejar hueco.
 */
export function segmentOf(r: number, f: number): RfmSegmentId {
  if (r >= 4 && f >= 4) return 'campeones';
  if (r >= 3 && f >= 3) return 'fieles';
  if (r >= 4 && f <= 2) return 'prometedores';
  if (r === 3 && f <= 2) return 'atencion';
  if (r === 1 && f >= 4) return 'no_perder';
  if (r <= 2 && f >= 3) return 'riesgo';
  if (r === 2) return 'hibernando';
  return 'perdidos';
}

function gridOf(customers: readonly RfmCustomer[]): RfmCell[] {
  const cells = emptyGrid();
  const index = new Map(cells.map((cell, position) => [`${cell.r}:${cell.f}`, position]));

  for (const customer of customers) {
    const cell = cells[index.get(`${customer.r}:${customer.f}`) ?? -1];
    if (cell === undefined) continue;
    cell.customers += 1;
    cell.monetary += customer.monetary;
  }

  return cells;
}

/** Rejilla vacía, de arriba abajo R=5..1 y de izquierda a derecha F=1..5. */
function emptyGrid(): RfmCell[] {
  const cells: RfmCell[] = [];
  for (let r = 5; r >= 1; r -= 1) {
    for (let f = 1; f <= 5; f += 1) {
      cells.push({ r, f, customers: 0, monetary: 0 });
    }
  }
  return cells;
}

function summariesOf(
  customers: readonly RfmCustomer[],
  totalMonetary: number,
): RfmSummary[] {
  return RFM_SEGMENTS.map((definition) => {
    const members = customers.filter((customer) => customer.segment === definition.id);
    const monetary = members.reduce((sum, customer) => sum + customer.monetary, 0);
    const size = Math.max(members.length, 1);

    return {
      segment: definition.id,
      customers: members.length,
      monetary,
      share: totalMonetary === 0 ? 0 : (monetary / totalMonetary) * 100,
      avgRecency:
        members.reduce((sum, customer) => sum + customer.recencyDays, 0) / size,
      avgFrequency:
        members.reduce((sum, customer) => sum + customer.frequency, 0) / size,
      avgMonetary: monetary / size,
    };
  });
}

function emptySummaries(): RfmSummary[] {
  return RFM_SEGMENTS.map((definition) => ({
    segment: definition.id,
    customers: 0,
    monetary: 0,
    share: 0,
    avgRecency: 0,
    avgFrequency: 0,
    avgMonetary: 0,
  }));
}
