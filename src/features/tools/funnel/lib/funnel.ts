import { EMPTY_LABEL, type AnalysisRow } from '@/features/analysis/types';

/**
 * Embudo de conversión: análisis paso a paso del flujo de usuarios/operaciones.
 *
 * Mide el volumen en cada etapa, calcula la retención respecto al inicio y
 * respecto al paso anterior, cuantifica la pérdida (drop-off) y localiza
 * automáticamente el mayor cuello de botella del embudo.
 */

export interface FunnelStage {
  /** Nombre de la etapa o paso. */
  stage: string;
  /** Índice ordenado en el embudo (0 = inicio). */
  order: number;
  /** Volumen o valor acumulado en esta etapa. */
  volume: number;
  /** Porcentaje de conversión respecto a la primera etapa (Top of Funnel). */
  conversionFromTop: number;
  /** Porcentaje de conversión respecto a la etapa inmediatamente anterior (Paso a paso). */
  stepConversionRate: number;
  /** Volumen perdido respecto a la etapa anterior (`max(0, prev - current)`). */
  dropOff: number;
  /** Tasa de caída/abandono porcentual respecto a la etapa anterior. */
  dropOffRate: number;
  /** Verdadero si esta etapa representa el mayor cuello de botella del embudo. */
  isBottleneck: boolean;
}

export interface FunnelSummary {
  /** Volumen en la primera etapa (entrada del embudo). */
  topVolume: number;
  /** Volumen en la última etapa (conversiones finales). */
  bottomVolume: number;
  /** Tasa de conversión global del embudo (`bottomVolume / topVolume * 100`). */
  overallConversionRate: number;
  /** Etapa identificada como el principal cuello de botella. */
  bottleneckStage: string | null;
  /** Mayor caída porcentual encontrada entre etapas. */
  maxDropOffRate: number;
  /** Mayor pérdida de volumen absoluta encontrada entre etapas. */
  maxDropOffVolume: number;
  /** Pérdida acumulada total a lo largo de todas las etapas. */
  totalDropOff: number;
}

export interface FunnelResult {
  /** Etapas ordenadas del embudo con sus métricas. */
  stages: FunnelStage[];
  /** Resumen global del embudo. */
  summary: FunnelSummary;
  /** Filas ignoradas por falta de etapa o valores inválidos. */
  ignoredRows: number;
}

export type FunnelAggregation = 'count' | 'sum' | 'count_distinct';

export interface FunnelParams {
  /** Columna de dimensión que define la etapa/paso. */
  stageDim: string;
  /** Columna de métrica numérica (opcional, para agregación 'sum'). */
  valueColumn?: string | null;
  /** Columna identificadora de entidad (opcional, para agregación 'count_distinct'). */
  idDim?: string | null;
  /** Modo de agregación. */
  aggregation?: FunnelAggregation;
  /** Orden explícito de etapas establecido por el usuario. */
  customOrder?: readonly string[];
}

/**
 * Calcula las métricas completas del embudo de conversión.
 * Función pura: no muta datos, maneja conjuntos vacíos y divisiones por cero con seguridad.
 */
