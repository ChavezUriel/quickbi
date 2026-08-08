import type { EChartsCoreOption } from 'echarts/core';
import type { ChartType } from '../types';
import type { AggregateResult } from './aggregate';

export interface ChartTitles {
  /** Descripción completa («Suma de importe por provincia»): alimenta el aria. */
  title: string;
  /** Nombre de la serie, para tooltip y leyenda («Suma de importe»). */
  valueName: string;
}

const tooltipNumber = new Intl.NumberFormat('es-ES');
const axisNumber = new Intl.NumberFormat('es-ES', { notation: 'compact' });

/** A partir de aquí las etiquetas del eje se rotan para no solaparse. */
const ROTATE_THRESHOLD = 12;

/**
 * Traduce el resultado agregado a una opción de ECharts. Función pura:
 * no toca el DOM ni importa ECharts en runtime, así que se testea en Node.
 */
export function buildChartOption(
  result: AggregateResult,
  chartType: ChartType,
  titles: ChartTitles,
): EChartsCoreOption {
  const base: EChartsCoreOption = {
    // Transparente: el tema oscuro de ECharts trae un fondo azulado propio
    // que desentona con la tarjeta; mejor que se vea el fondo de la tarjeta.
    backgroundColor: 'transparent',
    // El componente aria genera una descripción textual del gráfico para
    // lectores de pantalla; la tabla agregada es el respaldo completo.
    aria: { enabled: true, description: titles.title },
    tooltip: {
      trigger: chartType === 'pie' ? 'item' : 'axis',
      valueFormatter: (value: unknown) => tooltipNumber.format(Number(value)),
    },
  };

  if (chartType === 'pie') {
    return {
      ...base,
      legend: { type: 'scroll' },
      series: [
        {
          type: 'pie',
          name: titles.valueName,
          radius: ['35%', '70%'],
          data: result.rows.map((row) => ({ name: row.label, value: row.value })),
        },
      ],
    };
  }

  const categories = result.rows.map((row) => row.label);

  return {
    ...base,
    grid: { left: 8, right: 16, top: 24, bottom: 8, containLabel: true },
    xAxis: {
      type: 'category',
      data: categories,
      axisLabel: {
        rotate: categories.length > ROTATE_THRESHOLD ? 45 : 0,
        hideOverlap: true,
      },
    },
    yAxis: {
      type: 'value',
      axisLabel: { formatter: (value: number) => axisNumber.format(value) },
    },
    series: [
      {
        type: chartType,
        name: titles.valueName,
        data: result.rows.map((row) => row.value),
        // Con muchas categorías los puntos de la línea son ruido, no información.
        showSymbol: categories.length <= 60,
      },
    ],
  };
}
