import { daysBetween } from '@/features/analysis/lib/dates';
import { EMPTY_LABEL, type AnalysisRow } from '@/features/analysis/types';

/**
 * Rotación y Antigüedad de Inventario (Supply Chain & Inventory Analytics).
 *
 * Calcula el ratio de rotación de inventario (Turnover), los Días de Venta
 * de Inventario (DSI), tramos de antigüedad de stock (<30d, 31-60d, 61-90d, >90d)
 * y la clasificación de velocidad de rotación (Fast, Medium, Slow, Dead Stock).
 */

export type AgingBucketId = 'under_30' | '31_to_60' | '61_to_90' | 'over_90';

export interface AgingBucketDef {
  id: AgingBucketId;
  label: string;
  minDays: number;
  maxDays: number;
  tone: 'bueno' | 'neutro' | 'aviso' | 'malo';
}

export const AGING_BUCKETS: AgingBucketDef[] = [
  { id: 'under_30', label: '< 30 días (Fresco / Óptimo)', minDays: 0, maxDays: 30, tone: 'bueno' },
  { id: '31_to_60', label: '31 - 60 días (Normal)', minDays: 31, maxDays: 60, tone: 'neutro' },
  { id: '61_to_90', label: '61 - 90 días (En observación)', minDays: 61, maxDays: 90, tone: 'aviso' },
  { id: 'over_90', label: '> 90 días (Stock muerto / Obsoleto)', minDays: 91, maxDays: Infinity, tone: 'malo' },
];

export type VelocityCategoryId = 'alta' | 'media' | 'baja' | 'muerto';

export interface VelocityCategoryDef {
  id: VelocityCategoryId;
  label: string;
  description: string;
  tone: 'bueno' | 'neutro' | 'aviso' | 'malo';
}

export const VELOCITY_CATEGORIES: VelocityCategoryDef[] = [
  { id: 'alta', label: 'Alta velocidad (Fast-moving)', description: 'Alta rotación, salida rápida.', tone: 'bueno' },
  { id: 'media', label: 'Media velocidad (Medium-moving)', description: 'Rotación equilibrada.', tone: 'neutro' },
  { id: 'baja', label: 'Baja velocidad (Slow-moving)', description: 'Salida lenta, riesgo de acumulación.', tone: 'aviso' },
  { id: 'muerto', label: 'Sin rotación (Dead stock)', description: 'Sin ventas o más de 90 días parado.', tone: 'malo' },
];

export interface InventoryItem {
  /** Identificador de SKU o nombre de producto. */
  id: string;
  /** Categoría o familia de producto. */
  category: string;
  /** Stock actual (unidades o valor monetario). */
  stock: number;
  /** Ventas o salidas en el período. */
  sales: number;
  /** Ratio de rotación anualizado (`ventas / stock`). */
  turnover: number;
  /** Días de venta de inventario (DSI). */
  dsi: number;
  /** Días de antigüedad calculados o estimados. */
  agingDays: number;
  /** Tramo de antigüedad asignado. */
  agingBucket: AgingBucketId;
  /** Clasificación de velocidad de rotación. */
  velocityCategory: VelocityCategoryId;
  /** Recomendación operativa / comercial. */
  recommendation: string;
}

export interface BucketDistribution {
  id: AgingBucketId;
  label: string;
  itemCount: number;
  stockValue: number;
  share: number;
  tone: 'bueno' | 'neutro' | 'aviso' | 'malo';
}

export interface VelocityDistribution {
  id: VelocityCategoryId;
  label: string;
  itemCount: number;
  stockValue: number;
  share: number;
  tone: 'bueno' | 'neutro' | 'aviso' | 'malo';
}

export interface InventorySummary {
  /** Valor o unidades totales de stock en inventario. */
  totalStock: number;
  /** Ventas o salidas totales en el período. */
  totalSales: number;
  /** Cantidad total de SKUs / referencias activas. */
  skuCount: number;
  /** Rotación media ponderada de inventario (`totalSales / totalStock`). */
  avgTurnover: number;
  /** DSI promedio ponderado (`(totalStock / totalSales) * periodDays`). */
  avgDsi: number;
  /** Valor del stock muerto / obsoleto (>90 días o sin ventas). */
  deadStockValue: number;
  /** Número de SKUs clasificados como stock muerto. */
  deadStockSkuCount: number;
  /** Porcentaje del stock que es stock muerto (`0 - 100`). */
  deadStockShare: number;
  /** Distribución por tramos de antigüedad. */
  agingDistribution: BucketDistribution[];
  /** Distribución por categorías de velocidad. */
  velocityDistribution: VelocityDistribution[];
}

export interface InventoryResult {
  /** Lista de productos analizados ordenados por stock descendente. */
  items: InventoryItem[];
  /** Resumen general de inventario. */
  summary: InventorySummary;
  /** Filas ignoradas por falta de producto o valores erróneos. */
  ignoredRows: number;
}

