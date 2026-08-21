import { bucketLabel, bucketOf } from '@/features/analysis/lib/dates';
import { EMPTY_LABEL, type AnalysisRow, type Granularity } from '@/features/analysis/types';

export type CustomerMovementStatus = 'nuevo' | 'recurrente' | 'reactivado' | 'perdido';

export interface PeriodMovement {
  period: string;
  periodLabel: string;
  activeCustomers: number;
  newCustomers: number;
  returningCustomers: number;
  reactivatedCustomers: number;
  churnedCustomers: number;
  netCustomerChange: number;
  churnRate: number | null;
  retentionRate: number | null;
  quickRatio: number | null;
  totalRevenue: number;
  newRevenue: number;
  returningRevenue: number;
  reactivatedRevenue: number;
  churnedRevenue: number;
  netRevenueChange: number;
  revenueQuickRatio: number | null;
}

export interface CustomerDetail {
  customerId: string;
  status: CustomerMovementStatus;
  firstSeenPeriod: string;
  lastSeenPeriod: string;
  currentRevenue: number;
  previousRevenue: number;
}

export interface ChurnAnalysisResult {
  periods: PeriodMovement[];
  customers: CustomerDetail[];
  totalUniqueCustomers: number;
  totalRevenue: number;
  overallQuickRatio: number | null;
  avgChurnRate: number | null;
  avgRetentionRate: number | null;
  grain: Granularity;
  ignoredRows: number;
}

export interface ComputeChurnOptions {
  customerDim: string;
  dateColumn: string;
  amountColumn?: string | null;
  grain?: Granularity;
}

/**
 * Calcula la dinámica de clientes período a período:
 * Nuevos, Recurrentes, Reactivados y Perdidos (Churn), con sus métricas
 * de Quick Ratio, retención, churn rate e impacto en ingresos.
 */
