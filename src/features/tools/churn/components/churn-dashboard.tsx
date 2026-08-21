import { useMemo, useRef, useState } from 'react';
import type { EChartsCoreOption } from 'echarts/core';
import { ArrowDown, ArrowUp, Download, ImageDown, TriangleAlert } from 'lucide-react';
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
import { formatCount, formatMetric, formatShare } from '@/features/analysis/lib/format';
import { prepareRows } from '@/features/analysis/lib/prepare-rows';
import type { Currency } from '@/features/analysis/types';
import type { ParsedDataset } from '@/features/dataset/types';
import type { ColumnMappingState } from '@/features/mapping/use-column-mapping';
import {
  computeChurn,
  type ChurnAnalysisResult,
  type CustomerDetail,
  type CustomerMovementStatus,
} from '../lib/churn';
import { churnToCsv } from '../lib/export-churn-csv';
import type { ChurnConfigState } from '../use-churn-config';

const TABLE_LIMIT = 150;

const STATUS_BADGE: Record<
  CustomerMovementStatus,
  { label: string; className: string }
> = {
  nuevo: {
    label: 'Nuevo',
    className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
  },
  recurrente: {
    label: 'Recurrente',
    className: 'bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/20',
  },
  reactivado: {
    label: 'Reactivado',
    className: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20',
  },
  perdido: {
    label: 'Perdido (Churn)',
    className: 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/20',
  },
};

type SortKey = 'customerId' | 'status' | 'currentRevenue' | 'previousRevenue';