export interface InventoryParams {
  /** Columna identificadora del producto / SKU. */
  productDim: string;
  /** Columna de cantidad o valor de stock actual. */
  stockColumn: string;
  /** Columna de ventas / salidas / COGS (opcional). */
  salesColumn?: string | null;
  /** Columna de días de antigüedad o fecha de recepción (opcional). */
  daysOrDateColumn?: string | null;
  /** Columna de categoría o familia de producto (opcional). */
  categoryDim?: string | null;
  /** Días del período analizado (por defecto 365 para rotación anual). */
  periodDays?: number;
  /** Día de referencia para calcular antigüedad si hay fecha de ingreso. */
  referenceDay?: string | null;
}

/**
 * Calcula métricas de rotación, DSI y obsolescencia de inventario.
 * Función pura: maneja divisiones por cero, stocks nulos y colecciones vacías de forma segura.
 */
export function computeInventory(
  rows: readonly AnalysisRow[],
  params: InventoryParams,
): InventoryResult {
  const {
    productDim,
    stockColumn,
    salesColumn = null,
    daysOrDateColumn = null,
    categoryDim = null,
    periodDays = 365,
    referenceDay = null,
  } = params;

  let ignoredRows = 0;

  interface Draft {
    category: string;
    stock: number;
    sales: number;
    daysSum: number;
    daysCount: number;
    lastDate: string | null;
  }

  const drafts = new Map<string, Draft>();
  let maxDatasetDay: string | null = null;

  for (const row of rows) {
    const product = row.dims[productDim];

    if (product === undefined || product === EMPTY_LABEL || product.trim() === '') {
      ignoredRows += 1;
      continue;
    }

    const trimmedProduct = product.trim();
    const stockVal = row.values[stockColumn] ?? 0;
    const salesVal = salesColumn ? (row.values[salesColumn] ?? 0) : 0;
    const category = categoryDim ? (row.dims[categoryDim] ?? 'General') : 'General';

    if (row.day && (maxDatasetDay === null || row.day > maxDatasetDay)) {
      maxDatasetDay = row.day;
    }

    let itemDays: number | null = null;
    let itemDate: string | null = null;

    if (daysOrDateColumn) {
      const numVal = row.values[daysOrDateColumn];
      if (numVal !== undefined && numVal !== null && Number.isFinite(numVal)) {
        itemDays = numVal;
      } else {
        const dimDate = row.dims[daysOrDateColumn];
        if (dimDate && dimDate !== EMPTY_LABEL) {
          itemDate = dimDate;
        }
      }
    }

    const existing = drafts.get(trimmedProduct);
    if (!existing) {
      drafts.set(trimmedProduct, {
        category: category !== EMPTY_LABEL ? category : 'General',
        stock: Number.isFinite(stockVal) ? Math.max(0, stockVal) : 0,
        sales: Number.isFinite(salesVal) ? Math.max(0, salesVal) : 0,
        daysSum: itemDays !== null ? Math.max(0, itemDays) : 0,
        daysCount: itemDays !== null ? 1 : 0,
        lastDate: itemDate,
      });
    } else {
      if (Number.isFinite(stockVal)) existing.stock += Math.max(0, stockVal);
      if (Number.isFinite(salesVal)) existing.sales += Math.max(0, salesVal);
      if (itemDays !== null) {
        existing.daysSum += Math.max(0, itemDays);
        existing.daysCount += 1;
      }
      if (itemDate && (!existing.lastDate || itemDate > existing.lastDate)) {
        existing.lastDate = itemDate;
      }
    }
  }

  if (drafts.size === 0) {
    return {
      items: [],
      summary: emptySummary(),
      ignoredRows,
    };
  }

  const effectiveRefDay = referenceDay ?? maxDatasetDay ?? '';

  const items: InventoryItem[] = Array.from(drafts.entries()).map(([productId, draft]) => {
    const stock = Math.round(draft.stock * 100) / 100;
    const sales = Math.round(draft.sales * 100) / 100;

    // Rotación = Ventas / Stock
    let turnover = 0;
    if (stock > 0) {
      turnover = (sales / stock) * (365 / periodDays);
    } else if (sales > 0) {
      turnover = 999;
    }

    // DSI = (Stock / Ventas) * periodDays
    let dsi = 0;
    if (sales > 0) {
      dsi = (stock / sales) * periodDays;
    } else if (stock > 0) {
      dsi = 999; // Stock sin ventas
    }

    // Días de antigüedad reales o derivados de DSI
    let agingDays = dsi;
    if (draft.daysCount > 0) {
      agingDays = draft.daysSum / draft.daysCount;
    } else if (draft.lastDate && effectiveRefDay) {
      const diff = daysBetween(draft.lastDate, effectiveRefDay);
      agingDays = Math.max(0, diff);
    }

    // Asignar bucket de antigüedad
    let agingBucket: AgingBucketId = 'under_30';
    const hasExplicitDays = draft.daysCount > 0 || (draft.lastDate && effectiveRefDay);
    if (agingDays > 90 || (!hasExplicitDays && sales === 0 && stock > 0)) {
      agingBucket = 'over_90';
    } else if (agingDays > 60) {
      agingBucket = '61_to_90';
    } else if (agingDays > 30) {
      agingBucket = '31_to_60';
    }

    // Asignar categoría de velocidad
    let velocityCategory: VelocityCategoryId = 'media';
    let recommendation = 'Mantener inventario';

    if (sales === 0 && stock > 0) {
      velocityCategory = 'muerto';
      recommendation = 'Liquidar stock obsoleto / Promoción agresiva';
    } else if (turnover >= 6 || dsi <= 30) {
      velocityCategory = 'alta';
      recommendation = stock <= sales * 0.1 ? 'Reaprovisionar urgente (Stock bajo)' : 'Optimizar lote de pedido';
    } else if (turnover >= 2 || dsi <= 60) {
      velocityCategory = 'media';
      recommendation = 'Mantener nivel de stock';
    } else if (dsi <= 90) {
      velocityCategory = 'baja';
      recommendation = 'Monitorear y reducir pedidos';
    } else {
      velocityCategory = 'muerto';
      recommendation = 'Aplicar descuentos / Liquidación';
    }

    return {
      id: productId,
      category: draft.category,
      stock,
      sales,
      turnover: Math.round(turnover * 100) / 100,
      dsi: Math.min(999, Math.round(dsi)),
      agingDays: Math.min(999, Math.round(agingDays)),
      agingBucket,
      velocityCategory,
      recommendation,
    };
  });

  // Ordenar por valor de stock descendente
  items.sort((a, b) => b.stock - a.stock);

  const totalStock = items.reduce((acc, item) => acc + item.stock, 0);
  const totalSales = items.reduce((acc, item) => acc + item.sales, 0);
  const avgTurnover = totalStock > 0 ? (totalSales / totalStock) * (365 / periodDays) : 0;
  const avgDsi = totalSales > 0 ? (totalStock / totalSales) * periodDays : (totalStock > 0 ? 999 : 0);

  const deadStockItems = items.filter((item) => item.velocityCategory === 'muerto' || item.agingBucket === 'over_90');
  const deadStockValue = deadStockItems.reduce((acc, item) => acc + item.stock, 0);
  const deadStockShare = totalStock > 0 ? (deadStockValue / totalStock) * 100 : 0;

  // Distribución por tramos de antigüedad
  const agingDistribution: BucketDistribution[] = AGING_BUCKETS.map((def) => {
    const bucketItems = items.filter((item) => item.agingBucket === def.id);
    const stockVal = bucketItems.reduce((acc, item) => acc + item.stock, 0);
    const share = totalStock > 0 ? (stockVal / totalStock) * 100 : 0;

    return {
      id: def.id,
      label: def.label,
      itemCount: bucketItems.length,
      stockValue: Math.round(stockVal * 100) / 100,
      share: Math.round(share * 100) / 100,
      tone: def.tone,
    };
  });

  // Distribución por velocidad
  const velocityDistribution: VelocityDistribution[] = VELOCITY_CATEGORIES.map((def) => {
    const catItems = items.filter((item) => item.velocityCategory === def.id);
    const stockVal = catItems.reduce((acc, item) => acc + item.stock, 0);
    const share = totalStock > 0 ? (stockVal / totalStock) * 100 : 0;

    return {
      id: def.id,
      label: def.label,
      itemCount: catItems.length,
      stockValue: Math.round(stockVal * 100) / 100,
      share: Math.round(share * 100) / 100,
      tone: def.tone,
    };
  });

  const summary: InventorySummary = {
    totalStock: Math.round(totalStock * 100) / 100,
    totalSales: Math.round(totalSales * 100) / 100,
    skuCount: items.length,
    avgTurnover: Math.round(avgTurnover * 100) / 100,
    avgDsi: Math.min(999, Math.round(avgDsi)),
    deadStockValue: Math.round(deadStockValue * 100) / 100,
    deadStockSkuCount: deadStockItems.length,
    deadStockShare: Math.round(deadStockShare * 100) / 100,
    agingDistribution,
    velocityDistribution,
  };

  return {
    items,
    summary,
    ignoredRows,
  };
}

function emptySummary(): InventorySummary {
  return {
    totalStock: 0,
    totalSales: 0,
    skuCount: 0,
    avgTurnover: 0,
    avgDsi: 0,
    deadStockValue: 0,
    deadStockSkuCount: 0,
    deadStockShare: 0,
    agingDistribution: AGING_BUCKETS.map((b) => ({
      id: b.id,
      label: b.label,
      itemCount: 0,
      stockValue: 0,
      share: 0,
      tone: b.tone,
    })),
    velocityDistribution: VELOCITY_CATEGORIES.map((v) => ({
      id: v.id,
      label: v.label,
      itemCount: 0,
      stockValue: 0,
      share: 0,
      tone: v.tone,
    })),
  };
}
