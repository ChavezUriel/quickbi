import { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Download,
  ImageDown,
  Scale,
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
import { reconciliationToCsv } from '../lib/export-reconciliation-csv';
import {
  computeReconciliation,
  type ReconciliationResult,
  type ReconciliationStatus,
} from '../lib/reconciliation';
import type { ReconciliationConfigState } from '../use-reconciliation-config';

const STATUS_BADGE: Record<ReconciliationStatus, { label: string; className: string }> = {
  exacto: {
    label: 'Exacto',
    className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
  },
  discrepancia: {
    label: 'Descuadre',
    className: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 font-medium',
  },
  solo_a: {
    label: 'Solo en A',
    className: 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30',
  },
  solo_b: {
    label: 'Solo en B',
    className: 'bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30',
  },
};

export function ReconciliationDashboard({
  dataset,
  mapping,
  state,
}: {
  dataset: ParsedDataset;
  mapping: ColumnMappingState;
  state: ReconciliationConfigState;
}) {
  const chartRef = useRef<EChartHandle>(null);
  const [activeFilter, setActiveFilter] = useState<ReconciliationStatus | 'todos'>('todos');

  const { assignments } = state.slots;
  const keyDim = assignments.clave ?? null;
  const valueAColumn = assignments.valorA ?? null;
  const valueBColumn = assignments.valorB ?? null;
  const sourceDim = assignments.fuente ?? null;
  const { mode, sourceAValue, sourceBValue, tolerance, currency } = state.settings;

  const prepared = useMemo(
    () => prepareRows(dataset.rows, mapping.columns, { dateColumn: null }, mapping.preserveInvalid),
    [dataset.rows, mapping.columns, mapping.preserveInvalid],
  );

  const result: ReconciliationResult | null = useMemo(() => {
    if (keyDim === null || valueAColumn === null) return null;
    return computeReconciliation(prepared.rows, {
      keyDim,
      valueAColumn,
      valueBColumn: mode === 'dual_columns' ? valueBColumn : null,
      sourceDim: mode === 'source_dimension' ? sourceDim : null,
      sourceAValue,
      sourceBValue,
      tolerance,
    });
  }, [
    prepared.rows,
    keyDim,
    valueAColumn,
    valueBColumn,
    sourceDim,
    mode,
    sourceAValue,
    sourceBValue,
    tolerance,
  ]);

  const records = useMemo(() => result?.records ?? [], [result]);
  const summary = result?.summary;
  const empty = records.length === 0;

  // Filtrado por estado de conciliación
  const filteredRecords = useMemo(() => {
    if (activeFilter === 'todos') return records;
    return records.filter((r) => r.status === activeFilter);
  }, [records, activeFilter]);

  // Gráfico ECharts de desglose de estado
  const chartOption = useMemo(() => {
    if (empty || !summary) return {};

    const data = summary.statusBreakdown
      .filter((b) => b.count > 0)
      .map((b) => {
        let color = '#10b981';
        if (b.status === 'discrepancia') color = '#f59e0b';
        if (b.status === 'solo_a') color = '#f43f5e';
        if (b.status === 'solo_b') color = '#a855f7';

        return {
          name: b.label,
          value: b.count,
          itemStyle: {
            color,
            opacity: activeFilter === 'todos' || activeFilter === b.status ? 1 : 0.35,
          },
        };
      });

    return {
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => {
          const item = summary.statusBreakdown.find((b) => b.label === params.name);
          return `
            <div class="text-xs font-sans">
              <div class="font-bold border-b pb-1 mb-1">${params.name}</div>
              <div>Registros: <b>${formatCount(params.value)}</b> (${item?.share ?? 0}%)</div>
              <div>Descuadre absoluto: <b>${formatMetric(item?.absDelta ?? 0, { format: 'moneda', currency })}</b></div>
            </div>
          `;
        },
      },
      legend: {
        bottom: 0,
        textStyle: { fontSize: 11 },
      },
      series: [
        {
          name: 'Estado de Conciliación',
          type: 'pie',
          radius: ['45%', '70%'],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 6,
            borderColor: '#fff',
            borderWidth: 2,
          },
          label: {
            show: true,
            formatter: '{b}: {c}',
            fontSize: 11,
          },
          data,
        },
      ],
    };
  }, [summary, empty, currency, activeFilter]);

  if (empty || summary == null) {
    return (
      <Alert role="status">
        <AlertTriangle className="size-4" />
        <AlertTitle>Sin datos de conciliación</AlertTitle>
        <AlertDescription>
          Selecciona una columna de clave identificadora y los importes a comparar para calcular el cuadre.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toolbar y exportación */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1.5 py-1">
            <Scale className="size-3.5 text-primary" />
            <span>{summary.totalKeys} claves analizadas</span>
          </Badge>
          <Badge
            variant="outline"
            className={cn(
              'py-1',
              summary.netDelta === 0
                ? 'border-emerald-500/40 text-emerald-600'
                : 'border-amber-500/40 text-amber-600',
            )}
          >
            {summary.netDelta === 0
              ? 'Cuadre neto perfecto (0,00)'
              : `Descuadre neto: ${formatMetric(summary.netDelta, { format: 'moneda', currency })}`}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => {
              const dataUrl = chartRef.current?.toPngDataUrl();
              if (dataUrl) downloadDataUrl('conciliacion-cuadre.png', dataUrl);
            }}
          >
            <ImageDown className="size-3.5" />
            PNG
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            onClick={() =>
              downloadTextFile(
                'conciliacion-fichero.csv',
                reconciliationToCsv(records),
                'text/csv;charset=utf-8',
              )
            }
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
            <CardDescription>Total Fuente A</CardDescription>
            <CardTitle className="text-xl">
              {formatMetric(summary.totalA, { format: 'moneda', currency })}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardDescription>Total Fuente B</CardDescription>
            <CardTitle className="text-xl">
              {formatMetric(summary.totalB, { format: 'moneda', currency })}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card
          size="sm"
          className={cn(
            summary.netDelta !== 0 && 'border-amber-500/30 bg-amber-500/5',
          )}
        >
          <CardHeader>
            <CardDescription>Diferencia neta (A - B)</CardDescription>
            <CardTitle
              className={cn(
                'text-xl font-bold',
                summary.netDelta === 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-amber-600 dark:text-amber-400',
              )}
            >
              {formatMetric(summary.netDelta, { format: 'moneda', currency })}
            </CardTitle>
            <p className="text-[11px] text-muted-foreground">Balance neto de cuadre</p>
          </CardHeader>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardDescription>Desviación acumulada</CardDescription>
            <CardTitle className="text-xl font-bold text-rose-600 dark:text-rose-400">
              {formatMetric(summary.totalDiscrepancy, { format: 'moneda', currency })}
            </CardTitle>
            <p className="text-[11px] text-muted-foreground">Suma de diferencias absolutas</p>
          </CardHeader>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardDescription>Tasa de cuadre exacto</CardDescription>
            <CardTitle className="text-xl font-bold text-primary">
              {summary.exactMatchRate} %
            </CardTitle>
            <p className="text-[11px] text-muted-foreground">
              {summary.matchRate} % emparejados
            </p>
          </CardHeader>
        </Card>
      </div>

      {/* Gráfico y Botones de Filtro */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Gráfico de distribución de estado */}
        <Card className="lg:col-span-6">
          <CardHeader>
            <CardTitle>Distribución de estados de cuadre</CardTitle>
            <CardDescription>
              Proporción de claves exactas, discrepancias y registros huérfanos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72 w-full">
              <EChart
                ref={chartRef}
                option={chartOption}
                ariaLabel="Distribución de estados de conciliación"
                onSelect={({ category, name }) => {
                  const clickedLabel = category ?? name;
                  const item = summary.statusBreakdown.find((b) => b.label === clickedLabel);
                  if (item) {
                    setActiveFilter((curr) => (curr === item.status ? 'todos' : item.status));
                  }
                }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Tarjetas de desglose de estado */}
        <Card className="lg:col-span-6">
          <CardHeader>
            <CardTitle>Diagnóstico por estado</CardTitle>
            <CardDescription>
              Haz clic en cualquier estado para filtrar los registros en la tabla.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2.5 sm:grid-cols-2">
            {summary.statusBreakdown.map((b) => (
              <button
                key={b.status}
                type="button"
                onClick={() =>
                  setActiveFilter(activeFilter === b.status ? 'todos' : b.status)
                }
                className={cn(
                  'flex flex-col rounded-lg border p-3 text-left text-xs transition-all',
                  activeFilter === b.status
                    ? 'border-primary ring-2 ring-primary/20 bg-primary/5'
                    : 'bg-card hover:bg-muted/40',
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{b.label}</span>
                  <Badge variant="outline" className={cn('text-[10px]', STATUS_BADGE[b.status].className)}>
                    {b.count}
                  </Badge>
                </div>
                <div className="mt-2 text-muted-foreground">
                  Participación: <b className="text-foreground">{b.share} %</b>
                </div>
                <div className="mt-0.5 text-muted-foreground">
                  Descuadre abs:{' '}
                  <b className="text-foreground">
                    {formatMetric(b.absDelta, { format: 'moneda', currency })}
                  </b>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Tabla detallada de conciliación */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle>Detalle de registros conciliados</CardTitle>
              <CardDescription>
                Mostrando {filteredRecords.length} de {records.length} registros.
              </CardDescription>
            </div>
            {activeFilter !== 'todos' && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setActiveFilter('todos')}
              >
                Mostrar todos
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-muted/30 text-xs font-medium text-muted-foreground">
              <tr>
                <th className="py-2.5 pl-3 pr-2">Clave / ID</th>
                <th className="px-3 py-2.5 text-center">Estado</th>
                <th className="px-3 py-2.5 text-right">Importe A</th>
                <th className="px-3 py-2.5 text-right">Importe B</th>
                <th className="px-3 py-2.5 text-right">Diferencia (A - B)</th>
                <th className="px-3 py-2.5 text-right">Desviación %</th>
                <th className="py-2.5 pl-3 pr-4">Diagnóstico</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filteredRecords.slice(0, 150).map((r) => (
                <tr key={r.key} className="hover:bg-muted/40 transition-colors">
                  <td className="py-2 pl-3 pr-2 font-mono font-medium">{r.key}</td>
                  <td className="px-3 py-2 text-center">
                    <Badge variant="outline" className={cn('text-[11px]', STATUS_BADGE[r.status].className)}>
                      {STATUS_BADGE[r.status].label}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {r.valueA > 0 ? formatMetric(r.valueA, { format: 'moneda', currency }) : '—'}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {r.valueB > 0 ? formatMetric(r.valueB, { format: 'moneda', currency }) : '—'}
                  </td>
                  <td className="px-3 py-2 text-right font-mono font-medium">
                    {r.delta === 0 ? (
                      <span className="text-emerald-600 dark:text-emerald-400">0,00</span>
                    ) : (
                      <span className={r.delta > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'}>
                        {r.delta > 0 ? `+${formatMetric(r.delta, { format: 'moneda', currency })}` : formatMetric(r.delta, { format: 'moneda', currency })}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs text-muted-foreground">
                    {r.deltaPercent !== null ? `${r.deltaPercent > 0 ? '+' : ''}${r.deltaPercent} %` : '—'}
                  </td>
                  <td className="py-2 pl-3 pr-4 text-xs text-muted-foreground">
                    {r.explanation}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredRecords.length > 150 && (
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Mostrando los primeros 150 registros. Descarga el CSV para consultar la conciliación completa.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