export function computeFunnel(
  rows: readonly AnalysisRow[],
  params: FunnelParams,
): FunnelResult {
  const {
    stageDim,
    valueColumn = null,
    idDim = null,
    aggregation = 'count',
    customOrder = [],
  } = params;

  let ignoredRows = 0;

  // 1. Agrupar datos por etapa
  const stageSums = new Map<string, number>();
  const stageCounts = new Map<string, number>();
  const stageEntities = new Map<string, Set<string>>();

  for (const row of rows) {
    const stage = row.dims[stageDim];

    if (stage === undefined || stage === EMPTY_LABEL || stage.trim() === '') {
      ignoredRows += 1;
      continue;
    }

    const trimmedStage = stage.trim();

    // Suma de valor numérico
    if (valueColumn !== null) {
      const val = row.values[valueColumn];
      if (val !== undefined && val !== null && !Number.isNaN(val)) {
        stageSums.set(trimmedStage, (stageSums.get(trimmedStage) ?? 0) + val);
      }
    }

    // Conteo de filas
    stageCounts.set(trimmedStage, (stageCounts.get(trimmedStage) ?? 0) + 1);

    // Conteo de identidades distintas
    if (idDim !== null) {
      const entityId = row.dims[idDim];
      if (entityId !== undefined && entityId !== EMPTY_LABEL) {
        let set = stageEntities.get(trimmedStage);
        if (!set) {
          set = new Set<string>();
          stageEntities.set(trimmedStage, set);
        }
        set.add(entityId);
      }
    }
  }

  // Si no hay etapas válidas, retornar resultado vacío seguro
  const uniqueStageNames = Array.from(
    new Set([
      ...Array.from(stageCounts.keys()),
      ...customOrder.filter((s) => s.trim().length > 0),
    ]),
  );

  if (uniqueStageNames.length === 0) {
    return {
      stages: [],
      summary: {
        topVolume: 0,
        bottomVolume: 0,
        overallConversionRate: 0,
        bottleneckStage: null,
        maxDropOffRate: 0,
        maxDropOffVolume: 0,
        totalDropOff: 0,
      },
      ignoredRows,
    };
  }

  // 2. Determinar orden de etapas: respetar customOrder si existe, luego por orden de aparición / volumen
  let orderedStages: string[] = [];

  if (customOrder.length > 0) {
    // Primero los que están en customOrder (que existan en los datos o hayan sido ordenados)
    for (const st of customOrder) {
      if (uniqueStageNames.includes(st) && !orderedStages.includes(st)) {
        orderedStages.push(st);
      }
    }
    // Añadir cualquier etapa de los datos no incluida en customOrder
    for (const st of uniqueStageNames) {
      if (!orderedStages.includes(st)) {
        orderedStages.push(st);
      }
    }
  } else {
    // Orden natural: orden descendente de volumen para formar un embudo coherente
    orderedStages = [...uniqueStageNames].sort((a, b) => {
      const volA = getStageVolume(a, aggregation, stageSums, stageCounts, stageEntities);
      const volB = getStageVolume(b, aggregation, stageSums, stageCounts, stageEntities);
      return volB - volA;
    });
  }

  // 3. Calcular volúmenes brutos por etapa ordenada
  const stageRawVolumes = orderedStages.map((stageName) => {
    return {
      stage: stageName,
      volume: getStageVolume(stageName, aggregation, stageSums, stageCounts, stageEntities),
    };
  });

  const topVolume = stageRawVolumes[0]?.volume ?? 0;
  const bottomVolume = stageRawVolumes[stageRawVolumes.length - 1]?.volume ?? 0;
  const overallConversionRate =
    topVolume > 0 ? Math.min(100, Math.max(0, (bottomVolume / topVolume) * 100)) : 0;

  // 4. Calcular métricas paso a paso y drop-offs
  let maxDropOffRate = 0;
  let maxDropOffVolume = 0;
  let bottleneckStageName: string | null = null;
  let totalDropOff = 0;

  // Primera pasada para calcular caídas y buscar cuello de botella
  const tempStages = stageRawVolumes.map((item, index) => {
    const prevVolume = index > 0 ? (stageRawVolumes[index - 1]?.volume ?? 0) : item.volume;

    const conversionFromTop =
      topVolume > 0 ? (item.volume / topVolume) * 100 : 0;

    let stepConversionRate = 100;
    let dropOff = 0;
    let dropOffRate = 0;

    if (index > 0) {
      if (prevVolume > 0) {
        stepConversionRate = Math.max(0, (item.volume / prevVolume) * 100);
        dropOff = Math.max(0, prevVolume - item.volume);
        dropOffRate = Math.max(0, (dropOff / prevVolume) * 100);
      } else {
        stepConversionRate = 0;
        dropOff = 0;
        dropOffRate = 0;
      }
      totalDropOff += dropOff;
    }

    return {
      stage: item.stage,
      order: index,
      volume: item.volume,
      conversionFromTop: Math.round(conversionFromTop * 100) / 100,
      stepConversionRate: Math.round(stepConversionRate * 100) / 100,
      dropOff: Math.round(dropOff * 100) / 100,
      dropOffRate: Math.round(dropOffRate * 100) / 100,
      isBottleneck: false,
    };
  });

  // Localizar cuello de botella (etapa con mayor dropOffRate > 0)
  for (let i = 1; i < tempStages.length; i++) {
    const st = tempStages[i]!;
    if (st.dropOffRate > maxDropOffRate || (st.dropOffRate === maxDropOffRate && st.dropOff > maxDropOffVolume)) {
      maxDropOffRate = st.dropOffRate;
      maxDropOffVolume = st.dropOff;
      bottleneckStageName = st.stage;
    }
  }

  // Marcar la etapa de cuello de botella
  const finalStages: FunnelStage[] = tempStages.map((st) => ({
    ...st,
    isBottleneck: bottleneckStageName !== null && st.stage === bottleneckStageName && st.dropOffRate > 0,
  }));

  return {
    stages: finalStages,
    summary: {
      topVolume,
      bottomVolume,
      overallConversionRate: Math.round(overallConversionRate * 100) / 100,
      bottleneckStage: bottleneckStageName,
      maxDropOffRate: Math.round(maxDropOffRate * 100) / 100,
      maxDropOffVolume: Math.round(maxDropOffVolume * 100) / 100,
      totalDropOff: Math.round(totalDropOff * 100) / 100,
    },
    ignoredRows,
  };
}

function getStageVolume(
  stage: string,
  aggregation: FunnelAggregation,
  sums: Map<string, number>,
  counts: Map<string, number>,
  entities: Map<string, Set<string>>,
): number {
  if (aggregation === 'sum') {
    return sums.get(stage) ?? 0;
  }
  if (aggregation === 'count_distinct') {
    return entities.get(stage)?.size ?? 0;
  }
  return counts.get(stage) ?? 0;
}
