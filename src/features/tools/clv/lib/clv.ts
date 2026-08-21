import { daysBetween } from '@/features/analysis/lib/dates';
import { EMPTY_LABEL, type AnalysisRow } from '@/features/analysis/types';

export type CustomerStatus = 'activo' | 'en_riesgo' | 'inactivo';

export interface ClvCustomer {
  id: string;
  firstDay: string;
  lastDay: string;
  lifespanDays: number;
  orderCount: number;
  totalSpend: number;
  aov: number;
  recencyDays: number;
  annualFrequency: number;
  status: CustomerStatus;
  decile: number; // 1 (menor gasto) a 10 (mayor gasto)
  projectedClv: number;
  rank: number;
}

export interface ClvDecile {
  decile: number;
  label: string;
  customerCount: number;
  totalSpend: number;
  revenueShare: number;
  avgSpend: number;
  avgAov: number;
  avgOrders: number;
}

export interface ClvSummary {
  totalCustomers: number;
  totalRevenue: number;
  totalOrders: number;
  avgClv: number;
  avgAov: number;
  avgLifespanDays: number;
  activeCount: number;
  atRiskCount: number;
  inactiveCount: number;
  churnRate: number;
  paretoTop20Share: number;
  referenceDay: string;
}

export interface ClvResult {
  customers: ClvCustomer[];
  deciles: ClvDecile[];
  summary: ClvSummary;
  ignoredRows: number;
}

export interface ClvParams {
  customerDim: string;
  amountColumn: string;
  dateColumn: string;
  orderDim: string | null;
  churnDays: number;
  marginRate: number;
  projectionYears: number;
  referenceDay: string | null;
}

interface CustomerDraft {
  firstDay: string;
  lastDay: string;
  totalSpend: number;
  purchases: Set<string>;
}

/**
 * Calcula las métricas de Customer Lifetime Value (CLV), AOV, frecuencia,
 * vida media, retención y distribución por deciles.
 */
