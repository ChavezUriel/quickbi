import type { EChartsCoreOption } from 'echarts/core';
import { formatMetric } from '@/features/analysis/lib/format';
import type { Currency } from '@/features/analysis/types';
import type { WaterfallBridgeStep, WaterfallResult } from './waterfall';

const COLOR_MAP: Record<WaterfallBridgeStep['type'], string> = {
  inicio: '#3b82f6', // blue-500
  crecimiento: '#10b981', // emerald-500
  nuevo: '#06b6d4', // cyan-500
  contraccion: '#f43f5e', // rose-500
  perdido: '#f97316', // orange-500
  sin_cambio: '#94a3b8', // slate-400
  final: '#6366f1', // indigo-500
};

export function buildWaterfallChartOption({
  result,
  currency,
}: {
  result: WaterfallResult;
  currency: Currency;
}): EChartsCoreOption {
  const steps = result.bridgeSteps;
  const categories = steps.map((s) => s.name);
  const baseValues = steps.map((s) => s.base);
  const barData = steps.map((s) => ({
    value: s.barValue,
    itemStyle: {
      color: COLOR_MAP[s.type],
      borderRadius: [3, 3, 0, 0],
    },
  }));

  const format = { format: 'moneda' as const, currency };

  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: unknown) => {
        if (!Array.isArray(params) || params.length < 2) return '';
        const dataIndex = (params[1] as { dataIndex: number }).dataIndex;
        const step = steps[dataIndex];
        if (!step) return '';

        const isTotal = step.type === 'inicio' || step.type === 'final';
        const formattedVal = formatMetric(step.signedValue, format);

        let html = `<div style="font-weight:600;margin-bottom:4px;">${step.name}</div>`;
        if (isTotal) {
          html += `<div>Total: <strong>${formattedVal}</strong></div>`;
        } else {
          html += `<div>Variación: <strong style="color:${COLOR_MAP[step.type]}">${step.signedValue > 0 ? '+' : ''}${formattedVal}</strong></div>`;
          if (step.p1 !== undefined && step.p2 !== undefined) {
            html += `<div style="font-size:11px;color:#888;margin-top:2px;">P1: ${formatMetric(step.p1, format)} → P2: ${formatMetric(step.p2, format)}</div>`;
          }
        }
        return html;
      },
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '12%',
      top: '8%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: categories,
      axisLabel: {
        interval: 0,
        rotate: categories.length > 6 ? 30 : 0,
        fontSize: 11,
      },
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        formatter: (value: number) => formatMetric(value, { ...format, compact: true }),
      },
      splitLine: {
        lineStyle: { type: 'dashed', opacity: 0.25 },
      },
    },
    series: [
      {
        name: 'Base',
        type: 'bar',
        stack: 'waterfall',
        silent: true,
        itemStyle: {
          color: 'transparent',
          borderColor: 'transparent',
        },
        data: baseValues,
      },
      {
        name: 'Variación',
        type: 'bar',
        stack: 'waterfall',
        data: barData,
      },
    ],
  };
}
