import type { EChartsCoreOption } from 'echarts/core';
import type { Currency, ExplorationSerie, MetricDef } from '../types';
import { formatMetric } from './format';

/**
 * Paleta categórica explícita: las variables `--chart-N` del tema son escala
 * de grises y no distinguen diez series. Estos tonos mantienen contraste tanto
 * sobre fondo claro como oscuro.
 */
const PALETTE = [
  '#4e79a7',
  '#f28e2b',
  '#59a14f',
  '#e15759',
  '#b07aa1',
  '#76b7b2',
  '#edc948',
  '#ff9da7',
  '#9c755f',
  '#8cd17d',
];

const OTHERS_COLOR = '#9aa0a6';

/** A partir de aquí el color repite matiz: el trazo discontinuo desempata. */
const DASHED_FROM = 8;

const DIMMED_OPACITY = 0.25;

export interface SerieOptionInput {
  serie: ExplorationSerie;
  metric: MetricDef;
  currency: Currency;
  /**
   * Series resaltadas. Vacío significa que no hay selección y todas se ven
   * igual; con selección, el resto se atenúa en vez de desaparecer.
   */
  highlighted: readonly string[];
  ariaDescription: string;
  /**
   * `compact` reserva la leyenda abajo en horizontal. Un lienzo estrecho no
   * puede regalar 168 px a una columna de rótulos: el área de trazado se
   * quedaría en menos de la mitad del ancho y el gráfico dejaría de leerse.
   */
  layout?: 'wide' | 'compact';
}

/**
 * Traduce la evolución a una opción de ECharts. Función pura: no toca el DOM
 * ni importa ECharts en runtime, así que se puede testear en Node.
 */
export function buildSerieOption(input: SerieOptionInput): EChartsCoreOption {
  const { serie, metric, currency, highlighted, ariaDescription, layout = 'wide' } = input;
  const dimming = highlighted.length > 0;
  const compact = layout === 'compact';

  const series = serie.series.map((item, index) => {
    const dimmed = dimming && !highlighted.includes(item.name);
    const color = item.isOthers ? OTHERS_COLOR : (PALETTE[index % PALETTE.length] ?? OTHERS_COLOR);

    return {
      type: 'line' as const,
      name: item.name,
      data: item.values,
      color,
      showSymbol: serie.periods.length <= 40,
      symbolSize: 6,
      // La zona sensible al clic de una línea es fina; ampliarla evita que
      // filtrar por una serie sea un ejercicio de puntería.
      triggerLineEvent: true,
      emphasis: { focus: 'series' as const },
      lineStyle: {
        width: dimmed ? 1 : 2,
        opacity: dimmed ? DIMMED_OPACITY : 1,
        type: (item.isOthers || index >= DASHED_FROM ? 'dashed' : 'solid') as
          | 'dashed'
          | 'solid',
      },
      itemStyle: { opacity: dimmed ? DIMMED_OPACITY : 1 },
      // Los huecos (`null`) cortan la línea: en una media, un período sin datos
      // no es un cero.
      connectNulls: false,
    };
  });

  if (serie.previous !== null) {
    series.push({
      type: 'line',
      name: serie.previous.name,
      data: serie.previous.values,
      color: OTHERS_COLOR,
      showSymbol: false,
      symbolSize: 0,
      triggerLineEvent: false,
      emphasis: { focus: 'series' },
      lineStyle: { width: 2, opacity: 0.3, type: 'dashed' },
      itemStyle: { opacity: 0.3 },
      connectNulls: false,
    });
  }

  return {
    backgroundColor: 'transparent',
    aria: { enabled: true, description: ariaDescription },
    tooltip: {
      trigger: 'axis',
      valueFormatter: (value: unknown) =>
        formatMetric(typeof value === 'number' ? value : null, {
          format: metric.format,
          currency,
        }),
    },
    legend: compact
      ? {
          type: 'scroll',
          orient: 'horizontal',
          left: 'center',
          bottom: 0,
          itemWidth: 14,
          itemHeight: 8,
          textStyle: { fontSize: 10 },
        }
      : {
          type: 'scroll',
          orient: 'vertical',
          right: 0,
          top: 8,
          bottom: 8,
          width: 116,
          textStyle: { fontSize: 11 },
        },
    grid: compact
      ? { left: 4, right: 12, top: 12, bottom: 28, containLabel: true }
      : // La columna de la leyenda cuesta ancho de trazado. En el cuadro de
        // mando el panel del gráfico ronda los 680 px, no los 1900 de antes:
        // 168 px de rótulos se comían la cuarta parte del gráfico.
        { left: 8, right: 132, top: 16, bottom: 8, containLabel: true },
    xAxis: {
      type: 'category',
      data: serie.labels,
      axisLabel: {
        hideOverlap: true,
        rotate: serie.labels.length > (compact ? 6 : 12) ? 45 : 0,
        fontSize: compact ? 10 : 12,
      },
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        fontSize: compact ? 10 : 12,
        formatter: (value: number) =>
          formatMetric(value, { format: metric.format, currency, compact: true }),
      },
    },
    series,
  };
}
