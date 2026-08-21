import type { EChartsCoreOption } from 'echarts/core';
import type { CohortsResult } from './cohorts';

const PALETTE = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#64748b', // slate
];

export function buildCohortsDecayChartOption({
  result,
  metricType,
}: {
  result: CohortsResult;
  metricType: 'clientes' | 'ingresos';
}): EChartsCoreOption {
  const maxP = Math.min(result.averageCurve.length, 12);
  const xCategories = result.averageCurve.slice(0, maxP).map((p) => p.periodLabel);

  // Seleccionar hasta 6 cohortes más recientes o con mayor volumen
  const cohortsToPlot = result.cohorts.slice(-6);

  const series: Record<string, unknown>[] = cohortsToPlot.map((c, idx) => {
    const data = c.periods
      .slice(0, maxP)
      .map((p) => (p.hasData ? Number((metricType === 'clientes' ? p.customerRetentionRate : p.revenueRetentionRate).toFixed(1)) : null));

    return {
      name: c.cohortLabel,
      type: 'line',
      symbol: 'circle',
      symbolSize: 4,
      lineStyle: { width: 1.5 },
      itemStyle: { color: PALETTE[idx % PALETTE.length] },
      data,
    };
  });

  // Curva de Benchmark / Promedio
  const avgData = result.averageCurve
    .slice(0, maxP)
    .map((p) => Number((metricType === 'clientes' ? p.avgCustomerRetentionRate : p.avgRevenueRetentionRate).toFixed(1)));

  series.push({
    name: 'Promedio Cartera',
    type: 'line',
    symbol: 'rect',
    symbolSize: 6,
    lineStyle: { width: 3, type: 'dashed' },
    itemStyle: { color: '#0f172a' },
    data: avgData,
  });

  return {
    tooltip: {
      trigger: 'axis',
      formatter: (params: unknown) => {
        if (!Array.isArray(params) || params.length === 0) return '';
        const periodName = (params[0] as { axisValue: string }).axisValue;

        let html = `<div style="font-weight:600;margin-bottom:4px;">Período ${periodName}</div>`;
        for (const item of params as { seriesName: string; value: number | null; color: string }[]) {
          if (item.value === null || item.value === undefined) continue;
          html += `<div style="display:flex;justify-content:space-between;gap:16px;">`;
          html += `<span style="color:${item.color}">${item.seriesName}:</span>`;
          html += `<strong>${item.value} %</strong>`;
          html += `</div>`;
        }
        return html;
      },
    },
    legend: {
      top: 0,
      textStyle: { fontSize: 11 },
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '10%',
      top: '14%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: xCategories,
      axisLabel: { fontSize: 11 },
    },
    yAxis: {
      type: 'value',
      name: '% Retención',
      min: 0,
      max: 100,
      axisLabel: {
        formatter: '{value} %',
      },
      splitLine: {
        lineStyle: { type: 'dashed', opacity: 0.25 },
      },
    },
    series,
  };
}
