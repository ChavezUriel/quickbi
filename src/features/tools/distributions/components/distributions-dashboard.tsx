import { useMemo, useRef, useState } from 'react';
import type { EChartsCoreOption } from 'echarts/core';
import {
  AlignVerticalJustifyCenter,
  BarChart3,
  Download,
  Flame,
  ImageDown,
  Layers,
  TriangleAlert,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { EChart, type EChartHandle } from '@/components/echart';
import { downloadDataUrl, downloadTextFile } from '@/lib/download';
import { cn } from '@/lib/utils';
import { formatCount, formatMetric } from '@/features/analysis/lib/format';
import { prepareRows } from '@/features/analysis/lib/prepare-rows';
import type { ParsedDataset } from '@/features/dataset/types';
import type { ColumnMappingState } from '@/features/mapping/use-column-mapping';
import { computeDistributions } from '../lib/distributions';
import { distributionToCsv } from '../lib/export-distributions-csv';
import type { DistributionsConfigState } from '../use-distributions-config';

type VisualMode = 'histograma' | 'cajas' | 'ambos';

export function DistributionsDashboard({
  dataset,
  mapping,
  state,
}: {
  dataset: ParsedDataset;
  mapping: ColumnMappingState;
  state: DistributionsConfigState;
}) {
  const [visualMode, setVisualMode] = useState<VisualMode>('ambos');
  const histoRef = useRef<EChartHandle>(null);
  const boxRef = useRef<EChartHandle>(null);

  const { measureColumn, groupDim, effectiveBinCount, settings } = state;

  const prepared = useMemo(
    () => prepareRows(dataset.rows, mapping.columns, { dateColumn: null }, mapping.preserveInvalid),
    [dataset.rows, mapping.columns, mapping.preserveInvalid],
  );

  const result = useMemo(() => {
    if (!measureColumn) return null;
    return computeDistributions(prepared.rows, measureColumn, groupDim, effectiveBinCount);
  }, [prepared.rows, measureColumn, groupDim, effectiveBinCount]);

  const baseName = dataset.fileName.replace(/\.[^.]+$/, '');
  const currency = settings.currency;
  const numFormat = useMemo(
    () => ({ format: 'numero' as const, currency }),
    [currency],
  );

  // Histogram EChart Option
  const histogramOption = useMemo<EChartsCoreOption>(() => {
    if (!result || result.histogram.bins.length === 0) return {};

    const categories = result.histogram.bins.map((b) => b.label);
    const counts = result.histogram.bins.map((b) => b.count);

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: any) => {
          const idx = params[0]?.dataIndex;
          const bin = result.histogram.bins[idx];
          if (!bin) return '';
          return `<div class="font-sans text-xs">
            <div class="font-semibold">Intervalo: ${bin.label}</div>
            <div class="mt-1">Frecuencia: <b>${formatCount(bin.count)} filas</b></div>
            <div>Porcentaje: <b>${bin.relativeFrequency.toFixed(1)} %</b></div>
          </div>`;
        },
      },
      grid: {
        top: 25,
        bottom: 50,
        left: 50,
        right: 25,
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: categories,
        axisLabel: {
          rotate: categories.length > 10 ? 35 : 0,
          interval: 0,
          fontSize: 11,
        },
      },
      yAxis: {
        type: 'value',
        name: 'Filas',
        splitLine: { lineStyle: { type: 'dashed' } },
      },
      series: [
        {
          name: 'Conteo',
          type: 'bar',
          data: counts,
          itemStyle: {
            color: '#3b82f6',
            borderRadius: [4, 4, 0, 0],
          },
          label: {
            show: categories.length <= 15,
            position: 'top',
            formatter: (p: any) => (p.value > 0 ? formatCount(p.value) : ''),
            fontSize: 10,
          },
        },
      ],
    };
  }, [result]);

  // Boxplot EChart Option
  const boxplotOption = useMemo<EChartsCoreOption>(() => {
    if (!result) return {};

    const categories: string[] = ['Global'];
    // [min, Q1, median, Q3, max]
    const boxData: number[][] = [
      [
        result.overall.min,
        result.overall.q1,
        result.overall.median,
        result.overall.q3,
        result.overall.max,
      ],
    ];
    const outliersData: [number, number][] = [];

    // Global outliers
    for (const out of result.overall.outliers) {
      outliersData.push([0, out]);
    }

    if (result.groups && result.groups.length > 0) {
      result.groups.forEach((g, idx) => {
        categories.push(g.group);
        boxData.push([
          g.summary.min,
          g.summary.q1,
          g.summary.median,
          g.summary.q3,
          g.summary.max,
        ]);
        for (const out of g.summary.outliers) {
          outliersData.push([idx + 1, out]);
        }
      });
    }

    return {
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => {
          if (params.seriesType === 'boxplot') {
            const data = params.value;
            return `<div class="font-sans text-xs">
              <div class="font-semibold mb-1">${params.name}</div>
              <div>Máximo: <b>${formatMetric(data[5], numFormat)}</b></div>
              <div>Q3 (75%): <b>${formatMetric(data[4], numFormat)}</b></div>
              <div>Mediana: <b>${formatMetric(data[3], numFormat)}</b></div>
              <div>Q1 (25%): <b>${formatMetric(data[2], numFormat)}</b></div>
              <div>Mínimo: <b>${formatMetric(data[1], numFormat)}</b></div>
            </div>`;
          }
          if (params.seriesType === 'scatter') {
            return `<div class="font-sans text-xs">
              <div class="font-semibold text-rose-600">Valor atípico</div>
              <div>${categories[params.value[0]]}: <b>${formatMetric(params.value[1], numFormat)}</b></div>
            </div>`;
          }
          return '';
        },
      },
      grid: {
        top: 25,
        bottom: 50,
        left: 50,
        right: 25,
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
        scale: true,
        splitLine: { lineStyle: { type: 'dashed' } },
      },
      series: [
        {
          name: 'Boxplot',
          type: 'boxplot',
          data: boxData,
          itemStyle: {
            color: '#93c5fd',
            borderColor: '#1d4ed8',
            borderWidth: 1.5,
          },
        },
        {
          name: 'Atípicos',
          type: 'scatter',
          data: outliersData,
          symbolSize: 6,
          itemStyle: {
            color: '#ef4444',
          },
        },
      ],
    };
  }, [result, numFormat]);

  if (!result || !measureColumn) {
    return (
      <Alert role="status">
        <TriangleAlert className="size-4" />
        <AlertTitle>Falta seleccionar métrica</AlertTitle>
        <AlertDescription>
          Selecciona una columna numérica en la pestaña de configuración para analizar su
          distribución.
        </AlertDescription>
      </Alert>
    );
  }

  if (result.overall.count === 0) {
    return (
      <Alert role="status">
        <TriangleAlert className="size-4" />
        <AlertTitle>Sin datos numéricos</AlertTitle>
        <AlertDescription>
          No hay valores numéricos válidos en la columna {measureColumn}.
        </AlertDescription>
      </Alert>
    );
  }

  const s = result.overall;
  const outlierPct = (s.outliers.length / s.count) * 100;
  const skewLabel =
    s.skewness === null
      ? 'n/d'
      : Math.abs(s.skewness) < 0.5
        ? 'Aprox. simétrica'
        : s.skewness > 0
          ? `Sesgada a la derecha (+${s.skewness.toFixed(2)})`
          : `Sesgada a la izquierda (${s.skewness.toFixed(2)})`;

  return (
    <div className="space-y-3">
      {/* Top KPI Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Tile
          label="Media aritmética"
          value={formatMetric(s.mean, numFormat)}
          hint={`σ = ${formatMetric(s.stdDev, numFormat)}`}
        />
        <Tile
          label="Mediana (Q2)"
          value={formatMetric(s.median, numFormat)}
          hint="50 % de las observaciones"
        />
        <Tile
          label="Rango intercuartílico"
          value={formatMetric(s.iqr, numFormat)}
          hint={`Q1: ${formatMetric(s.q1, numFormat)} · Q3: ${formatMetric(s.q3, numFormat)}`}
        />
        <Tile
          label="Rango total"
          value={`${formatMetric(s.min, numFormat)} a ${formatMetric(s.max, numFormat)}`}
          hint={`Mínimo y máximo`}
        />
        <Tile
          label="Valores atípicos"
          value={formatCount(s.outliers.length)}
          hint={`${outlierPct.toFixed(1)} % de las filas`}
          badge={s.outliers.length > 0 ? `${s.outliers.length} anomalías` : '0 anomalías'}
          badgeVariant={s.outliers.length > 0 ? 'warning' : 'neutral'}
        />
        <Tile
          label="Forma / Asimetría"
          value={skewLabel}
          hint={`Muestra: N = ${formatCount(s.count)}`}
        />
      </div>

      {/* Visual Controls & Actions */}
      <Card size="sm">
        <CardContent className="flex flex-wrap items-center justify-between gap-2 py-2">
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground mr-2">Vista gráfica:</span>
            <Button
              variant={visualMode === 'ambos' ? 'default' : 'outline'}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setVisualMode('ambos')}
            >
              <Layers className="size-3.5 mr-1" />
              Ambos
            </Button>
            <Button
              variant={visualMode === 'histograma' ? 'default' : 'outline'}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setVisualMode('histograma')}
            >
              <BarChart3 className="size-3.5 mr-1" />
              Histograma
            </Button>
            <Button
              variant={visualMode === 'cajas' ? 'default' : 'outline'}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setVisualMode('cajas')}
            >
              <AlignVerticalJustifyCenter className="size-3.5 mr-1" />
              Diagrama de cajas (Boxplot)
            </Button>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <Button
              variant="outline"
              size="sm"
              className="h-7"
              onClick={() => {
                const url = histoRef.current?.toPngDataUrl() ?? boxRef.current?.toPngDataUrl();
                if (url) downloadDataUrl(`${baseName}-distribucion-${measureColumn}.png`, url);
              }}
            >
              <ImageDown className="size-3.5" />
              PNG
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7"
              onClick={() =>
                downloadTextFile(
                  `${baseName}-distribucion-${measureColumn}.csv`,
                  distributionToCsv(result),
                  'text/csv;charset=utf-8',
                )
              }
            >
              <Download className="size-3.5" />
              CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Main Charts */}
      <div
        className={cn(
          'grid gap-3',
          visualMode === 'ambos' ? 'lg:grid-cols-2' : 'grid-cols-1',
        )}
      >
        {(visualMode === 'histograma' || visualMode === 'ambos') && (
          <Card size="sm">
            <CardHeader>
              <CardTitle>Histograma de frecuencias ({measureColumn})</CardTitle>
              <CardDescription className="text-xs">
                {result.histogram.bins.length} intervalos dinámicos · Distribución general de frecuencias
              </CardDescription>
            </CardHeader>
            <CardContent>
              <EChart
                ref={histoRef}
                option={histogramOption}
                ariaLabel={`Histograma de ${measureColumn}`}
                className="h-80 w-full"
              />
            </CardContent>
          </Card>
        )}

        {(visualMode === 'cajas' || visualMode === 'ambos') && (
          <Card size="sm">
            <CardHeader>
              <CardTitle>Diagrama de caja / Boxplot ({measureColumn})</CardTitle>
              <CardDescription className="text-xs">
                Resumen de 5 números (Mín, Q1, Mediana, Q3, Máx) y puntos rojos para valores atípicos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <EChart
                ref={boxRef}
                option={boxplotOption}
                ariaLabel={`Diagrama de cajas de ${measureColumn}`}
                className="h-80 w-full"
              />
            </CardContent>
          </Card>
        )}
      </div>

      {/* Group Breakdown Table (if group dimension is selected) */}
      {result.groups && result.groups.length > 0 && (
        <Card size="sm">
          <CardHeader>
            <CardTitle>Comparativa por grupos ({groupDim})</CardTitle>
            <CardDescription className="text-xs">
              Métricas de posición, dispersión y anomalías comparadas entre categorías
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-72 overflow-auto rounded-md border">
              <table className="w-full border-collapse text-sm">
                <thead className="sticky top-0 z-10 bg-card">
                  <tr className="border-b">
                    <th scope="col" className="px-3 py-2 text-left font-medium">Categoría</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Muestra</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Mediana</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Media</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Desv. (σ)</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">IQR</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Mínimo</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Máximo</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Atípicos</th>
                  </tr>
                </thead>
                <tbody>
                  {result.groups.map((g) => (
                    <tr key={g.group} className="border-b last:border-0 hover:bg-muted/40">
                      <td className="px-3 py-1.5 font-medium">{g.group}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{formatCount(g.count)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{formatMetric(g.summary.median, numFormat)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{formatMetric(g.summary.mean, numFormat)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{formatMetric(g.summary.stdDev, numFormat)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{formatMetric(g.summary.iqr, numFormat)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{formatMetric(g.summary.min, numFormat)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{formatMetric(g.summary.max, numFormat)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">
                        {g.summary.outliers.length > 0 ? (
                          <Badge variant="outline" className="bg-rose-500/10 text-rose-600 border-rose-200">
                            {g.summary.outliers.length}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Outliers Table */}
      {s.outliers.length > 0 && (
        <Card size="sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5 text-sm">
              <Flame className="size-4 text-rose-500" />
              Detalle de valores atípicos detectados ({s.outliers.length} observaciones)
            </CardTitle>
            <CardDescription className="text-xs">
              Valores por encima de {formatMetric(s.upperFence, numFormat)} o por debajo de{' '}
              {formatMetric(s.lowerFence, numFormat)} (Tukey IQR 1.5x)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5 max-h-36 overflow-auto p-1 border rounded-md">
              {s.outliers.slice(0, 100).map((val, idx) => (
                <Badge key={idx} variant="outline" className="bg-rose-500/10 text-rose-700 dark:text-rose-400 font-mono text-xs">
                  {formatMetric(val, numFormat)}
                </Badge>
              ))}
              {s.outliers.length > 100 && (
                <span className="text-xs text-muted-foreground self-center ml-1">
                  ... y {s.outliers.length - 100} más
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Tile({
  label,
  value,
  hint,
  badge,
  badgeVariant,
}: {
  label: string;
  value: string;
  hint?: string;
  badge?: string;
  badgeVariant?: 'neutral' | 'warning';
}) {
  return (
    <div className="rounded-md border p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{label}</p>
        {badge && (
          <Badge
            variant="outline"
            className={cn(
              'text-[10px] px-1 py-0 h-4',
              badgeVariant === 'warning' && 'bg-rose-500/10 text-rose-600 border-rose-200',
              badgeVariant === 'neutral' && 'bg-slate-500/10 text-slate-600 border-slate-200',
            )}
          >
            {badge}
          </Badge>
        )}
      </div>
      <p className="text-base font-semibold tabular-nums mt-0.5">{value}</p>
      {hint !== undefined && <p className="text-xs text-pretty text-muted-foreground truncate">{hint}</p>}
    </div>
  );
}
