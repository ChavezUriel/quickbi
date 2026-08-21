import { EMPTY_LABEL, type AnalysisRow } from '@/features/analysis/types';

export interface AssociationRule {
  antecedent: string;
  consequent: string;
  supportCount: number;
  antecedentCount: number;
  consequentCount: number;
  support: number; // P(A and B) = supportCount / totalBaskets
  confidence: number; // P(B|A) = supportCount / antecedentCount
  expectedConfidence: number; // P(B) = consequentCount / totalBaskets
  lift: number; // Confidence / ExpectedConfidence
  conviction: number | null; // (1 - P(B)) / (1 - P(B|A))
  leverage: number; // P(A and B) - P(A) * P(B)
}

export interface ItemFrequency {
  item: string;
  count: number; // Número de cestas con este producto
  support: number; // count / totalBaskets
  totalQuantity: number;
}

export interface BasketMatrixCell {
  itemA: string;
  itemB: string;
  coOccurrence: number;
  confidence: number;
  lift: number;
}

export interface BasketAnalysisResult {
  totalBaskets: number;
  uniqueItems: number;
  avgBasketSize: number;
  items: ItemFrequency[];
  rules: AssociationRule[];
  matrix: {
    topItems: string[];
    cells: BasketMatrixCell[];
  };
  ignoredRows: number;
}

export interface ComputeBasketOptions {
  itemDim: string;
  basketDim: string;
  quantityColumn?: string | null;
  minSupport?: number;
  minConfidence?: number;
  minLift?: number;
  topMatrixLimit?: number;
}

/**
 * Minería de reglas de asociación (Market Basket Analysis):
 * Identifica productos comprados juntos con soporte, confianza y lift.
 */
