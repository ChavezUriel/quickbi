import type { EChartsCoreOption } from 'echarts/core';
import { formatCount, formatMetric, formatShare } from '@/features/analysis/lib/format';
import type { Currency } from '@/features/analysis/types';
import type { ClvDecile } from './clv';

export function buildClvDecilesChartOption({
  deciles,
  currency,
}: {
  deciles: ClvDecile[];
  currency: Currency;
}): EChartsCoreOption {
  const categories = deciles.map((d) => `D${d.decile}`);
  const shares = deciles.map((d) => d.revenueShare);
  const avgSpends = deciles.map((d) => d.avgSpend);
  const format = { format: 'moneda' as const, currency };

  return {
    tooltip: {
      trigger: 'axis',
      formatter: (params: unknown) => {
        if (!Array.isArray(params) || params.length === 0) return '';
        const idx = (params[0] as { dataIndex: number }).dataIndex;
        const d = deciles[idx];
        if (!d) return '';

        let html = `<div style="font-weight:600;margin-bottom:4px;">${d.label}</div>`;
        html += `<div>Clientes: <strong>${formatCount(d.customerCount)}</strong></div>`;
        html += `<div>Ingresos acumulados: <strong>${formatMetric(d.totalSpend, format)}</strong> (${formatShare(d.revenueShare)})</div>`;
        html += `<div>Gasto medio por cliente: <strong>${formatMetric(d.avgSpend, format)}</strong></div>`;
        html += `<div>Ticket medio (AOV): <strong>${formatMetric(d.avgAov, format)}</strong></div>`;
        return html;
      },
    },
    legend: {
      data: ['% de Ingresos de la cartera', 'Gasto medio por cliente'],
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
      data: categories,
      axisLabel: { fontSize: 11 },
    },
    yAxis: [
      {
        type: 'value',
        name: '% Ingresos',
        min: 0,
        axisLabel: {
          formatter: '{value} %',
        },
        splitLine: {
          lineStyle: { type: 'dashed', opacity: 0.25 },
        },
      },
      {
        type: 'value',
        name: 'Gasto medio',
        axisLabel: {
          formatter: (val: number) => formatMetric(val, { ...format, compact: true }),
        },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: '% de Ingresos de la cartera',
        type: 'bar',
        yAxisIndex: 0,
        itemStyle: {
          color: '#3b82f6',
          borderRadius: [4, 4, 0, 0],
        },
        data: shares.map((s) => Number(s.toFixed(1))),
      },
      {
        name: 'Gasto medio por cliente',
        type: 'line',
        yAxisIndex: 1,
        symbol: 'circle',
        symbolSize: 6,
        itemStyle: { color: '#10b981' },
        lineStyle: { width: 2.5, color: '#10b981' },
        data: avgSpends,
      },
    ],
  };
}
