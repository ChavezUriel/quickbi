import { useMemo, useRef } from 'react';
import {
  AlertTriangle,
  Download,
  Filter,
  ImageDown,
  MoveDown,
  MoveUp,
  RotateCcw,
} from 'lucide-react';
import { EChart, type EChartHandle } from '@/components/echart';
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
import { downloadDataUrl, downloadTextFile } from '@/lib/download';
import { cn } from '@/lib/utils';
import { formatCount, formatMetric } from '@/features/analysis/lib/format';
import { prepareRows } from '@/features/analysis/lib/prepare-rows';
import type { ParsedDataset } from '@/features/dataset/types';
import type { ColumnMappingState } from '@/features/mapping/use-column-mapping';
import { funnelToCsv } from '../lib/export-funnel-csv';
import { computeFunnel, type FunnelResult } from '../lib/funnel';
import type { FunnelConfigState } from '../use-funnel-config';

export function FunnelDashboard({
  dataset,
  mapping,
  state,
}: {
  dataset: ParsedDataset;
  mapping: ColumnMappingState;
  state: FunnelConfigState;
}) {
  const chartRef = useRef<EChartHandle>(null);
  const { assignments } = state.slots;
  const stageDim = assignments.etapa ?? null;
  const valueColumn = assignments.valor ?? null;
  const idDim = assignments.id ?? null;
  const { aggregation, currency, customOrder } = state.settings;

  const prepared = useMemo(
    () => prepareRows(dataset.rows, mapping.columns, { dateColumn: null }, mapping.preserveInvalid),
    [dataset.rows, mapping.columns, mapping.preserveInvalid],
  );

  const result: FunnelResult | null = useMemo(() => {
    if (stageDim === null) return null;
    return computeFunnel(prepared.rows, {
      stageDim,
      valueColumn,
      idDim,
      aggregation,
      customOrder,
    });
  }, [prepared.rows, stageDim, valueColumn, idDim, aggregation, customOrder]);

  const stages = useMemo(() => result?.stages ?? [], [result]);
  const summary = result?.summary;
  const empty = stages.length === 0;

  // Acciones de reordenación de etapas
  const moveStage = (index: number, direction: 'up' | 'down') => {
    const currentOrder = stages.map((s) => s.stage);
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= currentOrder.length) return;

    const newOrder = [...currentOrder];
    const temp = newOrder[index]!;
    newOrder[index] = newOrder[targetIndex]!;
    newOrder[targetIndex] = temp;

    state.update({ customOrder: newOrder });
  };

  const resetOrder = () => {
    state.update({ customOrder: [] });
  };

  // Opción de ECharts para el embudo visual
  const chartOption = useMemo(() => {
    if (empty) return {};

    const data = stages.map((st) => ({
      value: st.volume,
      name: st.stage,
      itemStyle: {
        color: st.isBottleneck ? '#ef4444' : undefined,
      },
    }));

    return {
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => {
          const st = stages.find((s) => s.stage === params.name);
          if (!st) return `${params.name}: ${params.value}`;
          return `
            <div class="font-sans text-xs">
              <div class="font-bold border-b pb-1 mb-1">${st.stage}</div>
              <div>Volumen: <b>${formatCount(st.volume)}</b></div>
              <div>% sobre inicio: <b>${st.conversionFromTop} %</b></div>
              <div>Retención de paso: <b>${st.stepConversionRate} %</b></div>
              ${st.order > 0 ? `<div>Caída: <b>-${formatCount(st.dropOff)} (${st.dropOffRate} %)</b></div>` : ''}
              ${st.isBottleneck ? `<div class="text-red-500 font-bold mt-1">⚠️ Mayor cuello de botella</div>` : ''}
            </div>
          `;
        },
      },
      series: [
        {
          name: 'Embudo de conversión',
          type: 'funnel',
          left: '10%',
          top: 20,
          bottom: 20,
          width: '80%',
          minSize: '5%',
          maxSize: '100%',
          sort: 'none',
          gap: 4,
          label: {
            show: true,
            position: 'inside',
            formatter: '{b}\n{c}',
            fontSize: 12,
            fontWeight: 500,
          },
          labelLine: {
            show: false,
          },
          itemStyle: {
            borderColor: '#fff',
            borderWidth: 1,
          },
          data,
        },
      ],
    };
  }, [stages, empty]);

  if (empty || summary == null) {
    return (
      <Alert role="status">
        <AlertTriangle className="size-4" />
        <AlertTitle>Sin datos suficientes para el embudo</AlertTitle>
        <AlertDescription>
          Selecciona una columna de etapas válida en la configuración para calcular el embudo.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Botones de acción y toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1.5 py-1">
            <Filter className="size-3.5 text-primary" />
            <span>{stages.length} etapas</span>
          </Badge>
          {customOrder.length > 0 && (
            <Button variant="ghost" size="sm" onClick={resetOrder} className="h-7 text-xs">
              <RotateCcw className="mr-1 size-3" />
              Restablecer orden
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => {
              const dataUrl = chartRef.current?.toPngDataUrl();
              if (dataUrl) downloadDataUrl('embudo-conversion.png', dataUrl);
            }}
          >
            <ImageDown className="size-3.5" />
            PNG
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => {
              if (result) {
                downloadTextFile(
                  'embudo-conversion.csv',
                  funnelToCsv(result),
                  'text/csv;charset=utf-8',
                );
              }
            }}
          >
            <Download className="size-3.5" />
            CSV
          </Button>
        </div>
      </div>

      {/* Tarjetas de Resumen KPI */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Card size="sm">
          <CardHeader>
            <CardDescription>Entrada (Top of Funnel)</CardDescription>
            <CardTitle className="text-xl">
              {aggregation === 'sum'
                ? formatMetric(summary.topVolume, { format: 'moneda', currency })
                : formatCount(summary.topVolume)}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardDescription>Conversiones finales</CardDescription>
            <CardTitle className="text-xl text-emerald-600 dark:text-emerald-400">
              {aggregation === 'sum'
                ? formatMetric(summary.bottomVolume, { format: 'moneda', currency })
                : formatCount(summary.bottomVolume)}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardDescription>Conversión global</CardDescription>
            <CardTitle className="text-xl font-bold">
              {summary.overallConversionRate} %
            </CardTitle>
          </CardHeader>
        </Card>

        <Card size="sm" className={summary.bottleneckStage ? 'border-amber-500/30 bg-amber-500/5' : ''}>
          <CardHeader>
            <CardDescription>Mayor cuello de botella</CardDescription>
            <CardTitle className="truncate text-base font-semibold text-amber-600 dark:text-amber-400">
              {summary.bottleneckStage ?? 'Ninguno'}
            </CardTitle>
            {summary.bottleneckStage && (
              <p className="text-xs text-muted-foreground">
                Caída del {summary.maxDropOffRate} % (-{formatCount(summary.maxDropOffVolume)})
              </p>
            )}
          </CardHeader>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardDescription>Pérdida acumulada</CardDescription>
            <CardTitle className="text-xl text-muted-foreground">
              {aggregation === 'sum'
                ? formatMetric(summary.totalDropOff, { format: 'moneda', currency })
                : formatCount(summary.totalDropOff)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Gráfico y Pasos */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Gráfico de embudo */}
        <Card className="lg:col-span-7">
          <CardHeader>
            <CardTitle>Flujo del embudo</CardTitle>
            <CardDescription>
              Representación visual del volumen y pérdidas a lo largo del proceso.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80 w-full">
              <EChart
                ref={chartRef}
                option={chartOption}
                ariaLabel="Gráfico de embudo de conversión"
              />
            </div>
          </CardContent>
        </Card>

        {/* Flujo de pasos y retención */}
        <Card className="lg:col-span-5">
          <CardHeader>
            <CardTitle>Retención y caídas paso a paso</CardTitle>
            <CardDescription>
              Ordena las fases y observa el porcentaje retenido entre cada paso.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {stages.map((st, idx) => (
              <div
                key={st.stage}
                className={cn(
                  'rounded-lg border p-3 text-sm transition-colors',
                  st.isBottleneck
                    ? 'border-red-500/40 bg-red-500/5 dark:bg-red-950/20'
                    : 'bg-card',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                      {idx + 1}
                    </span>
                    <span className="font-medium">{st.stage}</span>
                    {st.isBottleneck && (
                      <Badge variant="destructive" className="h-4 text-[10px]">
                        Cuello de botella
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-6"
                      disabled={idx === 0}
                      onClick={() => moveStage(idx, 'up')}
                      title="Mover arriba"
                    >
                      <MoveUp className="size-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-6"
                      disabled={idx === stages.length - 1}
                      onClick={() => moveStage(idx, 'down')}
                      title="Mover abajo"
                    >
                      <MoveDown className="size-3" />
                    </Button>
                  </div>
                </div>

                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                  <div>
                    Volumen: <b className="text-foreground">{formatCount(st.volume)}</b> (
                    {st.conversionFromTop} % del total)
                  </div>
                  {idx > 0 && (
                    <div className={st.isBottleneck ? 'font-medium text-red-600 dark:text-red-400' : ''}>
                      Paso: <b>{st.stepConversionRate} %</b> (-{formatCount(st.dropOff)})
                    </div>
                  )}
                </div>

                {/* Barra de progreso visual */}
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-300',
                      st.isBottleneck ? 'bg-red-500' : 'bg-primary',
                    )}
                    style={{ width: `${Math.min(100, Math.max(2, st.conversionFromTop))}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Tabla detallada de etapas */}
      <Card>
        <CardHeader>
          <CardTitle>Métricas detalladas por etapa</CardTitle>
          <CardDescription>
            Desglose completo de volúmenes, retenciones y tasas de caída.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-muted/30 text-xs font-medium text-muted-foreground">
              <tr>
                <th className="py-2.5 pl-3 pr-2">#</th>
                <th className="px-3 py-2.5">Etapa</th>
                <th className="px-3 py-2.5 text-right">Volumen</th>
                <th className="px-3 py-2.5 text-right">% Sobre Inicio</th>
                <th className="px-3 py-2.5 text-right">Retención de Paso</th>
                <th className="px-3 py-2.5 text-right">Abandono / Pérdida</th>
                <th className="px-3 py-2.5 text-right">Tasa de Caída</th>
                <th className="py-2.5 pl-3 pr-4 text-center">Diagnóstico</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {stages.map((st) => (
                <tr
                  key={st.stage}
                  className={cn(
                    'hover:bg-muted/40 transition-colors',
                    st.isBottleneck && 'bg-red-500/5 font-medium',
                  )}
                >
                  <td className="py-2 pl-3 pr-2 text-muted-foreground">{st.order + 1}</td>
                  <td className="px-3 py-2 font-medium">{st.stage}</td>
                  <td className="px-3 py-2 text-right font-mono">
                    {aggregation === 'sum'
                      ? formatMetric(st.volume, { format: 'moneda', currency })
                      : formatCount(st.volume)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    <span className="inline-block rounded px-1.5 py-0.5 bg-primary/10 text-primary">
                      {st.conversionFromTop} %
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {st.order === 0 ? '—' : `${st.stepConversionRate} %`}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-muted-foreground">
                    {st.order === 0 ? '—' : `-${formatCount(st.dropOff)}`}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {st.order === 0 ? (
                      '—'
                    ) : (
                      <span
                        className={cn(
                          st.isBottleneck
                            ? 'font-bold text-red-600 dark:text-red-400'
                            : 'text-muted-foreground',
                        )}
                      >
                        {st.dropOffRate} %
                      </span>
                    )}
                  </td>
                  <td className="py-2 pl-3 pr-4 text-center">
                    {st.isBottleneck ? (
                      <Badge variant="destructive" className="text-[11px]">
                        Cuello de botella
                      </Badge>
                    ) : st.order === 0 ? (
                      <Badge variant="secondary" className="text-[11px]">
                        Inicio
                      </Badge>
                    ) : st.order === stages.length - 1 ? (
                      <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 text-[11px]">
                        Conversión
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">Normal</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
