import { useMemo, useRef, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  Download,
  ImageDown,
  ShieldAlert,
  ShieldCheck,
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
import { spcToCsv } from '../lib/export-spc-csv';
import { computeSpc } from '../lib/spc';
import type { SpcConfigState } from '../use-spc-config';

export function SpcDashboard({
  dataset,
  mapping,
  state,
}: {
  dataset: ParsedDataset;
  mapping: ColumnMappingState;
  state: SpcConfigState;
}) {
  const chartRef = useRef<EChartHandle>(null);
  const [activeTab, setActiveTab] = useState<'violations' | 'points' | 'limits'>('violations');

  const { assignments } = state.slots;
  const measureCol = assignments.metrica;
  const orderCol = assignments.orden ?? null;

  const prepared = useMemo(
    () => prepareRows(dataset.rows, mapping.columns, { dateColumn: orderCol }, mapping.preserveInvalid),
    [dataset.rows, mapping.columns, mapping.preserveInvalid, orderCol],
  );

  const summary = useMemo(() => {
    if (!measureCol) return null;
    return computeSpc(prepared.rows as any, {
      measureCol,
      orderCol,
      sigmaMethod: state.settings.sigmaMethod,
      targetMean: state.settings.targetMean,
      targetSigma: state.settings.targetSigma,
    });
  }, [
    prepared.rows,
    measureCol,
    orderCol,
    state.settings.sigmaMethod,
    state.settings.targetMean,
    state.settings.targetSigma,
  ]);

  const numOpt = useMemo(
    () => ({ format: state.settings.format, currency: state.settings.currency }),
    [state.settings.format, state.settings.currency],
  );
  const baseName = dataset.fileName.replace(/\.[^.]+$/, '');

  // Configuración de ECharts para la gráfica de control Shewhart I-Chart
  const chartOption = useMemo(() => {
    if (!summary || summary.validPoints === 0) return {};
    const labels = summary.points.map((p) => p.label);
    const dataVals = summary.points.map((p) => p.value);

    // Puntos anómalos o con violaciones marcados en rojo
    const pointColors = summary.points.map((p) => (p.isInControl ? '#3b82f6' : '#ef4444'));

    return {
      tooltip: {
        trigger: 'axis',
        formatter: (params: any[]) => {
          const p = params[0];
          const pt = summary.points[p?.dataIndex ?? 0];
          if (!pt) return '';

          const violationText =
            pt.violations.length > 0
              ? pt.violations.map((v) => `<li class="text-red-500 font-medium">Regla ${v.ruleNumber}: ${v.ruleName}</li>`).join('')
              : '<span class="text-emerald-500 font-medium">En control estadístico</span>';

          return `
            <div class="text-xs space-y-1">
              <strong>${pt.label} (Muestra #${pt.index})</strong><br/>
              Valor: <strong>${formatMetric(pt.value, numOpt)}</strong><br/>
              Z-Score: <span class="font-mono">${pt.zScore > 0 ? '+' : ''}${pt.zScore}σ</span><br/>
              ${pt.movingRange !== null ? `Rango Móvil: ${formatMetric(pt.movingRange, numOpt)}<br/>` : ''}
              <div class="border-t pt-1 mt-1">
                <strong>Estado:</strong>
                <ul class="list-disc pl-3 mt-0.5">${violationText}</ul>
              </div>
            </div>
          `;
        },
      },
      grid: { left: '4%', right: '8%', bottom: '10%', top: '12%', containLabel: true },
      xAxis: {
        type: 'category',
        data: labels,
        axisLabel: { rotate: labels.length > 15 ? 35 : 0 },
      },
      yAxis: {
        type: 'value',
        scale: true,
        axisLabel: {
          formatter: (val: number) => formatMetric(val, { ...numOpt, compact: true }),
        },
      },
      series: [
        {
          name: 'Valor Medido',
          type: 'line',
          data: dataVals,
          symbolSize: (_val: number, params: any) => {
            const pt = summary.points[params.dataIndex];
            return pt?.isInControl ? 6 : 10;
          },
          itemStyle: {
            color: (params: any) => pointColors[params.dataIndex],
          },
          lineStyle: { width: 2, color: '#3b82f6' },
          markLine: {
            symbol: 'none',
            data: [
              {
                yAxis: summary.ucl,
                name: 'UCL (+3σ)',
                lineStyle: { color: '#ef4444', width: 2, type: 'solid' },
                label: { formatter: `UCL (+3σ): ${formatMetric(summary.ucl, numOpt)}`, position: 'insideEndTop' },
              },
              {
                yAxis: summary.sigma2Plus,
                name: '+2σ',
                lineStyle: { color: '#f59e0b', width: 1, type: 'dashed' },
                label: { formatter: `+2σ: ${formatMetric(summary.sigma2Plus, numOpt)}`, position: 'insideEndTop' },
              },
              {
                yAxis: summary.sigma1Plus,
                name: '+1σ',
                lineStyle: { color: '#10b981', width: 1, type: 'dotted' },
                label: { formatter: `+1σ: ${formatMetric(summary.sigma1Plus, numOpt)}`, position: 'insideEndTop' },
              },
              {
                yAxis: summary.mean,
                name: 'CL (Media)',
                lineStyle: { color: '#2563eb', width: 2, type: 'solid' },
                label: { formatter: `Media: ${formatMetric(summary.mean, numOpt)}`, position: 'insideEndTop' },
              },
              {
                yAxis: summary.sigma1Minus,
                name: '-1σ',
                lineStyle: { color: '#10b981', width: 1, type: 'dotted' },
                label: { formatter: `-1σ: ${formatMetric(summary.sigma1Minus, numOpt)}`, position: 'insideEndBottom' },
              },
              {
                yAxis: summary.sigma2Minus,
                name: '-2σ',
                lineStyle: { color: '#f59e0b', width: 1, type: 'dashed' },
                label: { formatter: `-2σ: ${formatMetric(summary.sigma2Minus, numOpt)}`, position: 'insideEndBottom' },
              },
              {
                yAxis: summary.lcl,
                name: 'LCL (-3σ)',
                lineStyle: { color: '#ef4444', width: 2, type: 'solid' },
                label: { formatter: `LCL (-3σ): ${formatMetric(summary.lcl, numOpt)}`, position: 'insideEndBottom' },
              },
            ],
          },
          markArea: {
            silent: true,
            data: [
              [
                { yAxis: summary.sigma1Minus, itemStyle: { color: '#10b981', opacity: 0.06 } },
                { yAxis: summary.sigma1Plus },
              ],
              [
                { yAxis: summary.sigma2Minus, itemStyle: { color: '#f59e0b', opacity: 0.05 } },
                { yAxis: summary.sigma1Minus },
              ],
              [
                { yAxis: summary.sigma1Plus, itemStyle: { color: '#f59e0b', opacity: 0.05 } },
                { yAxis: summary.sigma2Plus },
              ],
              [
                { yAxis: summary.lcl, itemStyle: { color: '#ef4444', opacity: 0.05 } },
                { yAxis: summary.sigma2Minus },
              ],
              [
                { yAxis: summary.sigma2Plus, itemStyle: { color: '#ef4444', opacity: 0.05 } },
                { yAxis: summary.ucl },
              ],
            ],
          },
        },
      ],
    };
  }, [summary, numOpt]);

  if (!measureCol || !summary) {
    return (
      <Alert role="status">
        <TriangleAlert className="size-4" />
        <AlertTitle>Falta la métrica de control</AlertTitle>
        <AlertDescription>
          Vuelve a la configuración y selecciona la variable numérica que deseas monitorear.
        </AlertDescription>
      </Alert>
    );
  }

  if (summary.validPoints === 0) {
    return (
      <Alert role="status">
        <TriangleAlert className="size-4" />
        <AlertTitle>Sin datos numéricos válidos</AlertTitle>
        <AlertDescription>
          No se encontraron datos numéricos para calcular los límites de control de Shewhart.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {/* Barra de Estado y Exportación */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {summary.isProcessInControl ? (
            <Badge className="bg-emerald-600 text-white gap-1 px-2.5 py-1 text-xs">
              <ShieldCheck className="size-3.5" />
              Proceso en Control Estadístico (100%)
            </Badge>
          ) : (
            <Badge variant="destructive" className="gap-1 px-2.5 py-1 text-xs">
              <ShieldAlert className="size-3.5" />
              Proceso Fuera de Control ({summary.violationsCount} causas especiales)
            </Badge>
          )}
          <span className="text-xs text-muted-foreground">
            {formatCount(summary.validPoints)} puntos monitoreados
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => {
              const url = chartRef.current?.toPngDataUrl();
              if (url) downloadDataUrl(`${baseName}-control-spc.png`, url);
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
                `${baseName}-control-spc.csv`,
                spcToCsv(summary),
                'text/csv;charset=utf-8',
              )
            }
          >
            <Download className="size-4" />
            CSV
          </Button>
        </div>
      </div>

      {/* Tarjeta de Diagnóstico SPC */}
      <Card
        className={cn(
          'border',
          summary.isProcessInControl
            ? 'border-emerald-500/20 bg-emerald-500/5'
            : 'border-red-500/20 bg-red-500/5',
        )}
      >
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                'flex size-8 items-center justify-center rounded-lg text-white',
                summary.isProcessInControl ? 'bg-emerald-600' : 'bg-red-600',
              )}
            >
              <Activity className="size-4" />
            </div>
            <div>
              <CardTitle className="text-base">
                {summary.isProcessInControl
                  ? 'Estabilidad del proceso verificada'
                  : 'Atención: Patrones fuera de control estadístico detectados'}
              </CardTitle>
              <CardDescription className="text-xs">
                Evaluación automatizada bajo Reglas de Western Electric y Nelson
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
                <CheckCircle2
                  className={cn(
                    'mt-0.5 size-3.5 shrink-0',
                    summary.isProcessInControl ? 'text-emerald-600' : 'text-red-500',
                  )}
                />
                <span>{ins}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KpiTile
          label="Línea central (Media)"
          value={formatMetric(summary.mean, numOpt)}
          hint="Centro del proceso (CL)"
        />
        <KpiTile
          label="Desviación sigma (σ)"
          value={formatMetric(summary.sigma, numOpt)}
          hint={state.settings.sigmaMethod === 'moving-range' ? 'Estimada por MR/d₂' : 'Desv. estándar s'}
        />
        <KpiTile
          label="Límite superior (UCL)"
          value={formatMetric(summary.ucl, numOpt)}
          hint="+3σ sobre la media"
          tone="warn"
        />
        <KpiTile
          label="Límite inferior (LCL)"
          value={formatMetric(summary.lcl, numOpt)}
          hint="-3σ bajo la media"
          tone="warn"
        />
        <KpiTile
          label="% En control"
          value={`${summary.pointsInControlPercent.toFixed(1)}%`}
          hint={`${formatCount(summary.pointsInControlCount)} de ${formatCount(summary.validPoints)} puntos`}
          tone={summary.isProcessInControl ? 'good' : 'warn'}
        />
        <KpiTile
          label="Violaciones a reglas"
          value={formatCount(summary.violationsCount)}
          hint="Causas especiales detectadas"
          tone={summary.violationsCount === 0 ? 'good' : 'warn'}
        />
      </div>

      {/* Gráfica de Control Shewhart */}
      <Card size="sm">
        <CardHeader>
          <CardTitle>Gráfica de control Shewhart (I-Chart)</CardTitle>
          <CardDescription className="text-xs">
            Zona C (Verde ±1σ), Zona B (Amarillo ±2σ), Zona A (Rojo claro ±3σ). Puntos rojos = Violación de regla.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EChart
            ref={chartRef}
            option={chartOption}
            ariaLabel="Gráfica de control de proceso Shewhart SPC"
            className="h-80 w-full sm:h-96"
          />
        </CardContent>
      </Card>

      {/* Tablas Detalladas y Registro de Violaciones */}
      <Card size="sm">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle>Registro y datos de control</CardTitle>
              <CardDescription className="text-xs">
                Audita cada muestra y consulta los diagnósticos de causas especiales
              </CardDescription>
            </div>
            <div className="flex items-center gap-1 rounded-lg border bg-muted/40 p-1">
              <button
                type="button"
                onClick={() => setActiveTab('violations')}
                className={cn(
                  'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                  activeTab === 'violations' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                Violaciones ({summary.violationLog.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('points')}
                className={cn(
                  'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                  activeTab === 'points' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                Todas las muestras ({summary.points.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('limits')}
                className={cn(
                  'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                  activeTab === 'limits' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                Límites y zonas
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {activeTab === 'violations' && (
            <div className="max-h-72 overflow-auto rounded-md border">
              {summary.violationLog.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  <CheckCircle2 className="mx-auto size-8 text-emerald-500 mb-1" />
                  No se detectaron violaciones ni causas especiales. El proceso se encuentra en control.
                </div>
              ) : (
                <table className="w-full border-collapse text-sm">
                  <thead className="sticky top-0 bg-card">
                    <tr className="border-b text-xs text-muted-foreground">
                      <th className="px-3 py-2 text-left font-medium">Muestra</th>
                      <th className="px-3 py-2 text-right font-medium">Valor</th>
                      <th className="px-3 py-2 text-left font-medium">Regla</th>
                      <th className="px-3 py-2 text-left font-medium">Severidad</th>
                      <th className="px-3 py-2 text-left font-medium">Diagnóstico</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.violationLog.map((log, i) => (
                      <tr key={i} className="border-b last:border-0 hover:bg-muted/40 text-xs">
                        <td className="px-3 py-1.5 font-medium">{log.pointLabel}</td>
                        <td className="px-3 py-1.5 text-right font-bold text-red-500 tabular-nums">
                          {formatMetric(log.value, numOpt)}
                        </td>
                        <td className="px-3 py-1.5 font-semibold">
                          Regla #{log.rule.ruleNumber}: {log.rule.ruleName}
                        </td>
                        <td className="px-3 py-1.5">
                          <Badge
                            variant={log.rule.severity === 'critico' ? 'destructive' : 'secondary'}
                            className="text-xs capitalize"
                          >
                            {log.rule.severity}
                          </Badge>
                        </td>
                        <td className="px-3 py-1.5 text-muted-foreground">{log.rule.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {activeTab === 'points' && (
            <div className="max-h-72 overflow-auto rounded-md border">
              <table className="w-full border-collapse text-sm">
                <thead className="sticky top-0 bg-card">
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="px-3 py-2 text-left font-medium">#</th>
                    <th className="px-3 py-2 text-left font-medium">Identificador</th>
                    <th className="px-3 py-2 text-right font-medium">Valor</th>
                    <th className="px-3 py-2 text-right font-medium">Rango Móvil</th>
                    <th className="px-3 py-2 text-right font-medium">Z-Score</th>
                    <th className="px-3 py-2 text-center font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.points.map((p) => (
                    <tr key={p.index} className="border-b last:border-0 hover:bg-muted/40 text-xs">
                      <td className="px-3 py-1.5 font-mono text-muted-foreground">{p.index}</td>
                      <td className="px-3 py-1.5 font-medium">{p.label}</td>
                      <td className="px-3 py-1.5 text-right font-semibold tabular-nums">
                        {formatMetric(p.value, numOpt)}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                        {p.movingRange !== null ? formatMetric(p.movingRange, numOpt) : '—'}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono tabular-nums">
                        {p.zScore > 0 ? `+${p.zScore.toFixed(2)}` : p.zScore.toFixed(2)}σ
                      </td>
                      <td className="px-3 py-1.5 text-center">
                        <Badge
                          variant={p.isInControl ? 'outline' : 'destructive'}
                          className="text-xs"
                        >
                          {p.isInControl ? 'En Control' : 'Violación'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'limits' && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 p-2 text-xs">
              <div className="rounded-lg border p-2.5 bg-red-500/5 border-red-500/20">
                <span className="font-semibold text-red-600 block">UCL (Límite Superior +3σ)</span>
                <span className="text-base font-bold tabular-nums text-foreground mt-0.5 block">
                  {formatMetric(summary.ucl, numOpt)}
                </span>
                <span className="text-muted-foreground text-[0.7rem]">Media + 3σ</span>
              </div>
              <div className="rounded-lg border p-2.5 bg-amber-500/5 border-amber-500/20">
                <span className="font-semibold text-amber-600 block">Zona A Superior (+2σ)</span>
                <span className="text-base font-bold tabular-nums text-foreground mt-0.5 block">
                  {formatMetric(summary.sigma2Plus, numOpt)}
                </span>
                <span className="text-muted-foreground text-[0.7rem]">Media + 2σ</span>
              </div>
              <div className="rounded-lg border p-2.5 bg-emerald-500/5 border-emerald-500/20">
                <span className="font-semibold text-emerald-600 block">Línea Central CL (Media)</span>
                <span className="text-base font-bold tabular-nums text-foreground mt-0.5 block">
                  {formatMetric(summary.mean, numOpt)}
                </span>
                <span className="text-muted-foreground text-[0.7rem]">Media del proceso</span>
              </div>
              <div className="rounded-lg border p-2.5 bg-red-500/5 border-red-500/20">
                <span className="font-semibold text-red-600 block">LCL (Límite Inferior -3σ)</span>
                <span className="text-base font-bold tabular-nums text-foreground mt-0.5 block">
                  {formatMetric(summary.lcl, numOpt)}
                </span>
                <span className="text-muted-foreground text-[0.7rem]">Media - 3σ</span>
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
