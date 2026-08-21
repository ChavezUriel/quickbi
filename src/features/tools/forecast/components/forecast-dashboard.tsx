import { useMemo, useRef, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Download,
  ImageDown,
  Minus,
  Sparkles,
  TrendingUp,
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
import { formatMetric } from '@/features/analysis/lib/format';
import { prepareRows } from '@/features/analysis/lib/prepare-rows';
import type { ParsedDataset } from '@/features/dataset/types';
import type { ColumnMappingState } from '@/features/mapping/use-column-mapping';
import { forecastToCsv } from '../lib/export-forecast-csv';
import { computeForecast } from '../lib/forecast';
import type { ForecastConfigState } from '../use-forecast-config';

export function ForecastDashboard({
  dataset,
  mapping,
  state,
}: {
  dataset: ParsedDataset;
  mapping: ColumnMappingState;
  state: ForecastConfigState;
}) {
  const chartRef = useRef<EChartHandle>(null);
  const [activeTab, setActiveTab] = useState<'forecast' | 'historical' | 'metrics'>('forecast');

  const { assignments } = state.slots;
  const dateCol = assignments.fecha;
  const measureCol = assignments.metrica;

  const prepared = useMemo(
    () => prepareRows(dataset.rows, mapping.columns, { dateColumn: dateCol ?? null }, mapping.preserveInvalid),
    [dataset.rows, mapping.columns, mapping.preserveInvalid, dateCol],
  );

  const summary = useMemo(() => {
    if (!dateCol || !measureCol) return null;
    return computeForecast(prepared.rows as any, {
      dateCol,
      measureCol,
      grain: state.settings.grain,
      horizon: state.settings.horizon,
      model: state.settings.model,
      confidenceLevel: state.settings.confidenceLevel,
      agg: state.settings.agg,
    });
  }, [
    prepared.rows,
    dateCol,
    measureCol,
    state.settings.grain,
    state.settings.horizon,
    state.settings.model,
    state.settings.confidenceLevel,
    state.settings.agg,
  ]);

  const moneyOpt = useMemo(
    () => ({ format: state.settings.format, currency: state.settings.currency }),
    [state.settings.format, state.settings.currency],
  );
  const baseName = dataset.fileName.replace(/\.[^.]+$/, '');

  // Configuración de ECharts para el gráfico combinado de pronóstico
  const chartOption = useMemo(() => {
    if (!summary || summary.totalHistoricalPeriods === 0) return {};
    const histLabels = summary.historical.map((h) => h.label);
    const forecastLabels = summary.forecast.map((f) => f.label);
    const allLabels = [...histLabels, ...forecastLabels];

    const histData = [
      ...summary.historical.map((h) => h.actual),
      ...new Array(summary.forecast.length).fill(null),
    ];

    // Para continuidad visual, el pronóstico arranca en el último punto real
    const lastHistVal = summary.historical[summary.historical.length - 1]?.actual ?? null;
    const forecastData = [
      ...new Array(Math.max(0, summary.historical.length - 1)).fill(null),
      lastHistVal,
      ...summary.forecast.map((f) => f.forecast),
    ];

    const lowerBoundData = [
      ...new Array(Math.max(0, summary.historical.length - 1)).fill(null),
      lastHistVal,
      ...summary.forecast.map((f) => f.lowerBound),
    ];

    const upperBoundData = [
      ...new Array(Math.max(0, summary.historical.length - 1)).fill(null),
      lastHistVal,
      ...summary.forecast.map((f) => f.upperBound),
    ];

    return {
      tooltip: {
        trigger: 'axis',
        formatter: (params: any[]) => {
          const p = params[0];
          if (!p) return '';
          const name = p.name;
          const idx = p.dataIndex;
          const isFuture = idx >= summary.historical.length;

          if (!isFuture) {
            const actualVal = summary.historical[idx]?.actual;
            return `
              <div class="text-xs space-y-1">
                <strong>${name} (Histórico)</strong><br/>
                Real: <span class="font-semibold text-primary">${formatMetric(actualVal ?? null, moneyOpt)}</span>
              </div>
            `;
          }

          const fIdx = idx - summary.historical.length;
          const fPoint = summary.forecast[fIdx];
          if (!fPoint) return '';

          return `
            <div class="text-xs space-y-1">
              <strong>${name} (Proyección)</strong><br/>
              Pronóstico: <span class="font-bold text-emerald-600 dark:text-emerald-400">${formatMetric(fPoint.forecast, moneyOpt)}</span><br/>
              Banda ${summary.confidenceLevel}%: [${formatMetric(fPoint.lowerBound, moneyOpt)} — ${formatMetric(fPoint.upperBound, moneyOpt)}]<br/>
              Tendencia: ${formatMetric(fPoint.trendComponent, moneyOpt)} · Estacionalidad: ${formatMetric(fPoint.seasonalComponent, moneyOpt)}
            </div>
          `;
        },
      },
      legend: {
        data: ['Histórico Real', 'Pronóstico', `Intervalo de Confianza (${summary.confidenceLevel}%)`],
        top: '2%',
      },
      grid: { left: '3%', right: '4%', bottom: '10%', top: '15%', containLabel: true },
      xAxis: {
        type: 'category',
        data: allLabels,
        axisLabel: { rotate: allLabels.length > 12 ? 35 : 0 },
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          formatter: (val: number) => formatMetric(val, { ...moneyOpt, compact: true }),
        },
      },
      series: [
        {
          name: 'Histórico Real',
          type: 'line',
          data: histData,
          symbolSize: 6,
          lineStyle: { width: 2.5, color: '#3b82f6' },
          itemStyle: { color: '#3b82f6' },
          markLine: {
            symbol: 'none',
            data: [
              {
                xAxis: summary.historical[summary.historical.length - 1]?.label ?? '',
                label: { formatter: 'Hoy / Inicio Pronóstico', position: 'insideEndTop' },
                lineStyle: { color: '#10b981', type: 'dashed', width: 2 },
              },
            ],
          },
        },
        {
          name: 'Pronóstico',
          type: 'line',
          data: forecastData,
          symbolSize: 6,
          lineStyle: { width: 3, type: 'dashed', color: '#10b981' },
          itemStyle: { color: '#10b981' },
        },
        {
          name: `Intervalo de Confianza (${summary.confidenceLevel}%)`,
          type: 'line',
          data: lowerBoundData,
          lineStyle: { opacity: 0 },
          stack: 'confidence-band',
          symbol: 'none',
        },
        {
          name: `Intervalo de Confianza (${summary.confidenceLevel}%)`,
          type: 'line',
          data: upperBoundData.map((up, i) => (up !== null && lowerBoundData[i] !== null ? up - lowerBoundData[i] : null)),
          lineStyle: { opacity: 0 },
          areaStyle: { color: '#10b981', opacity: 0.15 },
          stack: 'confidence-band',
          symbol: 'none',
        },
      ],
    };
  }, [summary, moneyOpt]);

  if (!dateCol || !measureCol || !summary) {
    return (
      <Alert role="status">
        <TriangleAlert className="size-4" />
        <AlertTitle>Faltan columnas</AlertTitle>
        <AlertDescription>
          Vuelve a la configuración y selecciona la columna de fecha y la métrica a proyectar.
        </AlertDescription>
      </Alert>
    );
  }

  if (summary.totalHistoricalPeriods === 0) {
    return (
      <Alert role="status">
        <TriangleAlert className="size-4" />
        <AlertTitle>Sin datos suficientes</AlertTitle>
        <AlertDescription>
          No se encontraron suficientes registros temporales válidos para entrenar el modelo de pronóstico.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {/* Botonera y Selectores Rápidos */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="gap-1 px-2.5 py-1 text-xs">
            <Sparkles className="size-3.5 text-primary" />
            {summary.modelUsed}
          </Badge>
          <Badge
            variant={
              summary.metrics.accuracyRating === 'Excelente'
                ? 'default'
                : summary.metrics.accuracyRating === 'Bueno'
                  ? 'secondary'
                  : 'outline'
            }
            className="text-xs"
          >
            MAPE {summary.metrics.mape.toFixed(1)}% · {summary.metrics.accuracyRating}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => {
              const url = chartRef.current?.toPngDataUrl();
              if (url) downloadDataUrl(`${baseName}-pronostico.png`, url);
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
                `${baseName}-pronostico.csv`,
                forecastToCsv(summary),
                'text/csv;charset=utf-8',
              )
            }
          >
            <Download className="size-4" />
            CSV
          </Button>
        </div>
      </div>

      {/* Tarjeta de Síntesis y Conclusiones del Pronóstico */}
      <Card className="border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-950/20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-600 text-white">
                <TrendingUp className="size-4" />
              </div>
              <div>
                <CardTitle className="text-base text-foreground">
                  Proyección a {summary.horizon} períodos ({state.settings.grain})
                </CardTitle>
                <CardDescription className="text-xs">
                  Estimación con intervalo de confianza al {summary.confidenceLevel}%
                </CardDescription>
              </div>
            </div>
            {summary.projectedGrowthPercent !== null && (
              <Badge
                variant={
                  summary.projectedGrowthPercent > 0
                    ? 'default'
                    : summary.projectedGrowthPercent < 0
                      ? 'destructive'
                      : 'secondary'
                }
                className="gap-1 text-xs"
              >
                {summary.projectedGrowthPercent > 0 && <ArrowUpRight className="size-3.5" />}
                {summary.projectedGrowthPercent < 0 && <ArrowDownRight className="size-3.5" />}
                {summary.projectedGrowthPercent === 0 && <Minus className="size-3.5" />}
                {summary.projectedGrowthPercent >= 0 ? '+' : ''}
                {summary.projectedGrowthPercent.toFixed(1)}% vs anterior
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <ul className="grid gap-2 sm:grid-cols-2">
            {summary.insights.map((ins, idx) => (
              <li
                key={idx}
                className="flex items-start gap-2 rounded-md bg-card p-2.5 text-xs text-foreground shadow-2xs"
              >
                <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span>{ins}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KpiTile
          label="Volumen proyectado"
          value={formatMetric(summary.totalForecastVolume, moneyOpt)}
          hint={`Total próximos ${summary.horizon} períodos`}
          tone="good"
        />
        <KpiTile
          label="Crecimiento estimado"
          value={
            summary.projectedGrowthPercent !== null
              ? `${summary.projectedGrowthPercent >= 0 ? '+' : ''}${summary.projectedGrowthPercent.toFixed(1)}%`
              : 'N/D'
          }
          hint="Frente a ventana previa"
          tone={
            summary.projectedGrowthPercent && summary.projectedGrowthPercent > 0
              ? 'good'
              : summary.projectedGrowthPercent && summary.projectedGrowthPercent < 0
                ? 'warn'
                : 'neutral'
          }
        />
        <KpiTile
          label="Precisión (MAPE)"
          value={`${summary.metrics.mape.toFixed(1)}%`}
          hint={`Calificación: ${summary.metrics.accuracyRating}`}
          tone={summary.metrics.mape <= 15 ? 'good' : 'warn'}
        />
        <KpiTile
          label="Ajuste del modelo (R²)"
          value={summary.metrics.r2.toFixed(2)}
          hint="Bondad de ajuste (0 a 1)"
        />
        <KpiTile
          label="Error típico (RMSE)"
          value={formatMetric(summary.metrics.rmse, moneyOpt)}
          hint={`MAE: ${formatMetric(summary.metrics.mae, moneyOpt)}`}
        />
        <KpiTile
          label="Entrenamiento"
          value={`${summary.totalHistoricalPeriods} períodos`}
          hint={`Validación en ${summary.metrics.testPeriodsCount} períodos`}
        />
      </div>

      {/* Gráfico de Pronóstico Interactivo */}
      <Card size="sm">
        <CardHeader>
          <CardTitle>Evolución histórica y proyección futura</CardTitle>
          <CardDescription className="text-xs">
            Línea azul sólida (datos reales), línea verde discontinua (pronóstico) y banda sombreada de confianza ({summary.confidenceLevel}%)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EChart
            ref={chartRef}
            option={chartOption}
            ariaLabel="Gráfico de pronóstico temporal"
            className="h-80 w-full sm:h-96"
          />
        </CardContent>
      </Card>

      {/* Tablas Detalladas y Métricas de Validación */}
      <Card size="sm">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle>Tablas de datos y validación</CardTitle>
              <CardDescription className="text-xs">
                Inspecciona los valores proyectados con sus bandas de confianza o el ajuste histórico
              </CardDescription>
            </div>
            <div className="flex items-center gap-1 rounded-lg border bg-muted/40 p-1">
              <button
                type="button"
                onClick={() => setActiveTab('forecast')}
                className={cn(
                  'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                  activeTab === 'forecast' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                Proyección futura ({summary.forecast.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('historical')}
                className={cn(
                  'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                  activeTab === 'historical' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                Histórico y ajuste ({summary.historical.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('metrics')}
                className={cn(
                  'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                  activeTab === 'metrics' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                Backtesting y métricas
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {activeTab === 'forecast' && (
            <div className="max-h-72 overflow-auto rounded-md border">
              <table className="w-full border-collapse text-sm">
                <thead className="sticky top-0 bg-card">
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="px-3 py-2 text-left font-medium">Período</th>
                    <th className="px-3 py-2 text-right font-medium">Pronóstico</th>
                    <th className="px-3 py-2 text-right font-medium">Límite inferior ({summary.confidenceLevel}%)</th>
                    <th className="px-3 py-2 text-right font-medium">Límite superior ({summary.confidenceLevel}%)</th>
                    <th className="px-3 py-2 text-right font-medium">Tendencia</th>
                    <th className="px-3 py-2 text-right font-medium">Estacionalidad</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.forecast.map((f, i) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-muted/40 text-xs">
                      <td className="px-3 py-1.5 font-medium">{f.label}</td>
                      <td className="px-3 py-1.5 text-right font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                        {formatMetric(f.forecast, moneyOpt)}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                        {formatMetric(f.lowerBound, moneyOpt)}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                        {formatMetric(f.upperBound, moneyOpt)}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums">
                        {formatMetric(f.trendComponent, moneyOpt)}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums">
                        {formatMetric(f.seasonalComponent, moneyOpt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'historical' && (
            <div className="max-h-72 overflow-auto rounded-md border">
              <table className="w-full border-collapse text-sm">
                <thead className="sticky top-0 bg-card">
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="px-3 py-2 text-left font-medium">Período</th>
                    <th className="px-3 py-2 text-right font-medium">Valor real</th>
                    <th className="px-3 py-2 text-right font-medium">Valor ajustado (Fit)</th>
                    <th className="px-3 py-2 text-right font-medium">Residuo (Error)</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.historical.map((h, i) => {
                    const resVal = h.actual - h.fitted;
                    return (
                      <tr key={i} className="border-b last:border-0 hover:bg-muted/40 text-xs">
                        <td className="px-3 py-1.5 font-medium">{h.label}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums font-semibold">
                          {formatMetric(h.actual, moneyOpt)}
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                          {formatMetric(h.fitted, moneyOpt)}
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums font-mono">
                          {resVal >= 0 ? `+${formatMetric(resVal, moneyOpt)}` : formatMetric(resVal, moneyOpt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'metrics' && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 p-2">
              <div className="rounded-lg border p-3 bg-muted/20">
                <p className="text-xs text-muted-foreground">MAPE (Mean Absolute % Error)</p>
                <p className="text-xl font-bold tabular-nums text-foreground mt-1">
                  {summary.metrics.mape.toFixed(2)}%
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Desviación porcentual media del modelo
                </p>
              </div>
              <div className="rounded-lg border p-3 bg-muted/20">
                <p className="text-xs text-muted-foreground">RMSE (Root Mean Square Error)</p>
                <p className="text-xl font-bold tabular-nums text-foreground mt-1">
                  {formatMetric(summary.metrics.rmse, moneyOpt)}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Penaliza fuertemente grandes desviaciones
                </p>
              </div>
              <div className="rounded-lg border p-3 bg-muted/20">
                <p className="text-xs text-muted-foreground">MAE (Mean Absolute Error)</p>
                <p className="text-xl font-bold tabular-nums text-foreground mt-1">
                  {formatMetric(summary.metrics.mae, moneyOpt)}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Magnitud media absoluta de los errores
                </p>
              </div>
              <div className="rounded-lg border p-3 bg-muted/20">
                <p className="text-xs text-muted-foreground">R² (Coeficiente de determinación)</p>
                <p className="text-xl font-bold tabular-nums text-foreground mt-1">
                  {summary.metrics.r2.toFixed(3)}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Proporción de varianza explicada por el modelo
                </p>
              </div>
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
