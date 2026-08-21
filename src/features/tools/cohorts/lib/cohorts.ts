import { bucketLabel, bucketOf, generateBuckets } from '@/features/analysis/lib/dates';
import { EMPTY_LABEL, type AnalysisRow, type DateWindow, type Granularity } from '@/features/analysis/types';

export interface CohortPeriodCell {
  periodIndex: number;
  periodLabel: string; // "M0", "M1", "M2"... or "S0", "S1", "T0"...
  activeCustomers: number;
  customerRetentionRate: number; // 0..100 %
  revenue: number;
  revenueRetentionRate: number; // 0..100+ %
  hasData: boolean;
}

export interface CohortRow {
  cohort: string; // e.g. "2024-01"
  cohortLabel: string; // e.g. "Ene 24"
  initialCustomers: number; // M0 customers
  initialRevenue: number; // M0 revenue
  totalRevenue: number; // all periods revenue
  periods: CohortPeriodCell[];
}

export interface AverageRetentionPeriod {
  periodIndex: number;
  periodLabel: string;
  avgCustomerRetentionRate: number;
  avgRevenueRetentionRate: number;
  cohortCount: number;
}

export interface CohortsSummary {
  totalCohorts: number;
  totalCustomers: number;
  totalRevenue: number;
  avgM1CustomerRetention: number | null;
  avgM3CustomerRetention: number | null;
  avgM6CustomerRetention: number | null;
  bestCohort: { cohortLabel: string; m1Rate: number } | null;
}

export interface CohortsResult {
  cohorts: CohortRow[];
  averageCurve: AverageRetentionPeriod[];
  summary: CohortsSummary;
  maxPeriods: number;
  grain: Granularity;
  ignoredRows: number;
}

export interface CohortsParams {
  customerDim: string;
  dateColumn: string;
  amountColumn: string;
  grain: Granularity;
}

/**
 * Calcula la matriz triangular de retención de cohortes y curvas de decaimiento.
 */