export function computeChurn(
  rows: readonly AnalysisRow[],
  options: ComputeChurnOptions,
): ChurnAnalysisResult {
  const { customerDim, dateColumn, amountColumn = null, grain = 'mes' } = options;

  let ignoredRows = 0;
  let totalRevenue = 0;

  // Mapa: periodo -> Map<customerId, revenue>
  const periodCustomerRevenue = new Map<string, Map<string, number>>();
  // Mapa: customerId -> Set<period>
  const customerPeriods = new Map<string, Set<string>>();

  for (const row of rows) {
    const customer = row.dims[customerDim];
    const dateStr = row.day ?? row.dims[dateColumn];

    if (
      customer === undefined ||
      customer === EMPTY_LABEL ||
      dateStr === undefined ||
      dateStr === null ||
      dateStr === EMPTY_LABEL ||
      dateStr === ''
    ) {
      ignoredRows++;
      continue;
    }

    const customerId = customer.trim();
    if (customerId === '') {
      ignoredRows++;
      continue;
    }

    const period = bucketOf(dateStr, grain);
    let amount = 0;
    if (amountColumn != null) {
      const parsedAmount = row.values[amountColumn];
      if (typeof parsedAmount === 'number' && Number.isFinite(parsedAmount)) {
        amount = parsedAmount;
      }
    }

    totalRevenue += amount;

    // Actualizar cliente por periodo
    let customerMap = periodCustomerRevenue.get(period);
    if (customerMap === undefined) {
      customerMap = new Map<string, number>();
      periodCustomerRevenue.set(period, customerMap);
    }
    customerMap.set(customerId, (customerMap.get(customerId) ?? 0) + amount);

    // Actualizar periodos del cliente
    let periodsSet = customerPeriods.get(customerId);
    if (periodsSet === undefined) {
      periodsSet = new Set<string>();
      customerPeriods.set(customerId, periodsSet);
    }
    periodsSet.add(period);
  }

  // Ordenar periodos cronológicamente
  const sortedPeriods = Array.from(periodCustomerRevenue.keys()).sort((a, b) =>
    a.localeCompare(b),
  );

  const periods: PeriodMovement[] = [];
  const seenBefore = new Set<string>();

  for (let i = 0; i < sortedPeriods.length; i++) {
    const currentPeriod = sortedPeriods[i]!;
    const currentMap = periodCustomerRevenue.get(currentPeriod)!;
    const previousPeriod = i > 0 ? sortedPeriods[i - 1] : undefined;
    const previousMap = previousPeriod !== undefined ? (periodCustomerRevenue.get(previousPeriod) ?? null) : null;

    let newCount = 0;
    let returningCount = 0;
    let reactivatedCount = 0;
    let churnedCount = 0;

    let newRev = 0;
    let returningRev = 0;
    let reactivatedRev = 0;
    let churnedRev = 0;
    let currentTotalRev = 0;

    // Clientes activos en el periodo actual
    for (const [customerId, rev] of currentMap.entries()) {
      currentTotalRev += rev;

      if (!seenBefore.has(customerId)) {
        // Primera vez que se ve al cliente
        newCount++;
        newRev += rev;
      } else if (previousMap !== null && previousMap.has(customerId)) {
        // Estuvo activo en el periodo inmediatamente anterior
        returningCount++;
        returningRev += rev;
      } else {
        // Se vio antes, pero no en el periodo anterior
        reactivatedCount++;
        reactivatedRev += rev;
      }
    }

    // Clientes perdidos (churn): estaban en el periodo anterior pero no en el actual
    if (previousMap !== null) {
      for (const [prevCustomerId, prevRev] of previousMap.entries()) {
        if (!currentMap.has(prevCustomerId)) {
          churnedCount++;
          churnedRev += prevRev;
        }
      }
    }

    // Registrar clientes de este periodo en el histórico
    for (const customerId of currentMap.keys()) {
      seenBefore.add(customerId);
    }

    const prevActive = previousMap !== null ? previousMap.size : 0;
    const churnRate = prevActive > 0 ? (churnedCount / prevActive) * 100 : null;
    const retentionRate = prevActive > 0 ? (returningCount / prevActive) * 100 : null;
    const quickRatio =
      churnedCount > 0
        ? (newCount + reactivatedCount) / churnedCount
        : null;

    const prevTotalRev =
      previousMap !== null
        ? Array.from(previousMap.values()).reduce((sum, v) => sum + v, 0)
        : 0;

    const netCustomerChange = i === 0 ? newCount : newCount + reactivatedCount - churnedCount;
    const netRevenueChange = i === 0 ? currentTotalRev : currentTotalRev - prevTotalRev;
    const revenueQuickRatio =
      churnedRev > 0
        ? (newRev + reactivatedRev) / churnedRev
        : null;

    periods.push({
      period: currentPeriod,
      periodLabel: bucketLabel(currentPeriod, grain),
      activeCustomers: currentMap.size,
      newCustomers: newCount,
      returningCustomers: returningCount,
      reactivatedCustomers: reactivatedCount,
      churnedCustomers: churnedCount,
      netCustomerChange,
      churnRate,
      retentionRate,
      quickRatio,
      totalRevenue: currentTotalRev,
      newRevenue: newRev,
      returningRevenue: returningRev,
      reactivatedRevenue: reactivatedRev,
      churnedRevenue: churnedRev,
      netRevenueChange,
      revenueQuickRatio,
    });
  }

  // Detalle de clientes en el último período evaluado (o histórico)
  const customers: CustomerDetail[] = [];
  const latestPeriod = sortedPeriods.length > 0 ? sortedPeriods[sortedPeriods.length - 1] : undefined;
  const prevPeriod = sortedPeriods.length > 1 ? sortedPeriods[sortedPeriods.length - 2] : undefined;

  const latestMap = latestPeriod !== undefined ? (periodCustomerRevenue.get(latestPeriod) ?? null) : null;
  const prevToLatestMap = prevPeriod !== undefined ? (periodCustomerRevenue.get(prevPeriod) ?? null) : null;

  for (const [customerId, periodsSet] of customerPeriods.entries()) {
    const sortedCustPeriods = Array.from(periodsSet).sort();
    const firstSeenPeriod = sortedCustPeriods[0] ?? '';
    const lastSeenPeriod = sortedCustPeriods[sortedCustPeriods.length - 1] ?? '';

    let status: CustomerMovementStatus = 'recurrente';
    const curRev = latestMap?.get(customerId) ?? 0;
    const prevRev = prevToLatestMap?.get(customerId) ?? 0;

    if (latestMap?.has(customerId)) {
      if (firstSeenPeriod === latestPeriod) {
        status = 'nuevo';
      } else if (prevToLatestMap?.has(customerId)) {
        status = 'recurrente';
      } else {
        status = 'reactivado';
      }
    } else if (prevToLatestMap?.has(customerId)) {
      status = 'perdido';
    } else {
      status = 'perdido';
    }

    customers.push({
      customerId,
      status,
      firstSeenPeriod: bucketLabel(firstSeenPeriod, grain),
      lastSeenPeriod: bucketLabel(lastSeenPeriod, grain),
      currentRevenue: curRev,
      previousRevenue: prevRev,
    });
  }

  // Ordenar clientes por importe actual descendente, luego anterior
  customers.sort((a, b) => b.currentRevenue - a.currentRevenue || b.previousRevenue - a.previousRevenue);

  // Métricas globales promedio
  const comparativePeriods = periods.slice(1);
  const churnRates = comparativePeriods
    .map((p) => p.churnRate)
    .filter((r): r is number => r !== null);
  const retentionRates = comparativePeriods
    .map((p) => p.retentionRate)
    .filter((r): r is number => r !== null);

  const avgChurnRate =
    churnRates.length > 0 ? churnRates.reduce((a, b) => a + b, 0) / churnRates.length : null;
  const avgRetentionRate =
    retentionRates.length > 0
      ? retentionRates.reduce((a, b) => a + b, 0) / retentionRates.length
      : null;

  const totalInflow = comparativePeriods.reduce(
    (sum, p) => sum + p.newCustomers + p.reactivatedCustomers,
    0,
  );
  const totalOutflow = comparativePeriods.reduce((sum, p) => sum + p.churnedCustomers, 0);
  const overallQuickRatio = totalOutflow > 0 ? totalInflow / totalOutflow : null;

  return {
    periods,
    customers,
    totalUniqueCustomers: customerPeriods.size,
    totalRevenue,
    overallQuickRatio,
    avgChurnRate,
    avgRetentionRate,
    grain,
    ignoredRows,
  };
}
