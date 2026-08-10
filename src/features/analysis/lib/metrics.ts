import { METRIC_AGG_LABEL } from '../labels';
import { COUNT_METRIC_ID, type MetricAgg, type MetricDef, type MetricFormat } from '../types';

/**
 * Métrica siempre disponible: cuenta filas y no necesita ninguna columna
 * numérica, así que un dataset sin importes tampoco se queda sin cuadro de mando.
 */
export function countMetric(): MetricDef {
  return {
    id: COUNT_METRIC_ID,
    label: 'Número de filas',
    agg: 'count',
    column: null,
    format: 'numero',
    cumulative: true,
  };
}

export function columnMetric(
  column: string,
  agg: Exclude<MetricAgg, 'count'>,
  format: MetricFormat,
): MetricDef {
  return {
    id: `${agg}:${column}`,
    label: `${METRIC_AGG_LABEL[agg]} de ${column}`,
    agg,
    column,
    format,
    // La media no reparte un total entre las categorías: su participación no
    // significa nada y no puede tener residuo «Otros».
    cumulative: agg !== 'avg',
  };
}

export function findMetric(metrics: readonly MetricDef[], id: string | null): MetricDef | null {
  if (id === null) return null;
  return metrics.find((metric) => metric.id === id) ?? null;
}
