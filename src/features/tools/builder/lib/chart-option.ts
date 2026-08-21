import type { EChartsCoreOption } from 'echarts/core';
import { formatMetric } from '@/features/analysis/lib/format';
import { OTHERS_COLOR, PALETTE } from '@/features/analysis/lib/serie-option';
import type { Currency, MetricDef } from '@/features/analysis/types';
import type { ChartData, ChartKind } from './build-chart';

/**
 * Traduce los datos del constructor a una opción de ECharts.
 *
 * Función pura: no toca el DOM ni importa ECharts en runtime, igual que la de
 * la evolución del análisis cruzado, así que se puede probar en Node y no
 * arrastra el megabyte de la librería a quien solo quiera los números.
 */

export interface ChartOptionInput {
  data: ChartData;
  kind: ChartKind;
  metric: MetricDef;
  metricY: MetricDef | null;
  currency: Currency;
  /** Categorías en el eje vertical: rótulos largos se leen mucho mejor así. */
  horizontal: boolean;
  showLegend: boolean;
  showLabels: boolean;
  ariaDescription: string;
}

export function buildChartOption(input: ChartOptionInput): EChartsCoreOption {
  const base = {
    backgroundColor: 'transparent',
    aria: { enabled: true, description: input.ariaDescription },
    tooltip: tooltipOf(input),
    legend: legendOf(input),
  };

  if (input.kind === 'circular') return { ...base, ...pieOption(input) };
  if (input.kind === 'dispersion') return { ...base, ...scatterOption(input) };
  return { ...base, ...cartesianOption(input) };
}

function tooltipOf(input: ChartOptionInput) {
  return {
    trigger: input.kind === 'circular' || input.kind === 'dispersion' ? 'item' : 'axis',
    // Se dibuja fuera de la tarjeta para que no lo recorte su desbordamiento.
    renderMode: 'html',
    appendTo: 'body',
    confine: false,
    className: 'quickbi-chart-tooltip',
    backgroundColor: 'var(--popover)',
    borderColor: 'var(--border)',
    textStyle: { color: 'var(--popover-foreground)' },
    extraCssText:
      'z-index: 9999; max-width: min(22rem, calc(100vw - 1rem)); white-space: normal; overflow-wrap: anywhere; pointer-events: none;',
    valueFormatter: (value: unknown) => format(value, input.metric, input.currency),
  };
}

function legendOf(input: ChartOptionInput) {
  if (!input.showLegend) return { show: false };

  return {
    type: 'plain' as const,
    orient: 'horizontal' as const,
    left: 0,
    right: 0,
    bottom: 0,
    itemWidth: 14,
    itemHeight: 8,
    itemGap: 8,
    textStyle: { fontSize: 10 },
  };
}

function gridOf(input: ChartOptionInput) {
  return {
    left: 8,
    right: 16,
    top: 16,
    bottom: input.showLegend ? 48 : 8,
    containLabel: true,
  };
}

function colorAt(index: number, isOthers: boolean): string {
  return isOthers ? OTHERS_COLOR : (PALETTE[index % PALETTE.length] ?? OTHERS_COLOR);
}

function cartesianOption(input: ChartOptionInput) {
  const { data, kind, horizontal } = input;
  const stacked = kind === 'barras_apiladas';
  const labels = data.categories.map((category) => category.label);

  const categoryAxis = {
    type: 'category' as const,
    data: labels,
    axisLabel: {
      hideOverlap: true,
      rotate: !horizontal && labels.length > 8 ? 45 : 0,
      fontSize: 10,
      width: horizontal ? 120 : undefined,
      overflow: horizontal ? ('truncate' as const) : undefined,
    },
  };

  const valueAxis = {
    type: 'value' as const,
    axisLabel: {
      fontSize: 10,
      formatter: (value: number) =>
        formatMetric(value, {
          format: input.metric.format,
          currency: input.currency,
          compact: true,
        }),
    },
  };

  const series = data.series.map((serie, index) => ({
    type: kind === 'barras' || stacked ? ('bar' as const) : ('line' as const),
    name: serie.name,
    data: serie.values,
    color: colorAt(index, serie.isOthers),
    ...(stacked ? { stack: 'total' } : {}),
    ...(kind === 'area' ? { areaStyle: { opacity: 0.25 } } : {}),
    ...(kind === 'lineas' || kind === 'area'
      ? { showSymbol: labels.length <= 40, symbolSize: 6, connectNulls: false }
      : {}),
    emphasis: { focus: 'series' as const },
    label: {
      show: input.showLabels,
      position: horizontal ? ('right' as const) : ('top' as const),
      fontSize: 10,
      formatter: (params: { value?: unknown }) =>
        format(params.value, input.metric, input.currency, true),
    },
  }));

  return {
    grid: gridOf(input),
    xAxis: horizontal ? valueAxis : categoryAxis,
    yAxis: horizontal ? categoryAxis : valueAxis,
    series,
  };
}

function pieOption(input: ChartOptionInput) {
  const values = input.data.series[0]?.values ?? [];

  return {
    series: [
      {
        type: 'pie' as const,
        radius: ['38%', '68%'],
        center: ['50%', input.showLegend ? '45%' : '50%'],
        avoidLabelOverlap: true,
        itemStyle: { borderColor: 'var(--card)', borderWidth: 2 },
        label: {
          show: input.showLabels,
          fontSize: 10,
          formatter: '{b}: {d} %',
        },
        data: input.data.categories.map((category, index) => ({
          name: category.label,
          value: values[index] ?? 0,
          itemStyle: { color: colorAt(index, category.isOthers) },
        })),
      },
    ],
  };
}

function scatterOption(input: ChartOptionInput) {
  const points = input.data.points ?? [];
  const metricY = input.metricY ?? input.metric;

  return {
    grid: gridOf(input),
    xAxis: {
      type: 'value' as const,
      name: input.metric.label,
      nameLocation: 'middle' as const,
      nameGap: 26,
      nameTextStyle: { fontSize: 10 },
      axisLabel: {
        fontSize: 10,
        formatter: (value: number) =>
          formatMetric(value, {
            format: input.metric.format,
            currency: input.currency,
            compact: true,
          }),
      },
    },
    yAxis: {
      type: 'value' as const,
      name: metricY.label,
      nameTextStyle: { fontSize: 10 },
      axisLabel: {
        fontSize: 10,
        formatter: (value: number) =>
          formatMetric(value, {
            format: metricY.format,
            currency: input.currency,
            compact: true,
          }),
      },
    },
    series: [
      {
        type: 'scatter' as const,
        symbolSize: 10,
        color: PALETTE[0],
        data: points.map((point) => ({ name: point.name, value: [point.x, point.y] })),
        label: {
          show: input.showLabels,
          position: 'top' as const,
          fontSize: 10,
          formatter: '{b}',
        },
        emphasis: { focus: 'self' as const },
      },
    ],
  };
}

function format(
  value: unknown,
  metric: MetricDef,
  currency: Currency,
  compact = false,
): string {
  const numeric =
    typeof value === 'number'
      ? value
      : Array.isArray(value) && typeof value[1] === 'number'
        ? value[1]
        : null;

  return formatMetric(numeric, { format: metric.format, currency, compact });
}