export function computeClv(
  rows: readonly AnalysisRow[],
  params: ClvParams,
): ClvResult | null {
  const { customerDim, amountColumn, orderDim, churnDays, marginRate, projectionYears } = params;

  if (rows.length === 0) return null;

  const drafts = new Map<string, CustomerDraft>();
  let ignoredRows = 0;
  let maxDay: string | null = null;

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

    if (maxDay === null || row.day > maxDay) maxDay = row.day;

    const purchaseKey = orderDim === null ? row.day : (row.dims[orderDim] ?? row.day);
    const existing = drafts.get(customer);

    if (existing === undefined) {
      drafts.set(customer, {
        firstDay: row.day,
        lastDay: row.day,
        totalSpend: amount,
        purchases: new Set([purchaseKey]),
      });
    } else {
      if (row.day < existing.firstDay) existing.firstDay = row.day;
      if (row.day > existing.lastDay) existing.lastDay = row.day;
      existing.totalSpend += amount;
      existing.purchases.add(purchaseKey);
    }
  }

  const referenceDay = params.referenceDay ?? maxDay ?? '';
  if (drafts.size === 0 || referenceDay === '') return null;

  const customerEntries = Array.from(drafts.entries());
  let totalRevenue = 0;
  let totalOrders = 0;

  // Primer pase: crear clientes y métricas individuales
  const unrankedCustomers = customerEntries.map(([id, draft]) => {
    const lifespanDays = Math.max(1, daysBetween(draft.firstDay, draft.lastDay) + 1);
    const recencyDays = Math.max(0, daysBetween(draft.lastDay, referenceDay));
    const orderCount = draft.purchases.size;
    const totalSpend = draft.totalSpend;
    const aov = totalSpend / Math.max(1, orderCount);

    totalRevenue += totalSpend;
    totalOrders += orderCount;

    // Frecuencia anual estimada basada en el tiempo observado
    const yearsObserved = Math.max(0.1, lifespanDays / 365.25);
    const annualFrequency = orderCount / yearsObserved;

    let status: CustomerStatus = 'inactivo';
    if (recencyDays <= churnDays) {
      status = 'activo';
    } else if (recencyDays <= churnDays * 2) {
      status = 'en_riesgo';
    }

    // Probabilidad de retención / supervivencia basada en recencia
    const retentionProb =
      status === 'activo' ? 1.0 : status === 'en_riesgo' ? Math.max(0.2, 1 - recencyDays / (churnDays * 2)) : 0.05;

    // CLV Proyectado = Histórico + (Gasto futuro estimado)
    const futureExpected = aov * Math.min(annualFrequency, 52) * projectionYears * marginRate * retentionProb;
    const projectedClv = totalSpend + futureExpected;

    return {
      id,
      firstDay: draft.firstDay,
      lastDay: draft.lastDay,
      lifespanDays,
      orderCount,
      totalSpend,
      aov,
      recencyDays,
      annualFrequency,
      status,
      decile: 1,
      projectedClv,
      rank: 1,
    };
  });

  // Ordenar por gasto total descendente para ranking y Pareto
  unrankedCustomers.sort((a, b) => b.totalSpend - a.totalSpend);

  const totalCustomers = unrankedCustomers.length;

  // Asignar Ranking
  unrankedCustomers.forEach((c, idx) => {
    c.rank = idx + 1;
  });

  // Asignar Deciles: de D1 (menor gasto) a D10 (mayor gasto)
  // Como están ordenados desc (mayor a menor): los primeros 10% son Decil 10
  unrankedCustomers.forEach((c, idx) => {
    const fraction = idx / totalCustomers;
    const decileNumber = Math.max(1, Math.min(10, 10 - Math.floor(fraction * 10)));
    c.decile = decileNumber;
  });

  // Deciles Agrupados (D1 .. D10)
  const deciles: ClvDecile[] = Array.from({ length: 10 }, (_, i) => {
    const dNum = i + 1;
    const members = unrankedCustomers.filter((c) => c.decile === dNum);
    const count = members.length;
    const spend = members.reduce((s, c) => s + c.totalSpend, 0);
    const orders = members.reduce((s, c) => s + c.orderCount, 0);

    return {
      decile: dNum,
      label: `Decil ${dNum} (D${dNum})`,
      customerCount: count,
      totalSpend: spend,
      revenueShare: totalRevenue > 0 ? (spend / totalRevenue) * 100 : 0,
      avgSpend: count > 0 ? spend / count : 0,
      avgAov: count > 0 ? members.reduce((s, c) => s + c.aov, 0) / count : 0,
      avgOrders: count > 0 ? orders / count : 0,
    };
  });

  // Pareto top 20%
  const top20Count = Math.max(1, Math.ceil(totalCustomers * 0.2));
  const top20Spend = unrankedCustomers.slice(0, top20Count).reduce((s, c) => s + c.totalSpend, 0);
  const paretoTop20Share = totalRevenue > 0 ? (top20Spend / totalRevenue) * 100 : 0;

  const activeCount = unrankedCustomers.filter((c) => c.status === 'activo').length;
  const atRiskCount = unrankedCustomers.filter((c) => c.status === 'en_riesgo').length;
  const inactiveCount = unrankedCustomers.filter((c) => c.status === 'inactivo').length;
  const churnRate = totalCustomers > 0 ? (inactiveCount / totalCustomers) * 100 : 0;

  const summary: ClvSummary = {
    totalCustomers,
    totalRevenue,
    totalOrders,
    avgClv: totalCustomers > 0 ? totalRevenue / totalCustomers : 0,
    avgAov: totalOrders > 0 ? totalRevenue / totalOrders : 0,
    avgLifespanDays:
      totalCustomers > 0 ? unrankedCustomers.reduce((s, c) => s + c.lifespanDays, 0) / totalCustomers : 0,
    activeCount,
    atRiskCount,
    inactiveCount,
    churnRate,
    paretoTop20Share,
    referenceDay,
  };

  return {
    customers: unrankedCustomers,
    deciles,
    summary,
    ignoredRows,
  };
}
