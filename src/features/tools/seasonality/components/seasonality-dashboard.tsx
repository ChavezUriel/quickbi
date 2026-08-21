import { useMemo, useRef, useState } from 'react';
import {
  CalendarRange,
  CheckCircle2,
  Clock,
  Download,
  ImageDown,
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
import { seasonalityToCsv } from '../lib/export-seasonality-csv';
import { computeSeasonality } from '../lib/seasonality';
import type { SeasonalityConfigState } from '../use-seasonality-config';

export function SeasonalityDashboard({
  dataset,
  mapping,
  state,
}: {
  dataset: ParsedDataset;
  mapping: ColumnMappingState;
  state: SeasonalityConfigState;
}) {
  const dowChartRef = useRef<EChartHandle>(null);
  const monthChartRef = useRef<EChartHandle>(null);
  const timelineChartRef = useRef<EChartHandle>(null);
  const [activeTab, setActiveTab] = useState<'dow' | 'month' | 'quarter'>('dow');

  const { assignments } = state.slots;
  const dateCol = assignments.fecha;
  const measureCol = assignments.metrica;

  const prepared = useMemo(
    () => prepareRows(dataset.rows, mapping.columns, { dateColumn: dateCol ?? null }, mapping.preserveInvalid),
    [dataset.rows, mapping.columns, mapping.preserveInvalid, dateCol],
  );

  const summary = useMemo(() => {
    if (!dateCol || !measureCol) return null;
    return computeSeasonality(prepared.rows as any, {
      dateCol,
      measureCol,
      agg: state.settings.agg,
      movingAvgWindow: state.settings.movingAvgWindow,
    });
  }, [prepared.rows, dateCol, measureCol, state.settings.agg, state.settings.movingAvgWindow]);

  const moneyOpt = useMemo(
    () => ({ format: state.settings.format, currency: state.settings.currency }),
    [state.settings.format, state.settings.currency],
  );
  const baseName = dataset.fileName.replace(/\.[^.]+$/, '');

  // Gráfico 1: Día de la Semana (Bar + Línea Base 100)
  const dowOption = useMemo(() => {
    if (!summary || summary.validRecords === 0) return {};
    const categories = summary.daysOfWeek.map((d) => d.shortName);
    const avgVals = summary.daysOfWeek.map((d) => d.average);

    return {
      tooltip: {
        trigger: 'axis',
        formatter: (params: any[]) => {
          const p = params[0];
          const dow = summary.daysOfWeek[p?.dataIndex ?? 0];
          if (!dow) return '';
          return `
            <div class="text-xs space-y-1">
              <strong class="text-sm">${dow.name}</strong><br/>
              Promedio: <strong>${formatMetric(dow.average, moneyOpt)}</strong><br/>
              Total: ${formatMetric(dow.total, moneyOpt)} (${dow.share.toFixed(1)}%)<br/>
              Índice Estacional: <span class="font-semibold text-primary">${dow.seasonalityIndex.toFixed(0)}%</span> (Base 100)
            </div>
          `;
        },
      },
      grid: { left: '3%', right: '4%', bottom: '8%', top: '12%', containLabel: true },
      xAxis: {
        type: 'category',
        data: categories,
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          formatter: (val: number) => formatMetric(val, { ...moneyOpt, compact: true }),
        },
      },
      series: [
        {
          name: 'Promedio Diario',
          type: 'bar',
          data: avgVals,
          barMaxWidth: 36,
          itemStyle: {
            borderRadius: [4, 4, 0, 0],
            color: (params: any) => {
              const idx = summary.daysOfWeek[params.dataIndex]?.seasonalityIndex ?? 100;
              return idx >= 115 ? '#3b82f6' : idx <= 85 ? '#94a3b8' : '#60a5fa';
            },
          },
          markLine: {
            symbol: 'none',
            data: [
              {
                type: 'average',
                name: 'Promedio Global',
                lineStyle: { color: '#f59e0b', type: 'dashed', width: 2 },
              },
            ],
          },
        },
      ],
    };
  }, [summary, moneyOpt]);

  // Gráfico 2: Mes del Año (Bar con índice base 100)
  const monthOption = useMemo(() => {
    if (!summary || summary.validRecords === 0) return {};
    const categories = summary.monthsOfYear.map((m) => m.shortName);
    const totals = summary.monthsOfYear.map((m) => m.total);

    return {
      tooltip: {
        trigger: 'axis',
        formatter: (params: any[]) => {
          const p = params[0];
          const m = summary.monthsOfYear[p?.dataIndex ?? 0];
          if (!m) return '';
          return `
            <div class="text-xs space-y-1">
              <strong class="text-sm">${m.name}</strong><br/>
              Total Acumulado: <strong>${formatMetric(m.total, moneyOpt)}</strong><br/>
              Participación Anual: ${m.share.toFixed(1)}%<br/>
              Índice Estacional: <span class="font-semibold text-primary">${m.seasonalityIndex.toFixed(0)}%</span>
            </div>
          `;
        },
      },
      grid: { left: '3%', right: '4%', bottom: '8%', top: '12%', containLabel: true },
      xAxis: {
        type: 'category',
        data: categories,
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          formatter: (val: number) => formatMetric(val, { ...moneyOpt, compact: true }),
        },
      },
      series: [
        {
          name: 'Volumen Mensual',
          type: 'bar',
          data: totals,
          barMaxWidth: 30,
          itemStyle: {
            borderRadius: [4, 4, 0, 0],
            color: (params: any) => {
              const idx = summary.monthsOfYear[params.dataIndex]?.seasonalityIndex ?? 100;
              return idx >= 120 ? '#10b981' : idx <= 80 ? '#94a3b8' : '#34d399';
            },
          },
        },
      ],
    };
  }, [summary, moneyOpt]);

  // Gráfico 3: Serie Diaria y Media Móvil
  const timelineOption = useMemo(() => {
    if (!summary || summary.validRecords === 0) return {};
    const dates = summary.timeline.map((p) => p.date);
    const dailyVals = summary.timeline.map((p) => p.value);
    const maVals = summary.timeline.map((p) => p.movingAvg);

    return {
      tooltip: {
        trigger: 'axis',
        formatter: (params: any[]) => {
          const p0 = params[0];
          const p1 = params[1];
          return `
            <div class="text-xs space-y-0.5">
              <strong class="text-sm">${p0?.name}</strong><br/>
              Diario: <strong>${formatMetric(p0?.value, moneyOpt)}</strong><br/>
              Media Móvil (${state.settings.movingAvgWindow}d): <span class="font-semibold text-amber-500">${p1 ? formatMetric(p1.value, moneyOpt) : 'N/D'}</span>
            </div>
          `;
        },
      },
      legend: { data: ['Valor Diario', `Media Móvil (${state.settings.movingAvgWindow} días)`], top: '2%' },
      grid: { left: '3%', right: '4%', bottom: '10%', top: '15%', containLabel: true },
      xAxis: {
        type: 'category',
        data: dates,
        axisLabel: { rotate: 30 },
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          formatter: (val: number) => formatMetric(val, { ...moneyOpt, compact: true }),
        },
      },
      series: [
        {
          name: 'Valor Diario',
          type: 'line',
          showSymbol: false,
          data: dailyVals,
          lineStyle: { width: 1, opacity: 0.4 },
          areaStyle: { opacity: 0.08 },
        },
        {
          name: `Media Móvil (${state.settings.movingAvgWindow} días)`,
          type: 'line',
          showSymbol: false,
          data: maVals,
          lineStyle: { width: 3, color: '#f59e0b' },
          itemStyle: { color: '#f59e0b' },
        },
      ],
    };
  }, [summary, state.settings.movingAvgWindow, moneyOpt]);

  if (!dateCol || !measureCol || !summary) {
    return (
      <Alert role="status">
        <TriangleAlert className="size-4" />
        <AlertTitle>Faltan columnas requeridas</AlertTitle>
        <AlertDescription>
          Vuelve a la configuración y selecciona la columna de fecha y la métrica a analizar.
        </AlertDescription>
      </Alert>
    );
  }

  if (summary.validRecords === 0) {
    return (
      <Alert role="status">
        <TriangleAlert className="size-4" />
        <AlertTitle>Sin fechas o métricas válidas</AlertTitle>
        <AlertDescription>
          No se pudieron procesar fechas con valores numéricos válidos en las columnas seleccionadas.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {/* Barra de exportación */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1 px-2.5 py-1 text-xs">
            <Clock className="size-3.5 text-primary" />
            {summary.startDate} al {summary.endDate}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {formatCount(summary.totalDaysSpan)} días en serie temporal
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => {
              const url = (dowChartRef.current || timelineChartRef.current)?.toPngDataUrl();
              if (url) downloadDataUrl(`${baseName}-estacionalidad.png`, url);
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
                `${baseName}-estacionalidad.csv`,
                seasonalityToCsv(summary),
                'text/csv;charset=utf-8',
              )
            }
          >
            <Download className="size-4" />
            CSV
          </Button>
        </div>
      </div>

      {/* Insights y Resumen Estacional */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <CalendarRange className="size-4" />
            </div>
            <div>
              <CardTitle className="text-base">Diagnóstico de estacionalidad</CardTitle>
              <CardDescription className="text-xs">
                Patrones recurrentes y ciclicidad del negocio
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <ul className="grid gap-2 sm:grid-cols-2">
            {summary.insights.map((ins, idx) => (
              <li
                key={idx}
                className="flex items-start gap-2 rounded-md bg-card p-2.5 text-xs text-foreground shadow-2xs"
              >
                <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-primary" />
                <span>{ins}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        <KpiTile
          label="Día pico"
          value={summary.peakDayOfWeek?.name ?? 'N/D'}
          hint={
            summary.peakDayOfWeek
              ? `Índice ${summary.peakDayOfWeek.seasonalityIndex.toFixed(0)}% (${formatMetric(summary.peakDayOfWeek.average, moneyOpt)}/día)`
              : undefined
          }
          tone="good"
        />
        <KpiTile
          label="Día valle"
          value={summary.troughDayOfWeek?.name ?? 'N/D'}
          hint={
            summary.troughDayOfWeek
              ? `Índice ${summary.troughDayOfWeek.seasonalityIndex.toFixed(0)}%`
              : undefined
          }
          tone="neutral"
        />
        <KpiTile
          label="Mes pico"
          value={summary.peakMonth?.name ?? 'N/D'}
          hint={
            summary.peakMonth
              ? `${summary.peakMonth.share.toFixed(1)}% del volumen anual`
              : undefined
          }
          tone="good"
        />
        <KpiTile
          label="Laborables vs Fin de semana"
          value={`${summary.weekdayVsWeekendRatio.toFixed(2)}x`}
          hint={
            summary.weekdayVsWeekendRatio >= 1
              ? 'Mayor actividad entre semana'
              : 'Mayor actividad en fines de semana'
          }
        />
        <KpiTile
          label="Amplitud estacional"
          value={`${summary.seasonalAmplitude.toFixed(0)}%`}
          hint="Variación pico-valle intra-anual"
        />
        <KpiTile
          label="Promedio diario"
          value={formatMetric(summary.globalDailyAverage, moneyOpt)}
          hint={`Volumen total: ${formatMetric(summary.totalVolume, moneyOpt)}`}
        />
      </div>

      {/* Visualizaciones Principales */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card size="sm">
          <CardHeader>
            <CardTitle>Patrón por día de la semana</CardTitle>
            <CardDescription className="text-xs">
              Promedio diario e índice respecto a la media global (Línea naranja)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EChart
              ref={dowChartRef}
              option={dowOption}
              ariaLabel="Distribución por día de la semana"
              className="h-72 w-full"
            />
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardTitle>Distribución mensual</CardTitle>
            <CardDescription className="text-xs">
              Volumen acumulado por mes e identificación de estacionalidad anual
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EChart
              ref={monthChartRef}
              option={monthOption}
              ariaLabel="Distribución por mes del año"
              className="h-72 w-full"
            />
          </CardContent>
        </Card>
      </div>

      {/* Serie Temporal y Media Móvil */}
      <Card size="sm">
        <CardHeader>
          <CardTitle>Serie temporal y media móvil ({state.settings.movingAvgWindow} días)</CardTitle>
          <CardDescription className="text-xs">
            Filtra el ruido diario para revelar la tendencia subyacente y los ciclos estacionales
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EChart
            ref={timelineChartRef}
            option={timelineOption}
            ariaLabel="Serie temporal con media móvil"
            className="h-80 w-full"
          />
        </CardContent>
      </Card>

      {/* Tabla Detallada */}
      <Card size="sm">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle>Tablas de estacionalidad</CardTitle>
              <CardDescription className="text-xs">
                Métricas detalladas e índices estacionales normalizados (Base 100)
              </CardDescription>
            </div>
            <div className="flex items-center gap-1 rounded-lg border bg-muted/40 p-1">
              <button
                type="button"
                onClick={() => setActiveTab('dow')}
                className={cn(
                  'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                  activeTab === 'dow' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                Días de la semana
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('month')}
                className={cn(
                  'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                  activeTab === 'month' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                Meses del año
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('quarter')}
                className={cn(
                  'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                  activeTab === 'quarter' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                Trimestres
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {activeTab === 'dow' && (
            <div className="max-h-72 overflow-auto rounded-md border">
              <table className="w-full border-collapse text-sm">
                <thead className="sticky top-0 bg-card">
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="px-3 py-2 text-left font-medium">Día</th>
                    <th className="px-3 py-2 text-right font-medium">Total</th>
                    <th className="px-3 py-2 text-right font-medium">Días</th>
                    <th className="px-3 py-2 text-right font-medium">Promedio diario</th>
                    <th className="px-3 py-2 text-right font-medium">% Semana</th>
                    <th className="px-3 py-2 text-right font-medium">Índice estacional</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.daysOfWeek.map((d) => (
                    <tr key={d.dayIndex} className="border-b last:border-0 hover:bg-muted/40 text-xs">
                      <td className="px-3 py-1.5 font-medium">{d.name}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{formatMetric(d.total, moneyOpt)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{formatCount(d.occurrences)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{formatMetric(d.average, moneyOpt)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{d.share.toFixed(1)}%</td>
                      <td className="px-3 py-1.5 text-right tabular-nums font-semibold">
                        <span
                          className={cn(
                            'rounded-md px-1.5 py-0.5 text-xs',
                            d.seasonalityIndex >= 115
                              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                              : d.seasonalityIndex <= 85
                                ? 'bg-muted text-muted-foreground'
                                : 'bg-primary/10 text-primary',
                          )}
                        >
                          {d.seasonalityIndex.toFixed(0)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'month' && (
            <div className="max-h-72 overflow-auto rounded-md border">
              <table className="w-full border-collapse text-sm">
                <thead className="sticky top-0 bg-card">
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="px-3 py-2 text-left font-medium">Mes</th>
                    <th className="px-3 py-2 text-right font-medium">Total</th>
                    <th className="px-3 py-2 text-right font-medium">Ocurrencias</th>
                    <th className="px-3 py-2 text-right font-medium">Promedio mensual</th>
                    <th className="px-3 py-2 text-right font-medium">% Año</th>
                    <th className="px-3 py-2 text-right font-medium">Índice estacional</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.monthsOfYear.map((m) => (
                    <tr key={m.monthIndex} className="border-b last:border-0 hover:bg-muted/40 text-xs">
                      <td className="px-3 py-1.5 font-medium">{m.name}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{formatMetric(m.total, moneyOpt)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{formatCount(m.occurrences)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{formatMetric(m.average, moneyOpt)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{m.share.toFixed(1)}%</td>
                      <td className="px-3 py-1.5 text-right tabular-nums font-semibold">
                        <span
                          className={cn(
                            'rounded-md px-1.5 py-0.5 text-xs',
                            m.seasonalityIndex >= 120
                              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                              : m.seasonalityIndex <= 80
                                ? 'bg-muted text-muted-foreground'
                                : 'bg-primary/10 text-primary',
                          )}
                        >
                          {m.seasonalityIndex.toFixed(0)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'quarter' && (
            <div className="max-h-72 overflow-auto rounded-md border">
              <table className="w-full border-collapse text-sm">
                <thead className="sticky top-0 bg-card">
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="px-3 py-2 text-left font-medium">Trimestre</th>
                    <th className="px-3 py-2 text-right font-medium">Total</th>
                    <th className="px-3 py-2 text-right font-medium">Promedio</th>
                    <th className="px-3 py-2 text-right font-medium">% Anual</th>
                    <th className="px-3 py-2 text-right font-medium">Índice estacional</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.quarters.map((q) => (
                    <tr key={q.quarter} className="border-b last:border-0 hover:bg-muted/40 text-xs">
                      <td className="px-3 py-1.5 font-medium">{q.name}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{formatMetric(q.total, moneyOpt)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{formatMetric(q.average, moneyOpt)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{q.share.toFixed(1)}%</td>
                      <td className="px-3 py-1.5 text-right tabular-nums font-semibold">
                        <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-xs text-primary">
                          {q.seasonalityIndex.toFixed(0)}
                        </span>
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
