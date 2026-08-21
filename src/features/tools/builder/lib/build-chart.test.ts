import { describe, expect, it } from 'vitest';
import { columnMetric, countMetric } from '@/features/analysis/lib/metrics';
import type { AnalysisRow } from '@/features/analysis/types';
import type { PivotAxis } from '../../pivot/lib/pivot';
import { buildChartData, type ChartSpec } from './build-chart';

function row(zona: string, canal: string, importe: number, unidades: number): AnalysisRow {
  return { day: null, dims: { zona, canal }, values: { importe, unidades } };
}

function axis(dim: string, max = 10, sort: PivotAxis['sort'] = 'total'): PivotAxis {
  return {
    keyOf: (item) => item.dims[dim] ?? '',
    labelOf: (key) => key,
    sort,
    max,
  };
}

const ROWS: AnalysisRow[] = [
  row('Norte', 'Web', 100, 4),
  row('Norte', 'Tienda', 50, 1),
  row('Sur', 'Web', 30, 3),
];

const IMPORTE = columnMetric('importe', 'sum', 'numero');
const UNIDADES = columnMetric('unidades', 'sum', 'numero');

function spec(overrides: Partial<ChartSpec> = {}): ChartSpec {
  return {
    kind: 'barras',
    category: axis('zona'),
    series: null,
    metric: IMPORTE,
    metricY: null,
    ...overrides,
  };
}

describe('buildChartData', () => {
  it('dibuja una sola serie con el nombre de la métrica', () => {
    const data = buildChartData(ROWS, spec());

    expect(data.series).toHaveLength(1);
    expect(data.series[0]?.name).toBe(IMPORTE.label);
    expect(data.series[0]?.values).toEqual([150, 30]);
    expect(data.categories.map((category) => category.label)).toEqual(['Norte', 'Sur']);
  });

  it('abre una serie por cada valor de la dimensión de series', () => {
    const data = buildChartData(ROWS, spec({ series: axis('canal') }));

    expect(data.series.map((serie) => serie.name).sort()).toEqual(['Tienda', 'Web']);
    const web = data.series.find((serie) => serie.name === 'Web');
    expect(web?.values).toEqual([100, 30]);
  });

  it('ignora la dimensión de series en un circular', () => {
    const data = buildChartData(ROWS, spec({ kind: 'circular', series: axis('canal') }));
    expect(data.series).toHaveLength(1);
  });

  it('deja hueco donde no hay ninguna fila', () => {
    const data = buildChartData(ROWS, spec({ series: axis('canal') }));
    const tienda = data.series.find((serie) => serie.name === 'Tienda');

    expect(tienda?.values[1]).toBeNull();
  });

  it('cuenta filas cuando la métrica no mira ninguna columna', () => {
    const data = buildChartData(ROWS, spec({ metric: countMetric() }));
    expect(data.total).toBe(3);
  });

  it('cruza dos métricas en la dispersión', () => {
    const data = buildChartData(
      ROWS,
      spec({ kind: 'dispersion', metric: IMPORTE, metricY: UNIDADES }),
    );

    expect(data.points).toEqual([
      { name: 'Norte', x: 150, y: 5 },
      { name: 'Sur', x: 30, y: 3 },
    ]);
  });

  it('recorta la dispersión al máximo de categorías y lo dice', () => {
    const data = buildChartData(
      ROWS,
      spec({ kind: 'dispersion', category: axis('zona', 1), metricY: UNIDADES }),
    );

    expect(data.points).toHaveLength(1);
    expect(data.hiddenCategories).toBe(1);
  });

  it('sobrevive a un dataset vacío', () => {
    const data = buildChartData([], spec());

    expect(data.categories).toEqual([]);
    expect(data.total).toBe(0);
  });
});
