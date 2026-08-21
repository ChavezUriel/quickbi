import { useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Crown, Download, ImageDown, TriangleAlert, X } from 'lucide-react';
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
import type { ParsedDataset } from '@/features/dataset/types';
import type { ColumnMappingState } from '@/features/mapping/use-column-mapping';
import { computeClv, type CustomerStatus } from '../lib/clv';
import { buildClvDecilesChartOption } from '../lib/clv-chart-option';
import { clvToCsv } from '../lib/export-clv-csv';
import type { ClvConfigState } from '../use-clv-config';

const TABLE_LIMIT = 150;
type SortKey = 'rank' | 'totalSpend' | 'orderCount' | 'aov' | 'lifespanDays' | 'recencyDays' | 'projectedClv';
type CustomerFilter = 'todos' | 'd10' | 'activo' | 'en_riesgo' | 'inactivo';

const STATUS_STYLE: Record<CustomerStatus, { label: string; className: string }> = {
  activo: { label: 'Activo', className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' },
  en_riesgo: { label: 'En riesgo', className: 'bg-amber-500/15 text-amber-700 dark:text-amber-400' },
  inactivo: { label: 'Inactivo', className: 'bg-muted text-muted-foreground' },
};

export function ClvDashboard({
  dataset,
  mapping,
  state,
}: {
  dataset: ParsedDataset;
  mapping: ColumnMappingState;
  state: ClvConfigState;
}) {
  const chartRef = useRef<EChartHandle>(null);
  const [filter, setFilter] = useState<CustomerFilter>('todos');
  const [selectedDecile, setSelectedDecile] = useState<number | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({
    key: 'rank',
    desc: false,
  });

  const { assignments } = state.slots;
  const customerDim = assignments.cliente ?? null;
  const dateColumn = assignments.fecha ?? null;
  const amountColumn = assignments.importe ?? null;
  const orderDim = assignments.pedido ?? null;
  const currency = state.settings.currency;

  const prepared = useMemo(
    () => prepareRows(dataset.rows, mapping.columns, { dateColumn }, mapping.preserveInvalid),
    [dataset.rows, mapping.columns, mapping.preserveInvalid, dateColumn],
  );

  const result = useMemo(() => {
    if (customerDim === null || amountColumn === null || dateColumn === null) return null;
    return computeClv(prepared.rows, {
      customerDim,
      amountColumn,
      dateColumn,
      orderDim,
      churnDays: state.settings.churnDays,
      marginRate: state.settings.marginRate,
      projectionYears: state.settings.projectionYears,
      referenceDay: state.referenceDay,
    });
  }, [
    prepared.rows,
    customerDim,
    amountColumn,
    dateColumn,
    orderDim,
    state.settings.churnDays,
    state.settings.marginRate,
    state.settings.projectionYears,
    state.referenceDay,
  ]);

  const filteredCustomers = useMemo(() => {
    if (result === null) return [];
    let list = result.customers;
    if (selectedDecile !== null) {
      list = list.filter((c) => c.decile === selectedDecile);
    }
    if (filter === 'd10') {
      list = list.filter((c) => c.decile === 10);
    } else if (filter === 'activo' || filter === 'en_riesgo' || filter === 'inactivo') {
      list = list.filter((c) => c.status === filter);
    }
    return list;
  }, [result, filter, selectedDecile]);

  const sortedCustomers = useMemo(() => {
    const list = [...filteredCustomers];
    list.sort((a, b) => {
      const left = a[sort.key];
      const right = b[sort.key];
      const comp = Number(left) - Number(right);
      return sort.desc ? -comp : comp;
    });
    return list;
  }, [filteredCustomers, sort]);

  const chartOption = useMemo(() => {
    if (result === null) return null;
    return buildClvDecilesChartOption({
      deciles: result.deciles,
      currency,
      selectedDecile,
    });
  }, [result, currency, selectedDecile]);

  if (result === null) {
    return (
      <Alert role="status">
        <TriangleAlert className="size-4" />
        <AlertTitle>Faltan columnas de configuración</AlertTitle>
        <AlertDescription>
          Asegúrate de asignar las columnas de Cliente, Fecha de compra e Importe.
        </AlertDescription>
      </Alert>
    );
  }

  const format = { format: 'moneda' as const, currency };
  const baseName = dataset.fileName.replace(/\.[^.]+$/, '');
  const { summary } = result;

  return (
    <div className="space-y-3">
      {/* KPI Cards */}
      <Card size="sm">
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Tile
            label="CLV Histórico Medio"
            value={formatMetric(summary.avgClv, format)}
            hint={`${formatCount(summary.totalCustomers)} clientes en total`}
          />
          <Tile
            label="Ticket Medio (AOV)"
            value={formatMetric(summary.avgAov, format)}
            hint={`${formatCount(summary.totalOrders)} compras totales`}
          />
          <Tile
            label="Frecuencia Media"
            value={`${(summary.totalOrders / Math.max(1, summary.totalCustomers)).toFixed(1)} pedidos`}
            hint="Promedio por cliente"
          />
          <Tile
            label="Vida Media del Cliente"
            value={`${Math.round(summary.avgLifespanDays)} días`}
            hint={`~${(summary.avgLifespanDays / 30.44).toFixed(1)} meses entre 1ª y última compra`}
          />
          <Tile
            label="Concentración Top 20%"
            value={formatShare(summary.paretoTop20Share)}
            hint="Ingresos generados por el 20% superior"
            highlight="amber"
          />
        </CardContent>
      </Card>

      {/* Deciles Chart */}
      <Card size="sm">
        <CardHeader>
          <CardTitle>Distribución de ingresos por deciles de clientes (D1 a D10)</CardTitle>
          <CardDescription className="text-xs">
            Cada decil agrupa al 10% de los clientes ordenados por gasto. D10 concentra a los mejores clientes.
          </CardDescription>
          <CardAction>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7"
                onClick={() => {
                  const dataUrl = chartRef.current?.toPngDataUrl();
                  if (dataUrl != null) downloadDataUrl(`${baseName}-clv-deciles.png`, dataUrl);
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
                    `${baseName}-clv-clientes.csv`,
                    clvToCsv(result),
                    'text/csv;charset=utf-8',
                  )
                }
              >
                <Download aria-hidden />
                CSV
              </Button>
            </div>
          </CardAction>
        </CardHeader>
        <CardContent>
          {chartOption && (
            <EChart
              ref={chartRef}
              option={chartOption}
              ariaLabel="Gráfico de distribución por deciles CLV"
              className="min-h-80 w-full sm:min-h-96"
              onSelect={({ category, name, dataIndex }) => {
                const clickedLabel = category ?? name;
                let dNum: number | null = null;
                if (clickedLabel && /^D\d+$/.test(clickedLabel)) {
                  dNum = parseInt(clickedLabel.slice(1), 10);
                } else if (dataIndex !== undefined && result.deciles[dataIndex]) {
                  dNum = result.deciles[dataIndex].decile;
                }
                if (dNum !== null) {
                  setSelectedDecile((prev) => (prev === dNum ? null : dNum));
                }
              }}
            />
          )}
        </CardContent>
      </Card>

      {/* Customer Ranking Table */}
      <Card size="sm">
        <CardHeader>
          <div>
            <CardTitle>Ranking de clientes por valor monetario</CardTitle>
            <CardDescription className="text-xs">
              {formatCount(sortedCustomers.length)} clientes
              {sortedCustomers.length > TABLE_LIMIT &&
                ` · se muestran los ${formatCount(TABLE_LIMIT)} primeros`}
              {selectedDecile !== null && ` · Filtrado por Decil D${selectedDecile}`}
            </CardDescription>
          </div>
          <CardAction>
            <div className="flex flex-wrap items-center gap-1.5">
              {selectedDecile !== null && (
                <Badge
                  variant="secondary"
                  className="cursor-pointer gap-1 text-xs py-1"
                  onClick={() => setSelectedDecile(null)}
                >
                  Decil D{selectedDecile}
                  <X className="size-3 text-muted-foreground" />
                </Badge>
              )}
              {(
                [
                  { id: 'todos', label: 'Todos' },
                  { id: 'd10', label: 'Top Decil (D10)' },
                  { id: 'activo', label: 'Activos' },
                  { id: 'en_riesgo', label: 'En riesgo' },
                  { id: 'inactivo', label: 'Inactivos' },
                ] as { id: CustomerFilter; label: string }[]
              ).map((item) => (
                <Button
                  key={item.id}
                  variant={filter === item.id && selectedDecile === null ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => {
                    setFilter(item.id);
                    if (item.id === 'd10') {
                      setSelectedDecile(10);
                    }
                  }}
                >
                  {item.label}
                </Button>
              ))}
            </div>
          </CardAction>
        </CardHeader>
        <CardContent>
          <div className="max-h-[28rem] overflow-auto rounded-md border">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-card">
                <tr className="border-b">
                  <Th label="#" sortKey="rank" sort={sort} onSort={setSort} align="center" />
                  <th scope="col" className="px-2 py-2 text-left font-medium">
                    Cliente
                  </th>
                  <Th label="CLV Histórico" sortKey="totalSpend" sort={sort} onSort={setSort} align="right" />
                  <Th label="Pedidos" sortKey="orderCount" sort={sort} onSort={setSort} align="right" />
                  <Th label="Ticket Medio (AOV)" sortKey="aov" sort={sort} onSort={setSort} align="right" />
                  <Th label="Vida (Días)" sortKey="lifespanDays" sort={sort} onSort={setSort} align="right" />
                  <Th label="Inactivo (Días)" sortKey="recencyDays" sort={sort} onSort={setSort} align="right" />
                  <th scope="col" className="px-2 py-2 text-center font-medium">
                    Decil
                  </th>
                  <th scope="col" className="px-2 py-2 text-center font-medium">
                    Estado
                  </th>
                  <Th label="CLV Proyectado" sortKey="projectedClv" sort={sort} onSort={setSort} align="right" />
                </tr>
              </thead>
              <tbody>
                {sortedCustomers.slice(0, TABLE_LIMIT).map((c) => {
                  const statusStyle = STATUS_STYLE[c.status];
                  return (
                    <tr key={c.id} className="border-b last:border-0 hover:bg-muted/40">
                      <td className="px-2 py-1.5 text-center font-mono text-xs text-muted-foreground">
                        {c.rank === 1 ? <Crown className="inline size-3.5 text-amber-500 mr-0.5" /> : null}
                        {c.rank}
                      </td>
                      <td className="max-w-48 truncate px-2 py-1.5 font-medium" title={c.id}>
                        {c.id}
                      </td>
                      <td className="px-2 py-1.5 text-right font-semibold tabular-nums">
                        {formatMetric(c.totalSpend, format)}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{formatCount(c.orderCount)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{formatMetric(c.aov, format)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{formatCount(c.lifespanDays)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                        {formatCount(c.recencyDays)}
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-xs font-mono',
                            c.decile === 10
                              ? 'border-primary bg-primary/10 text-primary font-bold'
                              : 'text-muted-foreground',
                          )}
                        >
                          D{c.decile}
                        </Badge>
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        <Badge variant="outline" className={cn('text-xs', statusStyle.className)}>
                          {statusStyle.label}
                        </Badge>
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums font-medium text-emerald-600 dark:text-emerald-400">
                        {formatMetric(c.projectedClv, format)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Th({
  label,
  sortKey,
  sort,
  onSort,
  align,
}: {
  label: string;
  sortKey: SortKey;
  sort: { key: SortKey; desc: boolean };
  onSort: (val: { key: SortKey; desc: boolean }) => void;
  align: 'left' | 'right' | 'center';
}) {
  return (
    <th
      scope="col"
      className={cn(
        'px-2 py-2 font-medium whitespace-nowrap',
        align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left',
      )}
    >
      <button
        type="button"
        onClick={() =>
          onSort({
            key: sortKey,
            desc: sort.key === sortKey ? !sort.desc : sortKey !== 'rank',
          })
        }
        className={cn(
          'inline-flex items-center gap-1 rounded-sm hover:text-foreground',
          sort.key === sortKey ? 'text-foreground font-semibold' : 'text-muted-foreground',
        )}
      >
        {label}
        {sort.key === sortKey &&
          (sort.desc ? <ArrowDown className="size-3" aria-hidden /> : <ArrowUp className="size-3" aria-hidden />)}
      </button>
    </th>
  );
}

function Tile({
  label,
  value,
  hint,
  highlight,
}: {
  label: string;
  value: string;
  hint?: string;
  highlight?: 'amber';
}) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground truncate" title={label}>
        {label}
      </p>
      <p
        className={cn(
          'mt-1 text-lg font-semibold tabular-nums',
          highlight === 'amber' && 'text-amber-600 dark:text-amber-400',
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground truncate">{hint}</p>}
    </div>
  );
}
