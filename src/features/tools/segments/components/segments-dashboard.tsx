import { useMemo, useRef } from 'react';
import type { EChartsCoreOption } from 'echarts/core';
import {
  Download,
  GitCompare,
  ImageDown,
  Sparkles,
  TriangleAlert,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { EChart, type EChartHandle } from '@/components/echart';
import { downloadDataUrl, downloadTextFile } from '@/lib/download';
import { cn } from '@/lib/utils';
import { formatCount, formatDelta, formatMetric, formatShare } from '@/features/analysis/lib/format';
import { prepareRows } from '@/features/analysis/lib/prepare-rows';
import type { ParsedDataset } from '@/features/dataset/types';
import type { ColumnMappingState } from '@/features/mapping/use-column-mapping';
import { segmentsToCsv } from '../lib/export-segments-csv';
import { computeSegmentComparison } from '../lib/segments';
import type { SegmentsConfigState } from '../use-segments-config';

export function SegmentsDashboard({
  dataset,
  mapping,
  state,
}: {
  dataset: ParsedDataset;
  mapping: ColumnMappingState;
  state: SegmentsConfigState;
}) {
  const chartRef = useRef<EChartHandle>(null);
  const mixChartRef = useRef<EChartHandle>(null);

  const {
    segmentDim,
    primaryMeasure,
    breakdownDim,
    availableMeasures,
    settings,
    update,
  } = state;

  const prepared = useMemo(
    () => prepareRows(dataset.rows, mapping.columns, { dateColumn: null }, mapping.preserveInvalid),
    [dataset.rows, mapping.columns, mapping.preserveInvalid],
  );

  // Extract distinct values of segmentDim
  const distinctValues = useMemo(() => {
    if (!segmentDim) return [];
    return prepared.distinct[segmentDim] ?? [];
  }, [prepared.distinct, segmentDim]);

  // Initial auto-assignment of Segment A and B if empty
  const segAValues = useMemo(() => {
    if (settings.segmentAValues.length > 0) return settings.segmentAValues;
    if (distinctValues.length > 0) return [distinctValues[0]!];
    return [];
  }, [settings.segmentAValues, distinctValues]);

  const segBValues = useMemo(() => {
    if (settings.segmentBValues.length > 0) return settings.segmentBValues;
    if (distinctValues.length > 1) return [distinctValues[1]!];
    if (distinctValues.length === 1) return [distinctValues[0]!];
    return [];
  }, [settings.segmentBValues, distinctValues]);

  const result = useMemo(() => {
    if (!segmentDim || !primaryMeasure || segAValues.length === 0 || segBValues.length === 0) {
      return null;
    }

    return computeSegmentComparison(prepared.rows, {
      segmentDim,
      segmentAValues: segAValues,
      segmentBValues: segBValues,
      segmentAName: settings.segmentAName || 'Segmento A',
      segmentBName: settings.segmentBName || 'Segmento B',
      primaryMeasure,
      allMeasures: availableMeasures,
      breakdownDim,
    });
  }, [
    prepared.rows,
    segmentDim,
    segAValues,
    segBValues,
    settings.segmentAName,
    settings.segmentBName,
    primaryMeasure,
    availableMeasures,
    breakdownDim,
  ]);

  const baseName = dataset.fileName.replace(/\.[^.]+$/, '');
  const currency = settings.currency;
  const numFormat = useMemo(
    () => ({ format: 'numero' as const, currency }),
    [currency],
  );

  const toggleValA = (val: string) => {
    const next = segAValues.includes(val)
      ? segAValues.filter((v) => v !== val)
      : [...segAValues, val];
    update({ segmentAValues: next });
  };

  const toggleValB = (val: string) => {
    const next = segBValues.includes(val)
      ? segBValues.filter((v) => v !== val)
      : [...segBValues, val];
    update({ segmentBValues: next });
  };

  // Grouped Bar Chart Option (Comparing All Metrics Sums or Means)
  const comparisonChartOption = useMemo<EChartsCoreOption>(() => {
    if (!result) return {};

    const metricLabels = result.metrics.map((m) => m.label);
    const dataA = result.metrics.map((m) => m.meanA);
    const dataB = result.metrics.map((m) => m.meanB);

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: any) => {
          const idx = params[0]?.dataIndex;
          const m = result.metrics[idx];
          if (!m) return '';
          return `<div class="font-sans text-xs">
            <div class="font-semibold mb-1">${m.label} (Medias)</div>
            <div>${result.segmentAName}: <b>${formatMetric(m.meanA, numFormat)}</b></div>
            <div>${result.segmentBName}: <b>${formatMetric(m.meanB, numFormat)}</b></div>
            <div class="mt-1 border-t pt-1">Variación: <b>${formatDelta(m.deltaMeanPct)}</b></div>
          </div>`;
        },
      },
      legend: {
        data: [result.segmentAName, result.segmentBName],
        bottom: 0,
      },
      grid: {
        top: 25,
        bottom: 45,
        left: 50,
        right: 25,
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: metricLabels,
        axisLabel: {
          rotate: metricLabels.length > 5 ? 30 : 0,
          interval: 0,
          fontSize: 11,
        },
      },
      yAxis: {
        type: 'value',
        name: 'Media por fila',
        splitLine: { lineStyle: { type: 'dashed' } },
      },
      series: [
        {
          name: result.segmentAName,
          type: 'bar',
          data: dataA,
          itemStyle: { color: '#3b82f6', borderRadius: [4, 4, 0, 0] },
        },
        {
          name: result.segmentBName,
          type: 'bar',
          data: dataB,
          itemStyle: { color: '#10b981', borderRadius: [4, 4, 0, 0] },
        },
      ],
    };
  }, [result, numFormat]);

  // Mix-Shift Decomposition Horizontal Bar Chart Option
  const mixShiftChartOption = useMemo<EChartsCoreOption>(() => {
    if (!result?.mixShift || result.mixShift.rows.length === 0) return {};

    const topRows = result.mixShift.rows.slice(0, 10).reverse();
    const categories = topRows.map((r) => r.category);
    const mixEffects = topRows.map((r) => r.mixEffect);
    const rateEffects = topRows.map((r) => r.rateEffect);

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: any) => {
          const idx = params[0]?.dataIndex;
          const r = topRows[idx];
          if (!r) return '';
          return `<div class="font-sans text-xs">
            <div class="font-semibold mb-1">${r.category}</div>
            <div>Efecto Mix (volumen/peso): <b>${formatMetric(r.mixEffect, numFormat)}</b></div>
            <div>Efecto Tasa (rendimiento): <b>${formatMetric(r.rateEffect, numFormat)}</b></div>
            <div class="border-t pt-1 mt-1">Impacto total: <b>${formatMetric(r.totalEffect, numFormat)}</b></div>
          </div>`;
        },
      },
      legend: {
        data: ['Efecto Mix (composición)', 'Efecto Tasa (rendimiento)'],
        bottom: 0,
      },
      grid: {
        top: 25,
        bottom: 45,
        left: 100,
        right: 25,
        containLabel: true,
      },
      xAxis: {
        type: 'value',
        name: 'Impacto en la media',
        splitLine: { lineStyle: { type: 'dashed' } },
      },
      yAxis: {
        type: 'category',
        data: categories,
        axisLabel: {
          fontSize: 11,
          overflow: 'truncate',
          width: 85,
        },
      },
      series: [
        {
          name: 'Efecto Mix (composición)',
          type: 'bar',
          stack: 'total',
          data: mixEffects,
          itemStyle: { color: '#8b5cf6' },
        },
        {
          name: 'Efecto Tasa (rendimiento)',
          type: 'bar',
          stack: 'total',
          data: rateEffects,
          itemStyle: { color: '#06b6d4' },
        },
      ],
    };
  }, [result, numFormat]);

  if (!segmentDim || !primaryMeasure) {
    return (
      <Alert role="status">
        <TriangleAlert className="size-4" />
        <AlertTitle>Faltan columnas obligatorias</AlertTitle>
        <AlertDescription>
          Selecciona una dimensión de segmentación y una métrica principal en la configuración.
        </AlertDescription>
      </Alert>
    );
  }

  const prim = result?.primaryMetric;

  return (
    <div className="space-y-3">
      {/* Category Selectors for Segment A and B */}
      <Card size="sm">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-1.5">
            <GitCompare className="size-4 text-primary" />
            Definición interactiva de segmentos ({segmentDim})
          </CardTitle>
          <CardDescription className="text-xs">
            Haz clic en los valores para asignar categorías al Segmento A o al Segmento B
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {/* Segment A values picker */}
            <div className="p-3 border rounded-md bg-blue-500/5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-blue-700 dark:text-blue-400">
                  {result?.segmentAName ?? 'Segmento A'} ({segAValues.length} seleccionados)
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatCount(result?.countA ?? 0)} filas
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-28 overflow-auto">
                {distinctValues.map((val) => {
                  const active = segAValues.includes(val);
                  return (
                    <button
                      key={val}
                      type="button"
                      onClick={() => toggleValA(val)}
                      className={cn(
                        'px-2 py-0.5 text-xs rounded-md border transition-colors',
                        active
                          ? 'bg-blue-600 text-white border-blue-600 font-medium'
                          : 'bg-background hover:bg-muted text-muted-foreground border-input',
                      )}
                    >
                      {val}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Segment B values picker */}
            <div className="p-3 border rounded-md bg-emerald-500/5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  {result?.segmentBName ?? 'Segmento B'} ({segBValues.length} seleccionados)
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatCount(result?.countB ?? 0)} filas
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-28 overflow-auto">
                {distinctValues.map((val) => {
                  const active = segBValues.includes(val);
                  return (
                    <button
                      key={val}
                      type="button"
                      onClick={() => toggleValB(val)}
                      className={cn(
                        'px-2 py-0.5 text-xs rounded-md border transition-colors',
                        active
                          ? 'bg-emerald-600 text-white border-emerald-600 font-medium'
                          : 'bg-background hover:bg-muted text-muted-foreground border-input',
                      )}
                    >
                      {val}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Top KPI Cards */}
      {result && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Tile
            label={`Tamaño ${result.segmentAName}`}
            value={`${formatCount(result.countA)} filas`}
            hint={result.totalRows > 0 ? formatShare((result.countA / result.totalRows) * 100) : undefined}
          />
          <Tile
            label={`Tamaño ${result.segmentBName}`}
            value={`${formatCount(result.countB)} filas`}
            hint={result.totalRows > 0 ? formatShare((result.countB / result.totalRows) * 100) : undefined}
          />
          <Tile
            label={`Suma ${primaryMeasure}`}
            value={prim ? formatMetric(prim.sumB, numFormat) : 'n/d'}
            hint={prim ? `vs ${formatMetric(prim.sumA, numFormat)} en ${result.segmentAName}` : undefined}
            delta={prim?.deltaSumPct ?? null}
          />
          <Tile
            label={`Media ${primaryMeasure}`}
            value={prim ? formatMetric(prim.meanB, numFormat) : 'n/d'}
            hint={prim ? `vs ${formatMetric(prim.meanA, numFormat)} en ${result.segmentAName}` : undefined}
            delta={prim?.deltaMeanPct ?? null}
          />
        </div>
      )}

      {/* Mix-Shift Summary Box if available */}
      {result?.mixShift && (
        <Card size="sm">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-1.5">
              <Sparkles className="size-4 text-purple-600" />
              Descomposición Mix-Shift ({primaryMeasure} desglosado por {breakdownDim})
            </CardTitle>
            <CardDescription className="text-xs">
              Explica si la variación de la media ({formatDelta(prim?.deltaMeanPct ?? null)}) se debe
              a un cambio en el peso de cada {breakdownDim} (Efecto Mix) o a un mejor/peor resultado
              dentro de cada categoría (Efecto Tasa).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-3 text-xs">
              <div className="p-2.5 border rounded-md bg-muted/20">
                <span className="text-muted-foreground block">Variación total de media (Δ)</span>
                <span className="text-base font-bold tabular-nums">
                  {formatMetric(result.mixShift.totalMeanDelta, numFormat)}
                </span>
                <span className="text-[11px] text-muted-foreground block">
                  Media B ({formatMetric(result.mixShift.meanB, numFormat)}) - Media A ({formatMetric(result.mixShift.meanA, numFormat)})
                </span>
              </div>
              <div className="p-2.5 border rounded-md bg-purple-500/5">
                <span className="text-purple-700 dark:text-purple-400 font-medium block">
                  Efecto Mix (composición de cartera)
                </span>
                <span className="text-base font-bold tabular-nums text-purple-700 dark:text-purple-400">
                  {formatMetric(result.mixShift.totalMixEffect, numFormat)}
                </span>
                <span className="text-[11px] text-muted-foreground block">
                  Impacto derivado de ganar o perder peso relativo entre categorías
                </span>
              </div>
              <div className="p-2.5 border rounded-md bg-cyan-500/5">
                <span className="text-cyan-700 dark:text-cyan-400 font-medium block">
                  Efecto Tasa (rendimiento interno)
                </span>
                <span className="text-base font-bold tabular-nums text-cyan-700 dark:text-cyan-400">
                  {formatMetric(result.mixShift.totalRateEffect, numFormat)}
                </span>
                <span className="text-[11px] text-muted-foreground block">
                  Impacto derivado del rendimiento intrínseco de cada categoría
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts Section */}
      {result && (
        <div className={cn('grid gap-3', result.mixShift ? 'lg:grid-cols-2' : 'grid-cols-1')}>
          <Card size="sm">
            <CardHeader>
              <CardTitle>Comparativa de medias por métrica</CardTitle>
              <CardDescription className="text-xs">
                {result.segmentAName} (azul) vs {result.segmentBName} (verde)
              </CardDescription>
              <CardAction>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7"
                  onClick={() => {
                    const url = chartRef.current?.toPngDataUrl();
                    if (url) downloadDataUrl(`${baseName}-comparativa-segmentos.png`, url);
                  }}
                >
                  <ImageDown className="size-3.5" />
                  PNG
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 ml-1"
                  onClick={() =>
                    downloadTextFile(
                      `${baseName}-comparativa-segmentos.csv`,
                      segmentsToCsv(result),
                      'text/csv;charset=utf-8',
                    )
                  }
                >
                  <Download className="size-3.5" />
                  CSV
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent>
              <EChart
                ref={chartRef}
                option={comparisonChartOption}
                ariaLabel="Comparativa de medias entre segmentos"
                className="h-80 w-full"
              />
            </CardContent>
          </Card>

          {result.mixShift && (
            <Card size="sm">
              <CardHeader>
                <CardTitle>Desglose de Efectos por {breakdownDim}</CardTitle>
                <CardDescription className="text-xs">
                  Efecto Mix (morado) vs Efecto Rendimiento (cian)
                </CardDescription>
                <CardAction>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7"
                    onClick={() => {
                      const url = mixChartRef.current?.toPngDataUrl();
                      if (url) downloadDataUrl(`${baseName}-mix-shift-${breakdownDim}.png`, url);
                    }}
                  >
                    <ImageDown className="size-3.5" />
                    PNG
                  </Button>
                </CardAction>
              </CardHeader>
              <CardContent>
                <EChart
                  ref={mixChartRef}
                  option={mixShiftChartOption}
                  ariaLabel="Desglose Mix Shift"
                  className="h-80 w-full"
                />
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Comprehensive Metric Comparison Table */}
      {result && (
        <Card size="sm">
          <CardHeader>
            <CardTitle>Tabla comparativa detallada de métricas</CardTitle>
            <CardDescription className="text-xs">
              Valores totales, medias y deltas entre {result.segmentAName} y {result.segmentBName}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-72 overflow-auto rounded-md border">
              <table className="w-full border-collapse text-sm">
                <thead className="sticky top-0 z-10 bg-card">
                  <tr className="border-b">
                    <th scope="col" className="px-3 py-2 text-left font-medium">Métrica</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Suma {result.segmentAName}</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Suma {result.segmentBName}</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Δ Suma (%)</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Media {result.segmentAName}</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Media {result.segmentBName}</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Δ Media (%)</th>
                  </tr>
                </thead>
                <tbody>
                  {result.metrics.map((m) => (
                    <tr key={m.metric} className="border-b last:border-0 hover:bg-muted/40">
                      <td className="px-3 py-1.5 font-medium">{m.label}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{formatMetric(m.sumA, numFormat)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{formatMetric(m.sumB, numFormat)}</td>
                      <td className="px-3 py-1.5 text-right">
                        <DeltaBadge delta={m.deltaSumPct} />
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{formatMetric(m.meanA, numFormat)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{formatMetric(m.meanB, numFormat)}</td>
                      <td className="px-3 py-1.5 text-right">
                        <DeltaBadge delta={m.deltaMeanPct} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Mix Shift Detailed Breakdown Table */}
      {result?.mixShift && (
        <Card size="sm">
          <CardHeader>
            <CardTitle>Detalle del efecto Mix-Shift por {breakdownDim}</CardTitle>
            <CardDescription className="text-xs">
              Cuota de volumen, variación de peso e impactos descompuestos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-72 overflow-auto rounded-md border">
              <table className="w-full border-collapse text-sm">
                <thead className="sticky top-0 z-10 bg-card">
                  <tr className="border-b">
                    <th scope="col" className="px-3 py-2 text-left font-medium">{breakdownDim}</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Mix {result.segmentAName}</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Mix {result.segmentBName}</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Δ Cuota</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Media A</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Media B</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Efecto Mix</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Efecto Tasa</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Efecto Total</th>
                  </tr>
                </thead>
                <tbody>
                  {result.mixShift.rows.map((r) => (
                    <tr key={r.category} className="border-b last:border-0 hover:bg-muted/40">
                      <td className="px-3 py-1.5 font-medium">{r.category}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{formatShare(r.shareA * 100)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{formatShare(r.shareB * 100)}</td>
                      <td className="px-3 py-1.5 text-right">
                        <DeltaBadge delta={r.deltaShare * 100} />
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{formatMetric(r.meanA, numFormat)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{formatMetric(r.meanB, numFormat)}</td>
                      <td className="px-3 py-1.5 text-right font-mono tabular-nums text-purple-700 dark:text-purple-400">
                        {formatMetric(r.mixEffect, numFormat)}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono tabular-nums text-cyan-700 dark:text-cyan-400">
                        {formatMetric(r.rateEffect, numFormat)}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono font-semibold tabular-nums">
                        {formatMetric(r.totalEffect, numFormat)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta === null || !Number.isFinite(delta)) {
    return <span className="text-xs text-muted-foreground">n/d</span>;
  }
  const isPositive = delta > 0;
  const isZero = Math.abs(delta) < 0.01;

  if (isZero) {
    return <Badge variant="outline" className="text-muted-foreground border-transparent">0.0 %</Badge>;
  }

  return (
    <Badge
      variant="outline"
      className={cn(
        'font-mono text-xs tabular-nums',
        isPositive
          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-200'
          : 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-200',
      )}
    >
      {isPositive ? `+${delta.toFixed(1)} %` : `${delta.toFixed(1)} %`}
    </Badge>
  );
}

function Tile({
  label,
  value,
  hint,
  delta,
}: {
  label: string;
  value: string;
  hint?: string;
  delta?: number | null;
}) {
  return (
    <div className="rounded-md border p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{label}</p>
        {delta !== undefined && delta !== null && (
          <Badge
            variant="outline"
            className={cn(
              'text-[10px] px-1 py-0 h-4 font-mono',
              delta >= 0
                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200'
                : 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-200',
            )}
          >
            {delta >= 0 ? `+${delta.toFixed(1)}%` : `${delta.toFixed(1)}%`}
          </Badge>
        )}
      </div>
      <p className="text-base font-semibold tabular-nums mt-0.5">{value}</p>
      {hint !== undefined && <p className="text-xs text-pretty text-muted-foreground truncate">{hint}</p>}
    </div>
  );
}
