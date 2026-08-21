import type { EChartsCoreOption } from 'echarts/core';
import { formatMetric } from '@/features/analysis/lib/format';
import type { Currency } from '@/features/analysis/types';
import type { AnomaliesResult } from './anomalies';

export function buildAnomaliesChartOption({
  result,
  currency,
}: {
  result: AnomaliesResult;
  currency: Currency;
}): EChartsCoreOption {
  const points = result.points;
  const categories = points.map((p) => p.label);
  const format = { format: 'moneda' as const, currency };

  const lowerValues = points.map((p) => p.lowerBound);
  const bandValues = points.map((p) => Math.max(0, p.upperBound - p.lowerBound));
  const expectedValues = points.map((p) => p.expected);
  const actualValues = points.map((p) => p.actual);

  const anomalyMarkPoints = points
    .filter((p) => p.isAnomaly)
    .map((p) => ({
      name: p.type === 'pico' ? 'Pico inusual' : 'Caída brusca',
      coord: [p.label, p.actual],
      value: p.type === 'pico' ? `+${formatMetric(p.diff, format)}` : formatMetric(p.diff, format),
      itemStyle: {
        color: p.type === 'pico' ? '#f43f5e' : '#f97316',
      },
      symbol: 'pin',
      symbolSize: 36,
    }));

  return {
    tooltip: {
      trigger: 'axis',
      formatter: (params: unknown) => {
        if (!Array.isArray(params) || params.length === 0) return '';
        const dataIndex = (params[0] as { dataIndex: number }).dataIndex;
        const p = points[dataIndex];
        if (!p) return '';

        let html = `<div style="font-weight:600;margin-bottom:4px;">${p.label} (${p.bucket})</div>`;
        html += `<div style="display:flex;justify-content:space-between;gap:12px;"><span>Valor real:</span><strong>${formatMetric(p.actual, format)}</strong></div>`;
        html += `<div style="display:flex;justify-content:space-between;gap:12px;color:#888;"><span>Esperado:</span><span>${formatMetric(p.expected, format)}</span></div>`;
        html += `<div style="display:flex;justify-content:space-between;gap:12px;color:#888;"><span>Rango esperado:</span><span>${formatMetric(p.lowerBound, format)} — ${formatMetric(p.upperBound, format)}</span></div>`;

        if (p.isAnomaly) {
          const color = p.type === 'pico' ? '#f43f5e' : '#f97316';
          const sign = p.diff > 0 ? '+' : '';
          html += `<div style="margin-top:6px;padding-top:4px;border-top:1px solid rgba(255,255,255,0.15);color:${color};font-weight:600;">`;
          html += `⚠️ ${p.type === 'pico' ? 'Pico inusual' : 'Caída brusca'} (${sign}${formatMetric(p.diff, format)} · Z: ${p.score.toFixed(1)})`;
          html += `</div>`;
        }

        return html;
      },
    },
    legend: {
      data: ['Valor Real', 'Valor Esperado', 'Banda de Confianza'],
      top: 0,
      textStyle: { fontSize: 11 },
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '10%',
      top: '12%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: categories,
      boundaryGap: false,
      axisLabel: {
        rotate: categories.length > 15 ? 35 : 0,
        fontSize: 10,
      },
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        formatter: (val: number) => formatMetric(val, { ...format, compact: true }),
      },
      splitLine: {
        lineStyle: { type: 'dashed', opacity: 0.25 },
      },
    },
    series: [
      {
        name: 'Límite Inferior',
        type: 'line',
        stack: 'band',
        silent: true,
        symbol: 'none',
        lineStyle: { opacity: 0 },
        data: lowerValues,
      },
      {
        name: 'Banda de Confianza',
        type: 'line',
        stack: 'band',
        silent: true,
        symbol: 'none',
        lineStyle: { opacity: 0 },
        areaStyle: {
          color: 'rgba(59, 130, 246, 0.15)',
        },
        data: bandValues,
      },
      {
        name: 'Valor Esperado',
        type: 'line',
        symbol: 'none',
        lineStyle: {
          type: 'dashed',
          width: 1.5,
          color: '#94a3b8',
        },
        data: expectedValues,
      },
      {
        name: 'Valor Real',
        type: 'line',
        symbol: 'circle',
        symbolSize: (_value: unknown, params: unknown) => {
          const idx = (params as { dataIndex: number })?.dataIndex ?? 0;
          return points[idx]?.isAnomaly ? 8 : 4;
        },
        itemStyle: {
          color: (params: unknown) => {
            const idx = (params as { dataIndex: number })?.dataIndex ?? 0;
            const p = points[idx];
            if (p?.isAnomaly) {
              return p.type === 'pico' ? '#f43f5e' : '#f97316';
            }
            return '#3b82f6';
          },
        },
        lineStyle: {
          width: 2,
          color: '#3b82f6',
        },
        markPoint: {
          data: anomalyMarkPoints,
        },
        data: actualValues,
      },
    ],
  };
}