export function computeBasket(
  rows: readonly AnalysisRow[],
  options: ComputeBasketOptions,
): BasketAnalysisResult {
  const {
    itemDim,
    basketDim,
    quantityColumn = null,
    minSupport = 0.01,
    minConfidence = 0.05,
    minLift = 1.0,
    topMatrixLimit = 10,
  } = options;

  let ignoredRows = 0;

  // Mapa: basketId -> Set<itemId>
  const basketItems = new Map<string, Set<string>>();
  // Mapa: itemId -> total quantity
  const itemQuantities = new Map<string, number>();

  for (const row of rows) {
    const itemRaw = row.dims[itemDim];
    const basketRaw = row.dims[basketDim];

    if (
      itemRaw === undefined ||
      itemRaw === EMPTY_LABEL ||
      basketRaw === undefined ||
      basketRaw === EMPTY_LABEL
    ) {
      ignoredRows++;
      continue;
    }

    const item = itemRaw.trim();
    const basketId = basketRaw.trim();

    if (item === '' || basketId === '') {
      ignoredRows++;
      continue;
    }

    let basketSet = basketItems.get(basketId);
    if (basketSet === undefined) {
      basketSet = new Set<string>();
      basketItems.set(basketId, basketSet);
    }
    basketSet.add(item);

    let qty = 1;
    if (quantityColumn != null) {
      const parsedQty = row.values[quantityColumn];
      if (typeof parsedQty === 'number' && Number.isFinite(parsedQty) && parsedQty > 0) {
        qty = parsedQty;
      }
    }
    itemQuantities.set(item, (itemQuantities.get(item) ?? 0) + qty);
  }

  const totalBaskets = basketItems.size;

  if (totalBaskets === 0) {
    return {
      totalBaskets: 0,
      uniqueItems: 0,
      avgBasketSize: 0,
      items: [],
      rules: [],
      matrix: { topItems: [], cells: [] },
      ignoredRows,
    };
  }

  // Frecuencia individual de cada ítem
  const itemCounts = new Map<string, number>();
  let totalItemsInAllBaskets = 0;

  for (const itemsSet of basketItems.values()) {
    totalItemsInAllBaskets += itemsSet.size;
    for (const item of itemsSet) {
      itemCounts.set(item, (itemCounts.get(item) ?? 0) + 1);
    }
  }

  const avgBasketSize = totalItemsInAllBaskets / totalBaskets;

  // Co-ocurrencias de pares de productos en la misma cesta
  const pairCounts = new Map<string, number>();

  for (const itemsSet of basketItems.values()) {
    if (itemsSet.size < 2) continue;
    const list = Array.from(itemsSet);
    for (let i = 0; i < list.length; i++) {
      const a = list[i]!;
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j]!;
        const pairKey = a < b ? `${a}|||${b}` : `${b}|||${a}`;
        pairCounts.set(pairKey, (pairCounts.get(pairKey) ?? 0) + 1);
      }
    }
  }

  // Generar reglas de asociación A -> B y B -> A
  const allRules: AssociationRule[] = [];

  for (const [pairKey, supportCount] of pairCounts.entries()) {
    const [item1, item2] = pairKey.split('|||') as [string, string];
    const count1 = itemCounts.get(item1) ?? 0;
    const count2 = itemCounts.get(item2) ?? 0;

    const support = supportCount / totalBaskets;
    if (support < minSupport) continue;

    // Regla 1: item1 -> item2
    const conf12 = count1 > 0 ? supportCount / count1 : 0;
    const expectedConf12 = count2 / totalBaskets;
    const lift12 = expectedConf12 > 0 ? conf12 / expectedConf12 : 0;
    const leverage12 = support - (count1 / totalBaskets) * (count2 / totalBaskets);
    const conviction12 = conf12 < 1 && 1 - conf12 > 0 ? (1 - expectedConf12) / (1 - conf12) : null;

    if (conf12 >= minConfidence && lift12 >= minLift) {
      allRules.push({
        antecedent: item1,
        consequent: item2,
        supportCount,
        antecedentCount: count1,
        consequentCount: count2,
        support,
        confidence: conf12,
        expectedConfidence: expectedConf12,
        lift: lift12,
        conviction: conviction12,
        leverage: leverage12,
      });
    }

    // Regla 2: item2 -> item1
    const conf21 = count2 > 0 ? supportCount / count2 : 0;
    const expectedConf21 = count1 / totalBaskets;
    const lift21 = expectedConf21 > 0 ? conf21 / expectedConf21 : 0;
    const leverage21 = support - (count2 / totalBaskets) * (count1 / totalBaskets);
    const conviction21 = conf21 < 1 && 1 - conf21 > 0 ? (1 - expectedConf21) / (1 - conf21) : null;

    if (conf21 >= minConfidence && lift21 >= minLift) {
      allRules.push({
        antecedent: item2,
        consequent: item1,
        supportCount,
        antecedentCount: count2,
        consequentCount: count1,
        support,
        confidence: conf21,
        expectedConfidence: expectedConf21,
        lift: lift21,
        conviction: conviction21,
        leverage: leverage21,
      });
    }
  }

  // Ordenar reglas por Lift descendente, luego Confianza, luego Soporte
  allRules.sort((a, b) => b.lift - a.lift || b.confidence - a.confidence || b.support - a.support);

  // Lista de items con frecuencia
  const itemsList: ItemFrequency[] = Array.from(itemCounts.entries())
    .map(([item, count]) => ({
      item,
      count,
      support: count / totalBaskets,
      totalQuantity: itemQuantities.get(item) ?? count,
    }))
    .sort((a, b) => b.count - a.count);

  // Construir matriz de correlación para los Top N productos
  const topItems = itemsList.slice(0, topMatrixLimit).map((item) => item.item);
  const matrixCells: BasketMatrixCell[] = [];

  for (const itemA of topItems) {
    const countA = itemCounts.get(itemA) ?? 0;
    for (const itemB of topItems) {
      if (itemA === itemB) {
        matrixCells.push({
          itemA,
          itemB,
          coOccurrence: countA,
          confidence: 1.0,
          lift: 1.0,
        });
      } else {
        const pairKey = itemA < itemB ? `${itemA}|||${itemB}` : `${itemB}|||${itemA}`;
        const coOccur = pairCounts.get(pairKey) ?? 0;
        const countB = itemCounts.get(itemB) ?? 0;
        const conf = countA > 0 ? coOccur / countA : 0;
        const lift = countA > 0 && countB > 0 ? (coOccur * totalBaskets) / (countA * countB) : 0;

        matrixCells.push({
          itemA,
          itemB,
          coOccurrence: coOccur,
          confidence: conf,
          lift,
        });
      }
    }
  }

  return {
    totalBaskets,
    uniqueItems: itemCounts.size,
    avgBasketSize,
    items: itemsList,
    rules: allRules,
    matrix: {
      topItems,
      cells: matrixCells,
    },
    ignoredRows,
  };
}