export function ChurnDashboard({
  dataset,
  mapping,
  state,
}: {
  dataset: ParsedDataset;
  mapping: ColumnMappingState;
  state: ChurnConfigState;
}) {
  const chartRef = useRef<EChartHandle>(null);
  const [selectedStatus, setSelectedStatus] = useState<CustomerMovementStatus | 'todos'>('todos');
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({
    key: 'currentRevenue',
    desc: true,
  });

  const { assignments } = state.slots;
  const customerDim = assignments.cliente ?? null;
  const dateColumn = assignments.fecha ?? null;
  const amountColumn = assignments.importe ?? null;
  const { grain, currency } = state.settings;

  const prepared = useMemo(
    () =>
      prepareRows(
        dataset.rows,
        mapping.columns,
        { dateColumn },
        mapping.preserveInvalid,
      ),
    [dataset.rows, mapping.columns, mapping.preserveInvalid, dateColumn],
  );

  const result = useMemo<ChurnAnalysisResult | null>(() => {
    if (customerDim === null || dateColumn === null) return null;
    return computeChurn(prepared.rows, {
      customerDim,
      dateColumn,
      amountColumn,
      grain,
    });
  }, [prepared.rows, customerDim, dateColumn, amountColumn, grain]);

  const filteredCustomers = useMemo(() => {
    if (result === null) return [];
    if (selectedStatus === 'todos') return result.customers;
    return result.customers.filter((c) => c.status === selectedStatus);
  }, [result, selectedStatus]);

  const sortedCustomers = useMemo(() => {
    const list = [...filteredCustomers];
    list.sort((a, b) => {
      const left = a[sort.key];
      const right = b[sort.key];
      const comparison =
        typeof left === 'string' && typeof right === 'string'
          ? left.localeCompare(right, 'es')
          : Number(left) - Number(right);
      return sort.desc ? -comparison : comparison;
    });
    return list;
  }, [filteredCustomers, sort]);

  const chartOption = useMemo<EChartsCoreOption>(() => {
    if (result === null || result.periods.length === 0) return {};

    const categories = result.periods.map((p) => p.periodLabel);
    const newSeries = result.periods.map((p) => p.newCustomers);
    const reactivatedSeries = result.periods.map((p) => p.reactivatedCustomers);
    const churnedSeries = result.periods.map((p) => -p.churnedCustomers); // Negative for downward bar
    const netSeries = result.periods.map((p) => p.netCustomerChange);

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: any) => {
          if (!Array.isArray(params)) return '';
          const periodIndex = params[0]?.dataIndex;
          const p = result.periods[periodIndex];
          if (!p) return '';

          let html = `<div style="font-weight:600;margin-bottom:4px;">${p.periodLabel}</div>`;
          html += `<div style="color:#10b981;">● Nuevos: <b>+${formatCount(p.newCustomers)}</b></div>`;
          html += `<div style="color:#0ea5e9;">● Reactivados: <b>+${formatCount(p.reactivatedCustomers)}</b></div>`;
          html += `<div style="color:#f43f5e;">● Perdidos: <b>-${formatCount(p.churnedCustomers)}</b></div>`;
          html += `<div style="margin-top:4px;border-top:1px solid rgba(128,128,128,0.3);padding-top:4px;color:#8b5cf6;">Variación Neta: <b>${p.netCustomerChange >= 0 ? '+' : ''}${formatCount(p.netCustomerChange)}</b></div>`;
          if (p.quickRatio !== null) {
            html += `<div>Quick Ratio: <b>${p.quickRatio.toFixed(2)}</b></div>`;
          }
          return html;
        },
      },
      legend: {
        data: ['Nuevos', 'Reactivados', 'Perdidos (Churn)', 'Variación Neta'],
        top: 0,
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '8%',
        top: '14%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: categories,
        axisTick: { alignWithLabel: true },
      },
      yAxis: {
        type: 'value',
        name: 'Clientes',
        axisLabel: {
          formatter: (value: number) => formatCount(Math.abs(value)),
        },
      },
      series: [
        {
          name: 'Nuevos',
          type: 'bar',
          stack: 'inflow',
          itemStyle: { color: '#10b981' },
          data: newSeries,
        },
        {
          name: 'Reactivados',
          type: 'bar',
          stack: 'inflow',
          itemStyle: { color: '#0ea5e9' },
          data: reactivatedSeries,
        },
        {
          name: 'Perdidos (Churn)',
          type: 'bar',
          stack: 'outflow',
          itemStyle: { color: '#f43f5e' },
          data: churnedSeries,
        },
        {
          name: 'Variación Neta',
          type: 'line',
          itemStyle: { color: '#8b5cf6' },
          lineStyle: { width: 3 },
          symbol: 'circle',
          symbolSize: 6,
          data: netSeries,
        },
      ],
    };
  }, [result]);

  if (customerDim === null || dateColumn === null) {
    return (
      <Alert role="status">
        <TriangleAlert className="size-4" />
        <AlertTitle>Faltan columnas requeridas</AlertTitle>
        <AlertDescription>
          Selecciona una columna de cliente y una de fecha en el paso de configuración.
        </AlertDescription>
      </Alert>
    );
  }

  if (result === null || result.periods.length === 0) {
    return (
      <Alert role="status">
        <TriangleAlert className="size-4" />
        <AlertTitle>Sin datos que analizar</AlertTitle>
        <AlertDescription>
          Ninguna fila contiene cliente y fecha válidos en el formato esperado.
        </AlertDescription>
      </Alert>
    );
  }

  const baseName = dataset.fileName.replace(/\.[^.]+$/, '');
  const money = { format: 'moneda' as const, currency };

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Tile
          label="Clientes únicos totales"
          value={formatCount(result.totalUniqueCustomers)}
          hint={`${formatCount(result.periods.length)} períodos analizados`}
        />
        <Tile
          label="Tasa de Churn media"
          value={result.avgChurnRate !== null ? formatShare(result.avgChurnRate) : '—'}
          hint="Porcentaje medio de clientes perdidos por período"
        />
        <Tile
          label="Tasa de Retención media"
          value={result.avgRetentionRate !== null ? formatShare(result.avgRetentionRate) : '—'}
          hint="Clientes que repiten compra período a período"
        />
        <Tile
          label="Quick Ratio global"
          value={result.overallQuickRatio !== null ? result.overallQuickRatio.toFixed(2) : '—'}
          hint={
            result.overallQuickRatio !== null
              ? result.overallQuickRatio >= 1
                ? 'Crecimiento neto positivo (> 1.0)'
                : 'Pérdida neta de clientes (< 1.0)'
              : 'Sin salidas registradas'
          }
        />
      </div>

      {/* Main Chart */}
      <Card size="sm">
        <CardHeader>
          <CardTitle>Flujo de entradas y salidas de clientes</CardTitle>
          <CardDescription className="text-xs text-pretty">
            Evolución de clientes nuevos y reactivados (barras positivas) frente a clientes perdidos (barras negativas).
          </CardDescription>
          <CardAction>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7"
                onClick={() => {
                  const dataUrl = chartRef.current?.toPngDataUrl();
                  if (dataUrl != null) downloadDataUrl(`${baseName}-movimiento-clientes.png`, dataUrl);
                }}
              >
                <ImageDown aria-hidden />
                PNG
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7"
                onClick={() =>
                  downloadTextFile(
                    `${baseName}-movimiento-clientes.csv`,
                    churnToCsv(result),
                    'text/csv;charset=utf-8',
                  )
                }
              >
                <Download />
                CSV
              </Button>
            </div>
          </CardAction>
        </CardHeader>
        <CardContent>
          <EChart
            ref={chartRef}
            option={chartOption}
            ariaLabel="Flujo de clientes por período"
            className="min-h-80 w-full sm:min-h-96"
          />
        </CardContent>
      </Card>

      {/* Period Movement Table */}
      <Card size="sm">
        <CardHeader>
          <CardTitle>Dinámica por período</CardTitle>
          <CardDescription className="text-xs">
            Resumen métrico de retención, pérdidas e ingresos por cada corte temporal.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-h-80 overflow-auto rounded-md border">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-card">
                <tr className="border-b text-xs">
                  <th scope="col" className="px-2.5 py-2 text-left font-medium">Período</th>
                  <th scope="col" className="px-2.5 py-2 text-right font-medium">Activos</th>
                  <th scope="col" className="px-2.5 py-2 text-right font-medium text-emerald-600 dark:text-emerald-400">Nuevos</th>
                  <th scope="col" className="px-2.5 py-2 text-right font-medium text-sky-600 dark:text-sky-400">Recurrentes</th>
                  <th scope="col" className="px-2.5 py-2 text-right font-medium text-amber-600 dark:text-amber-400">Reactivados</th>
                  <th scope="col" className="px-2.5 py-2 text-right font-medium text-rose-600 dark:text-rose-400">Perdidos</th>
                  <th scope="col" className="px-2.5 py-2 text-right font-medium">Var. Neta</th>
                  <th scope="col" className="px-2.5 py-2 text-right font-medium">Churn %</th>
                  <th scope="col" className="px-2.5 py-2 text-right font-medium">Retención %</th>
                  <th scope="col" className="px-2.5 py-2 text-right font-medium">Quick Ratio</th>
                  {amountColumn && (
                    <th scope="col" className="px-2.5 py-2 text-right font-medium">Ingresos</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {result.periods.map((p) => (
                  <tr key={p.period} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="px-2.5 py-1.5 font-medium whitespace-nowrap">{p.periodLabel}</td>
                    <td className="px-2.5 py-1.5 text-right tabular-nums">{formatCount(p.activeCustomers)}</td>
                    <td className="px-2.5 py-1.5 text-right tabular-nums text-emerald-600 dark:text-emerald-400 font-medium">
                      +{formatCount(p.newCustomers)}
                    </td>
                    <td className="px-2.5 py-1.5 text-right tabular-nums text-sky-600 dark:text-sky-400 font-medium">
                      {formatCount(p.returningCustomers)}
                    </td>
                    <td className="px-2.5 py-1.5 text-right tabular-nums text-amber-600 dark:text-amber-400 font-medium">
                      +{formatCount(p.reactivatedCustomers)}
                    </td>
                    <td className="px-2.5 py-1.5 text-right tabular-nums text-rose-600 dark:text-rose-400 font-medium">
                      -{formatCount(p.churnedCustomers)}
                    </td>
                    <td className={cn(
                      'px-2.5 py-1.5 text-right tabular-nums font-semibold',
                      p.netCustomerChange > 0 ? 'text-emerald-600 dark:text-emerald-400' : p.netCustomerChange < 0 ? 'text-rose-600 dark:text-rose-400' : ''
                    )}>
                      {p.netCustomerChange > 0 ? `+${formatCount(p.netCustomerChange)}` : formatCount(p.netCustomerChange)}
                    </td>
                    <td className="px-2.5 py-1.5 text-right tabular-nums">
                      {p.churnRate !== null ? formatShare(p.churnRate) : '—'}
                    </td>
                    <td className="px-2.5 py-1.5 text-right tabular-nums">
                      {p.retentionRate !== null ? formatShare(p.retentionRate) : '—'}
                    </td>
                    <td className="px-2.5 py-1.5 text-right tabular-nums font-mono text-xs">
                      {p.quickRatio !== null ? p.quickRatio.toFixed(2) : '—'}
                    </td>
                    {amountColumn && (
                      <td className="px-2.5 py-1.5 text-right tabular-nums font-medium">
                        {formatMetric(p.totalRevenue, money)}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Customer Detail Drill-down */}
      <Card size="sm">
        <CardHeader>
          <CardTitle>Detalle de clientes</CardTitle>
          <CardDescription className="text-xs">
            {formatCount(sortedCustomers.length)} clientes
            {sortedCustomers.length > TABLE_LIMIT && ` · mostrando los primeros ${formatCount(TABLE_LIMIT)}`}
          </CardDescription>
          <CardAction>
            <div className="flex flex-wrap items-center gap-1.5">
              {(['todos', 'nuevo', 'recurrente', 'reactivado', 'perdido'] as const).map((status) => (
                <Button
                  key={status}
                  variant={selectedStatus === status ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 text-xs capitalize"
                  onClick={() => setSelectedStatus(status)}
                >
                  {status === 'todos' ? 'Todos' : STATUS_BADGE[status].label}
                </Button>
              ))}
            </div>
          </CardAction>
        </CardHeader>
        <CardContent>
          <CustomerTable
            customers={sortedCustomers.slice(0, TABLE_LIMIT)}
            amountColumn={amountColumn}
            currency={currency}
            sort={sort}
            onSort={(key) =>
              setSort((current) =>
                current.key === key
                  ? { key, desc: !current.desc }
                  : { key, desc: key !== 'customerId' },
              )
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}

function CustomerTable({
  customers,
  amountColumn,
  currency,
  sort,
  onSort,
}: {
  customers: readonly CustomerDetail[];
  amountColumn: string | null;
  currency: Currency;
  sort: { key: SortKey; desc: boolean };
  onSort: (key: SortKey) => void;
}) {
  if (customers.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Ningún cliente en este estado.
      </p>
    );
  }

  const money = { format: 'moneda' as const, currency };

  return (
    <div className="max-h-[28rem] overflow-auto rounded-md border">
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-card">
          <tr className="border-b">
            <th scope="col" className="px-2.5 py-2 text-left font-medium">
              <button
                type="button"
                onClick={() => onSort('customerId')}
                className="inline-flex items-center gap-1 hover:text-foreground"
              >
                Cliente
                {sort.key === 'customerId' &&
                  (sort.desc ? <ArrowDown className="size-3" /> : <ArrowUp className="size-3" />)}
              </button>
            </th>
            <th scope="col" className="px-2.5 py-2 text-left font-medium">Estado</th>
            <th scope="col" className="px-2.5 py-2 text-left font-medium">Primer Período</th>
            <th scope="col" className="px-2.5 py-2 text-left font-medium">Último Período</th>
            {amountColumn && (
              <>
                <th scope="col" className="px-2.5 py-2 text-right font-medium">
                  <button
                    type="button"
                    onClick={() => onSort('currentRevenue')}
                    className="inline-flex items-center gap-1 hover:text-foreground"
                  >
                    Importe Actual
                    {sort.key === 'currentRevenue' &&
                      (sort.desc ? <ArrowDown className="size-3" /> : <ArrowUp className="size-3" />)}
                  </button>
                </th>
                <th scope="col" className="px-2.5 py-2 text-right font-medium">
                  <button
                    type="button"
                    onClick={() => onSort('previousRevenue')}
                    className="inline-flex items-center gap-1 hover:text-foreground"
                  >
                    Importe Anterior
                    {sort.key === 'previousRevenue' &&
                      (sort.desc ? <ArrowDown className="size-3" /> : <ArrowUp className="size-3" />)}
                  </button>
                </th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {customers.map((c) => {
            const badge = STATUS_BADGE[c.status];
            return (
              <tr key={c.customerId} className="border-b last:border-0 hover:bg-muted/40">
                <td className="max-w-56 truncate px-2.5 py-1.5 font-medium" title={c.customerId}>
                  {c.customerId}
                </td>
                <td className="px-2.5 py-1.5">
                  <Badge variant="outline" className={cn('text-xs font-normal', badge.className)}>
                    {badge.label}
                  </Badge>
                </td>
                <td className="px-2.5 py-1.5 text-muted-foreground text-xs">{c.firstSeenPeriod}</td>
                <td className="px-2.5 py-1.5 text-muted-foreground text-xs">{c.lastSeenPeriod}</td>
                {amountColumn && (
                  <>
                    <td className="px-2.5 py-1.5 text-right tabular-nums font-medium">
                      {formatMetric(c.currentRevenue, money)}
                    </td>
                    <td className="px-2.5 py-1.5 text-right tabular-nums text-muted-foreground">
                      {formatMetric(c.previousRevenue, money)}
                    </td>
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Tile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold tabular-nums">{value}</p>
      {hint !== undefined && (
        <p className="text-xs text-pretty text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}