export function computeCohorts(
  rows: readonly AnalysisRow[],
  params: CohortsParams,
): CohortsResult | null {
  const { customerDim, amountColumn, grain } = params;

  if (rows.length === 0) return null;

  // 1. Determinar extremos temporales y primera compra de cada cliente
  let minDay: string | null = null;
  let maxDay: string | null = null;
  let ignoredRows = 0;

  const customerFirstDay = new Map<string, string>();
  const validRows: { customer: string; day: string; amount: number }[] = [];

  for (const row of rows) {
    const customer = row.dims[customerDim];
    const amount = row.values[amountColumn];

    if (
      customer === undefined ||
      customer === EMPTY_LABEL ||
      row.day === null ||
      amount === null ||
      amount === undefined ||
      !Number.isFinite(amount)
    ) {
      ignoredRows += 1;
      continue;
    }

    if (minDay === null || row.day < minDay) minDay = row.day;
    if (maxDay === null || row.day > maxDay) maxDay = row.day;

    validRows.push({ customer, day: row.day, amount });

    const currentFirst = customerFirstDay.get(customer);
    if (currentFirst === undefined || row.day < currentFirst) {
      customerFirstDay.set(customer, row.day);
    }
  }

  if (minDay === null || maxDay === null || customerFirstDay.size === 0) {
    return null;
  }

  // 2. Generar todos los cubos cronológicos continuos
  const window: DateWindow = { desde: minDay, hasta: maxDay };
  const allBuckets = generateBuckets(window, grain);
  if (allBuckets.length === 0) return null;

  const bucketIndexMap = new Map<string, number>();
  allBuckets.forEach((b, idx) => bucketIndexMap.set(b, idx));

  // Asignar cohorte a cada cliente
  const customerCohortMap = new Map<string, string>();
  const cohortCustomersMap = new Map<string, Set<string>>();

  for (const [customer, firstDay] of customerFirstDay.entries()) {
    const cohortBucket = bucketOf(firstDay, grain);
    customerCohortMap.set(customer, cohortBucket);

    let set = cohortCustomersMap.get(cohortBucket);
    if (set === undefined) {
      set = new Set<string>();
      cohortCustomersMap.set(cohortBucket, set);
    }
    set.add(customer);
  }

  // Identificar todas las cohortes presentes en orden cronológico
  const activeCohorts = allBuckets.filter((b) => cohortCustomersMap.has(b));
  if (activeCohorts.length === 0) return null;

  // 3. Matriz de actividad: [cohortBucket][periodOffset] -> { customers: Set, revenue: number }
  const matrixData = new Map<
    string,
    Map<number, { customers: Set<string>; revenue: number }>
  >();

  for (const cBucket of activeCohorts) {
    matrixData.set(cBucket, new Map());
  }

  let totalPortfolioRevenue = 0;

  for (const row of validRows) {
    totalPortfolioRevenue += row.amount;
    const cBucket = customerCohortMap.get(row.customer);
    if (cBucket === undefined) continue;

    const txBucket = bucketOf(row.day, grain);
    const cIdx = bucketIndexMap.get(cBucket) ?? 0;
    const txIdx = bucketIndexMap.get(txBucket) ?? 0;
    const periodOffset = txIdx - cIdx;

    if (periodOffset < 0) continue;

    const cohortMatrix = matrixData.get(cBucket);
    if (cohortMatrix === undefined) continue;

    let cell = cohortMatrix.get(periodOffset);
    if (cell === undefined) {
      cell = { customers: new Set<string>(), revenue: 0 };
      cohortMatrix.set(periodOffset, cell);
    }

    cell.customers.add(row.customer);
    cell.revenue += row.amount;
  }

  // 4. Determinar número máximo de períodos transcurridos
  const maxPossiblePeriods = allBuckets.length;
  const prefix = grain === 'mes' ? 'M' : grain === 'semana' ? 'S' : 'T';

  const cohortRows: CohortRow[] = activeCohorts.map((cBucket) => {
    const cIdx = bucketIndexMap.get(cBucket) ?? 0;
    const cohortMembers = cohortCustomersMap.get(cBucket)?.size ?? 0;
    const cohortMatrix = matrixData.get(cBucket);

    const m0Cell = cohortMatrix?.get(0);
    const initialCustomers = cohortMembers;
    const initialRevenue = m0Cell?.revenue ?? 0;

    let cohortTotalRevenue = 0;
    const periods: CohortPeriodCell[] = [];

    for (let pIdx = 0; pIdx < maxPossiblePeriods; pIdx++) {
      const isObserved = cIdx + pIdx < allBuckets.length;
      if (!isObserved) {
        periods.push({
          periodIndex: pIdx,
          periodLabel: `${prefix}${pIdx}`,
          activeCustomers: 0,
          customerRetentionRate: 0,
          revenue: 0,
          revenueRetentionRate: 0,
          hasData: false,
        });
        continue;
      }

      const cell = cohortMatrix?.get(pIdx);
      const activeCount = cell?.customers.size ?? 0;
      const rev = cell?.revenue ?? 0;
      cohortTotalRevenue += rev;

      const custRate = initialCustomers > 0 ? (activeCount / initialCustomers) * 100 : 0;
      const revRate = initialRevenue > 0 ? (rev / initialRevenue) * 100 : 0;

      periods.push({
        periodIndex: pIdx,
        periodLabel: `${prefix}${pIdx}`,
        activeCustomers: activeCount,
        customerRetentionRate: custRate,
        revenue: rev,
        revenueRetentionRate: revRate,
        hasData: true,
      });
    }

    return {
      cohort: cBucket,
      cohortLabel: bucketLabel(cBucket, grain),
      initialCustomers,
      initialRevenue,
      totalRevenue: cohortTotalRevenue,
      periods,
    };
  });

  // 5. Curva media de retención por período
  const averageCurve: AverageRetentionPeriod[] = [];
  for (let pIdx = 0; pIdx < maxPossiblePeriods; pIdx++) {
    const validCohortCells = cohortRows
      .map((row) => row.periods[pIdx])
      .filter((cell): cell is CohortPeriodCell => cell !== undefined && cell.hasData);

    if (validCohortCells.length === 0) break;

    const sumCustRate = validCohortCells.reduce((s, c) => s + c.customerRetentionRate, 0);
    const sumRevRate = validCohortCells.reduce((s, c) => s + c.revenueRetentionRate, 0);

    averageCurve.push({
      periodIndex: pIdx,
      periodLabel: `${prefix}${pIdx}`,
      avgCustomerRetentionRate: sumCustRate / validCohortCells.length,
      avgRevenueRetentionRate: sumRevRate / validCohortCells.length,
      cohortCount: validCohortCells.length,
    });
  }

  // 6. Resumen de KPIs
  const m1Avg = averageCurve.find((p) => p.periodIndex === 1)?.avgCustomerRetentionRate ?? null;
  const m3Avg = averageCurve.find((p) => p.periodIndex === 3)?.avgCustomerRetentionRate ?? null;
  const m6Avg = averageCurve.find((p) => p.periodIndex === 6)?.avgCustomerRetentionRate ?? null;

  let bestCohort: { cohortLabel: string; m1Rate: number } | null = null;
  for (const row of cohortRows) {
    const m1Cell = row.periods[1];
    if (m1Cell && m1Cell.hasData && row.initialCustomers >= 2) {
      if (bestCohort === null || m1Cell.customerRetentionRate > bestCohort.m1Rate) {
        bestCohort = {
          cohortLabel: row.cohortLabel,
          m1Rate: m1Cell.customerRetentionRate,
        };
      }
    }
  }

  const summary: CohortsSummary = {
    totalCohorts: cohortRows.length,
    totalCustomers: customerFirstDay.size,
    totalRevenue: totalPortfolioRevenue,
    avgM1CustomerRetention: m1Avg,
    avgM3CustomerRetention: m3Avg,
    avgM6CustomerRetention: m6Avg,
    bestCohort,
  };

  return {
    cohorts: cohortRows,
    averageCurve,
    summary,
    maxPeriods: maxPossiblePeriods,
    grain,
    ignoredRows,
  };
}
