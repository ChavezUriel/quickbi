import { useMemo, useRef, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Download,
  FileText,
  ImageDown,
  Lightbulb,
  Minus,
  Sparkles,
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
import { computeExecutiveSummary } from '../lib/executive';
import { executiveToCsv } from '../lib/export-executive-csv';
import type { ExecutiveConfigState } from '../use-executive-config';

export function ExecutiveDashboard({
  dataset,
  mapping,
  state,
}: {
  dataset: ParsedDataset;
  mapping: ColumnMappingState;
  state: ExecutiveConfigState;
}) {
  const trendChartRef = useRef<EChartHandle>(null);
  const paretoChartRef = useRef<EChartHandle>(null);
  const [activeTab, setActiveTab] = useState<'pareto' | 'tiempo' | 'anomalias'>('pareto');

  const { assignments } = state.slots;
  const measureCol = assignments.metrica;
  const dateCol = assignments.fecha ?? null;
  const dimensionCol = assignments.dimension ?? null;

  const prepared = useMemo(
    () => prepareRows(dataset.rows, mapping.columns, { dateColumn: dateCol }, mapping.preserveInvalid),
    [dataset.rows, mapping.columns, mapping.preserveInvalid, dateCol],
  );

  const summary = useMemo(() => {
    if (!measureCol) return null;
    return computeExecutiveSummary(prepared.rows as any, {
      measureCol,
      dateCol,
      dimensionCol,
      grain: state.settings.grain,
      agg: state.settings.agg,
    });
  }, [prepared.rows, measureCol, dateCol, dimensionCol, state.settings.grain, state.settings.agg]);

  const moneyOpt = useMemo(
    () => ({ format: state.settings.format, currency: state.settings.currency }),
    [state.settings.format, state.settings.currency],
  );
  const baseName = dataset.fileName.replace(/\.[^.]+$/, '');

  // Gráfico Temporal
  const hasTime = (summary?.trend.timeBuckets.length ?? 0) > 0;
  const trendOption = useMemo(() => {
    if (!summary || !hasTime) return {};
    const categories = summary.trend.timeBuckets.map((t) => t.label);
    const dataVals = summary.trend.timeBuckets.map((t) => t.value);

    return {
      tooltip: {
        trigger: 'axis',
        formatter: (params: any[]) => {
          const p = params[0];
          if (!p) return '';
          return `<div class="text-xs"><strong>${p.name}</strong><br/>${formatMetric(p.value, moneyOpt)}</div>`;
        },
      },
      grid: { left: '3%', right: '4%', bottom: '8%', top: '10%', containLabel: true },
      xAxis: {
        type: 'category',
        data: categories,
        axisLabel: { rotate: categories.length > 10 ? 30 : 0 },
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          formatter: (val: number) => formatMetric(val, { ...moneyOpt, compact: true }),
        },
      },
      series: [
        {
          name: 'Valor',
          type: 'line',
          smooth: true,
          showSymbol: true,
          symbolSize: 6,
          data: dataVals,
          areaStyle: {
            opacity: 0.15,
          },
          lineStyle: {
            width: 3,
          },
        },
      ],
    };
  }, [summary, hasTime, moneyOpt]);

  // Gráfico de Pareto
  const hasPareto = (summary?.pareto.topCategories.length ?? 0) > 0;
  const paretoOption = useMemo(() => {
    if (!summary || !hasPareto) return {};
    const topN = summary.pareto.topCategories.slice(0, 15);
    const names = topN.map((c) => c.name);
    const barValues = topN.map((c) => c.value);
    const cumValues = topN.map((c) => c.cumulativeShare);

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
      },
      grid: { left: '3%', right: '5%', bottom: '15%', top: '12%', containLabel: true },
      xAxis: {
        type: 'category',
        data: names,
        axisLabel: { interval: 0, rotate: 35 },
      },
      yAxis: [
        {
          type: 'value',
          name: 'Valor',
          axisLabel: {
            formatter: (val: number) => formatMetric(val, { ...moneyOpt, compact: true }),
          },
        },
        {
          type: 'value',
          name: '% Acumulado',
          min: 0,
          max: 100,
          axisLabel: { formatter: '{value}%' },
        },
      ],
      series: [
        {
          name: 'Volumen',
          type: 'bar',
          data: barValues,
          barMaxWidth: 32,
          itemStyle: { borderRadius: [4, 4, 0, 0] },
        },
        {
          name: '% Acumulado',
          type: 'line',
          yAxisIndex: 1,
          data: cumValues,
          lineStyle: { width: 2, color: '#f59e0b' },
          itemStyle: { color: '#f59e0b' },
        },
      ],
    };
  }, [summary, hasPareto, moneyOpt]);

  if (!measureCol || !summary) {
    return (
      <Alert role="status">
        <TriangleAlert className="size-4" />
        <AlertTitle>Falta la columna numérica</AlertTitle>
        <AlertDescription>
          Vuelve a la configuración y selecciona la métrica principal a evaluar.
        </AlertDescription>
      </Alert>
    );
  }

  if (summary.validCount === 0) {
    return (
      <Alert role="status">
        <TriangleAlert className="size-4" />
        <AlertTitle>Sin datos que analizar</AlertTitle>
        <AlertDescription>
          No se encontraron registros numéricos válidos en la columna «{measureCol}».
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {/* Botonera de Exportación */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1 px-2.5 py-1 text-xs">
            <Sparkles className="size-3.5 text-primary" />
            Resumen Ejecutivo Generado
          </Badge>
          <span className="text-xs text-muted-foreground">
            {formatCount(summary.validCount)} registros procesados
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => {
              const url = (trendChartRef.current || paretoChartRef.current)?.toPngDataUrl();
              if (url) downloadDataUrl(`${baseName}-resumen-ejecutivo.png`, url);
            }}
          >
            <ImageDown className="size-4" />
            PNG
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            onClick={() =>
              downloadTextFile(
                `${baseName}-resumen-ejecutivo.csv`,
                executiveToCsv(summary),
                'text/csv;charset=utf-8',
              )
            }
          >
            <Download className="size-4" />
            CSV
          </Button>
        </div>
      </div>

      {/* Tarjeta de Síntesis Narrativa Ejecutiva */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <FileText className="size-4" />
              </div>
              <div>
                <CardTitle className="text-base text-foreground">
                  {summary.narrative.headline}
                </CardTitle>
                <CardDescription className="text-xs">
                  Diagnóstico automatizado en lenguaje natural
                </CardDescription>
              </div>
            </div>
            <Badge
              variant={
                summary.trend.direction === 'creciente'
                  ? 'default'
                  : summary.trend.direction === 'decreciente'
                    ? 'destructive'
                    : 'secondary'
              }
              className="capitalize"
            >
              {summary.trend.direction === 'creciente' && <ArrowUpRight className="size-3" />}
              {summary.trend.direction === 'decreciente' && <ArrowDownRight className="size-3" />}
              {summary.trend.direction === 'estable' && <Minus className="size-3" />}
              {summary.trend.direction}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-pretty text-muted-foreground">{summary.narrative.overview}</p>
          {dateCol && (
            <div className="rounded-lg border bg-card p-3">
              <span className="font-semibold text-xs text-foreground uppercase tracking-wider block mb-1">
                Evolución y Trayectoria
              </span>
              <p className="text-xs text-pretty text-muted-foreground">
                {summary.narrative.trendText}
              </p>
            </div>
          )}
          {dimensionCol && (
            <div className="rounded-lg border bg-card p-3">
              <span className="font-semibold text-xs text-foreground uppercase tracking-wider block mb-1">
                Desglose y Concentración
              </span>
              <p className="text-xs text-pretty text-muted-foreground">
                {summary.narrative.concentrationText}
              </p>
            </div>
          )}

          {/* Conclusiones clave */}
          <div className="space-y-1.5 pt-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <Lightbulb className="size-3.5 text-amber-500" />
              Observaciones y recomendaciones clave:
            </span>
            <ul className="grid gap-1.5 sm:grid-cols-2">
              {summary.narrative.insights.map((ins, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-2 rounded-md bg-muted/50 p-2 text-xs text-foreground"
                >
                  <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-primary" />
                  <span>{ins}</span>
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        <KpiTile
          label="Volumen total"
          value={formatMetric(summary.totalValue, moneyOpt)}
          hint={`${formatCount(summary.validCount)} registros`}
        />
        <KpiTile
          label="Media por registro"
          value={formatMetric(summary.meanValue, moneyOpt)}
          hint={`Mediana: ${formatMetric(summary.medianValue, moneyOpt)}`}
        />
        <KpiTile
          label="Crecimiento neto"
          value={
            summary.trend.percentageChange !== null
              ? `${summary.trend.percentageChange >= 0 ? '+' : ''}${summary.trend.percentageChange.toFixed(1)}%`
              : 'N/A'
          }
          hint={
            summary.trend.direction === 'creciente'
              ? 'Tendencia al alza'
              : summary.trend.direction === 'decreciente'
                ? 'Tendencia a la baja'
                : 'Comportamiento estable'
          }
          tone={
            summary.trend.direction === 'creciente'
              ? 'good'
              : summary.trend.direction === 'decreciente'
                ? 'warn'
                : 'neutral'
          }
        />
        <KpiTile
          label="Concentración Top 20%"
          value={`${summary.pareto.top20PercentShare.toFixed(1)}%`}
          hint={
            summary.pareto.totalCategories > 0
              ? `${summary.pareto.totalCategories} categorías evaluadas`
              : 'Sin dimensión'
          }
          tone={summary.pareto.isParetoConcentrated ? 'warn' : 'neutral'}
        />
        <KpiTile
          label="Pico temporal"
          value={
            summary.trend.peakBucket
              ? formatMetric(summary.trend.peakBucket.value, moneyOpt)
              : 'N/A'
          }
          hint={summary.trend.peakBucket?.label ?? 'Sin serie temporal'}
        />
        <KpiTile
          label="Volatilidad (CV)"
          value={`${summary.cv.toFixed(1)}%`}
          hint={`Desv. Estándar: ${formatMetric(summary.stdDev, moneyOpt)}`}
        />
      </div>

      {/* Sección Gráfica */}
      <div className="grid gap-4 lg:grid-cols-2">
        {hasTime && (
          <Card size="sm">
            <CardHeader>
              <CardTitle>Evolución temporal</CardTitle>
              <CardDescription className="text-xs">
                Trayectoria de {measureCol} agrupada por {state.settings.grain}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <EChart
                ref={trendChartRef}
                option={trendOption}
                ariaLabel="Evolución temporal del resumen ejecutivo"
                className="h-72 w-full"
              />
            </CardContent>
          </Card>
        )}

        {hasPareto && (
          <Card size="sm">
            <CardHeader>
              <CardTitle>Curva de Pareto y desglose</CardTitle>
              <CardDescription className="text-xs">
                Volumen y porcentaje acumulado de las principales categorías
              </CardDescription>
            </CardHeader>
            <CardContent>
              <EChart
                ref={paretoChartRef}
                option={paretoOption}
                ariaLabel="Curva de Pareto de categorías"
                className="h-72 w-full"
              />
            </CardContent>
          </Card>
        )}
      </div>

      {/* Tablas Detalladas */}
      <Card size="sm">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle>Detalle analítico</CardTitle>
              <CardDescription className="text-xs">
                Revisa los datos tabulares desglosados
              </CardDescription>
            </div>
            <div className="flex items-center gap-1 rounded-lg border bg-muted/40 p-1">
              <button
                type="button"
                onClick={() => setActiveTab('pareto')}
                className={cn(
                  'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                  activeTab === 'pareto' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                Categorías ({summary.pareto.topCategories.length})
              </button>
              {hasTime && (
                <button
                  type="button"
                  onClick={() => setActiveTab('tiempo')}
                  className={cn(
                    'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                    activeTab === 'tiempo' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  Períodos ({summary.trend.timeBuckets.length})
                </button>
              )}
              {summary.anomalies.length > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTab('anomalias')}
                  className={cn(
                    'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                    activeTab === 'anomalias' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  Anomalías ({summary.anomalies.length})
                </button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {activeTab === 'pareto' && (
            <div className="max-h-72 overflow-auto rounded-md border">
              <table className="w-full border-collapse text-sm">
                <thead className="sticky top-0 bg-card">
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="px-3 py-2 text-left font-medium">Categoría</th>
                    <th className="px-3 py-2 text-right font-medium">Total</th>
                    <th className="px-3 py-2 text-right font-medium">% Individual</th>
                    <th className="px-3 py-2 text-right font-medium">% Acumulado</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.pareto.topCategories.map((c, i) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-muted/40 text-xs">
                      <td className="px-3 py-1.5 font-medium">{c.name}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">
                        {formatMetric(c.value, moneyOpt)}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{c.share.toFixed(1)}%</td>
                      <td className="px-3 py-1.5 text-right tabular-nums font-semibold">
                        {c.cumulativeShare.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'tiempo' && (
            <div className="max-h-72 overflow-auto rounded-md border">
              <table className="w-full border-collapse text-sm">
                <thead className="sticky top-0 bg-card">
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="px-3 py-2 text-left font-medium">Período</th>
                    <th className="px-3 py-2 text-left font-medium">Etiqueta</th>
                    <th className="px-3 py-2 text-right font-medium">Métrica</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.trend.timeBuckets.map((t, i) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-muted/40 text-xs">
                      <td className="px-3 py-1.5 font-mono text-muted-foreground">{t.bucket}</td>
                      <td className="px-3 py-1.5 font-medium">{t.label}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums font-semibold">
                        {formatMetric(t.value, moneyOpt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'anomalias' && (
            <div className="max-h-72 overflow-auto rounded-md border">
              <table className="w-full border-collapse text-sm">
                <thead className="sticky top-0 bg-card">
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="px-3 py-2 text-left font-medium">Período</th>
                    <th className="px-3 py-2 text-right font-medium">Valor registrado</th>
                    <th className="px-3 py-2 text-right font-medium">Z-Score</th>
                    <th className="px-3 py-2 text-left font-medium">Diagnóstico</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.anomalies.map((a, i) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-muted/40 text-xs">
                      <td className="px-3 py-1.5 font-medium">{a.label}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums font-semibold">
                        {formatMetric(a.value, moneyOpt)}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums font-mono">
                        {a.zScore > 0 ? `+${a.zScore.toFixed(2)}` : a.zScore.toFixed(2)}σ
                      </td>
                      <td className="px-3 py-1.5">
                        <Badge variant="secondary" className="text-xs">
                          {a.reason}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function KpiTile({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'good' | 'warn' | 'neutral';
}) {
  return (
    <div
      className={cn(
        'rounded-lg border p-3 bg-card',
        tone === 'good' && 'border-emerald-500/30 bg-emerald-500/5',
        tone === 'warn' && 'border-amber-500/30 bg-amber-500/5',
      )}
    >
      <p className="text-xs text-muted-foreground truncate">{label}</p>
      <p className="text-lg font-semibold tabular-nums mt-0.5">{value}</p>
      {hint && <p className="text-[0.7rem] text-muted-foreground truncate mt-0.5">{hint}</p>}
    </div>
  );
}
