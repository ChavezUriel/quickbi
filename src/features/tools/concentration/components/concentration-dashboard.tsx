import { useMemo, useRef, useState } from 'react';
import type { EChartsCoreOption } from 'echarts/core';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Download,
  ImageDown,
  ShieldAlert,
  ShieldCheck,
  TriangleAlert,
  X,
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
import { formatCount, formatMetric, formatShare } from '@/features/analysis/lib/format';
import { prepareRows } from '@/features/analysis/lib/prepare-rows';
import type { Currency } from '@/features/analysis/types';
import type { ParsedDataset } from '@/features/dataset/types';
import type { ColumnMappingState } from '@/features/mapping/use-column-mapping';
import {
  computeConcentration,
  type ConcentrationAnalysisResult,
  type CustomerShare,
  type RiskLevel,
} from '../lib/concentration';
import { concentrationToCsv } from '../lib/export-concentration-csv';
import type { ConcentrationConfigState } from '../use-concentration-config';

const TABLE_LIMIT = 150;

const RISK_CONFIG: Record<
  RiskLevel,
  { label: string; icon: typeof ShieldCheck; className: string; badgeClass: string }
> = {
  critico: {
    label: 'Riesgo Crítico de Concentración',
    icon: ShieldAlert,
    className: 'border-rose-500/30 bg-rose-500/10 text-rose-800 dark:text-rose-300',
    badgeClass: 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/20',
  },
  alto: {
    label: 'Alta Dependencia',
    icon: AlertTriangle,
    className: 'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300',
    badgeClass: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20',
  },
  moderado: {
    label: 'Concentración Moderada (Pareto)',
    icon: AlertTriangle,
    className: 'border-sky-500/30 bg-sky-500/10 text-sky-800 dark:text-sky-300',
    badgeClass: 'bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/20',
  },
  bajo: {
    label: 'Cartera Diversificada (Bajo Riesgo)',
    icon: ShieldCheck,
    className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300',
    badgeClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
  },
};

type SortKey = 'rank' | 'customerId' | 'revenue' | 'share' | 'cumulativeShare';

export function ConcentrationDashboard({
  dataset,
  mapping,
  state,
}: {
  dataset: ParsedDataset;
  mapping: ColumnMappingState;
  state: ConcentrationConfigState;
}) {
  const chartRef = useRef<EChartHandle>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedScope, setSelectedScope] = useState<'all' | 'top1' | 'top5' | 'top20pct'>('all');
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({
    key: 'rank',
    desc: false,
  });

  const { assignments } = state.slots;
  const customerDim = assignments.cliente ?? null;
  const amountColumn = assignments.importe ?? null;
  const { currency, topLimit } = state.settings;

  const prepared = useMemo(
    () => prepareRows(dataset.rows, mapping.columns, { dateColumn: null }, mapping.preserveInvalid),
    [dataset.rows, mapping.columns, mapping.preserveInvalid],
  );

  const result = useMemo<ConcentrationAnalysisResult | null>(() => {
    if (customerDim === null || amountColumn === null) return null;
    return computeConcentration(prepared.rows, {
      customerDim,
      amountColumn,
      topLimit,
    });
  }, [prepared.rows, customerDim, amountColumn, topLimit]);

  const filteredCustomers = useMemo(() => {
    if (result === null) return [];
    let list = result.allCustomers;
    if (selectedScope === 'top1') {
      list = list.slice(0, 1);
    } else if (selectedScope === 'top5') {
      list = list.slice(0, 5);
    } else if (selectedScope === 'top20pct') {
      const count = Math.max(1, Math.ceil(result.customerCount * 0.2));
      list = list.slice(0, count);
    }
    if (searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase();
      list = list.filter((c) => c.customerId.toLowerCase().includes(term));
    }
    return list;
  }, [result, searchTerm, selectedScope]);

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

  // EChart Curva de Lorenz
  const lorenzOption = useMemo<EChartsCoreOption>(() => {
    if (result === null || result.lorenzCurve.length === 0) return {};

    const points = result.lorenzCurve;
    const realCurve = points.map((p) => [p.customerPercent, p.revenuePercent]);
    const equalityLine = points.map((p) => [p.customerPercent, p.equalityPercent]);

    return {
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          if (!Array.isArray(params)) return '';
          const custPct = params[0]?.data?.[0];
          const revPct = params[0]?.data?.[1];
          if (custPct == null || revPct == null) return '';
          return `
            <div style="font-weight:600;margin-bottom:4px;">Curva de Lorenz</div>
            <div>Clientes acumulados: <b>${custPct.toFixed(1)} %</b></div>
            <div>Facturación acumulada: <b>${revPct.toFixed(1)} %</b></div>
            <div style="font-size:11px;color:#64748b;margin-top:4px;">
              El ${custPct.toFixed(0)} % de clientes genera el ${revPct.toFixed(1)} % de las ventas.
            </div>
          `;
        },
      },
      legend: {
        data: ['Distribución Real (Lorenz)', 'Igualdad Perfecta'],
        top: 0,
      },
      grid: {
        left: '4%',
        right: '4%',
        bottom: '10%',
        top: '12%',
        containLabel: true,
      },
      xAxis: {
        type: 'value',
        min: 0,
        max: 100,
        name: '% Clientes acumulados',
        nameLocation: 'middle',
        nameGap: 24,
        axisLabel: { formatter: '{value} %' },
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: 100,
        name: '% Facturación acumulada',
        axisLabel: { formatter: '{value} %' },
      },
      series: [
        {
          name: 'Distribución Real (Lorenz)',
          type: 'line',
          data: realCurve,
          smooth: true,
          showSymbol: false,
          lineStyle: { width: 3, color: '#3b82f6' },
          areaStyle: {
            color: 'rgba(59, 130, 246, 0.15)',
          },
        },
        {
          name: 'Igualdad Perfecta',
          type: 'line',
          data: equalityLine,
          showSymbol: false,
          lineStyle: { width: 2, type: 'dashed', color: '#94a3b8' },
        },
      ],
    };
  }, [result]);

  if (customerDim === null || amountColumn === null) {
    return (
      <Alert role="status">
        <TriangleAlert className="size-4" />
        <AlertTitle>Faltan columnas requeridas</AlertTitle>
        <AlertDescription>
          Selecciona qué columna identifica al cliente y cuál representa la facturación en la configuración.
        </AlertDescription>
      </Alert>
    );
  }

  if (result === null || result.customerCount === 0) {
    return (
      <Alert role="status">
        <TriangleAlert className="size-4" />
        <AlertTitle>Sin datos que analizar</AlertTitle>
        <AlertDescription>
          No se encontraron clientes con facturación positiva válida.
        </AlertDescription>
      </Alert>
    );
  }

  const baseName = dataset.fileName.replace(/\.[^.]+$/, '');
  const money = { format: 'moneda' as const, currency };
  const risk = RISK_CONFIG[result.riskLevel];
  const RiskIcon = risk.icon;

  return (
    <div className="space-y-4">
      {/* Risk Diagnosis Banner */}
      <div className={cn('flex items-start gap-3 rounded-xl border p-4 text-sm', risk.className)}>
        <RiskIcon className="mt-0.5 size-5 shrink-0" />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold">{risk.label}</h4>
            <Badge variant="outline" className={cn('text-xs', risk.badgeClass)}>
              Gini {result.gini.toFixed(2)} · HHI {result.hhi.toFixed(0)}
            </Badge>
          </div>
          <p className="text-xs text-pretty opacity-90">{result.riskDiagnosis}</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Tile
          label="Coeficiente de Gini"
          value={result.gini.toFixed(3)}
          hint="0 = Igualdad total · 1 = Máxima concentración"
        />
        <Tile
          label="Índice HHI"
          value={formatCount(Math.round(result.hhi))}
          hint="<1500 Diversificada · >2500 Concentración crítica"
        />
        <div
          className={cn('cursor-pointer rounded-xl transition-all', selectedScope === 'top1' && 'ring-2 ring-primary')}
          onClick={() => setSelectedScope((prev) => (prev === 'top1' ? 'all' : 'top1'))}
        >
          <Tile
            label="Top 1 Cliente (Mayor cuenta)"
            value={formatShare(result.top1Share)}
            hint={`Facturación: ${formatMetric(result.allCustomers[0]?.revenue ?? 0, money)}`}
          />
        </div>
        <div
          className={cn('cursor-pointer rounded-xl transition-all', selectedScope === 'top20pct' && 'ring-2 ring-primary')}
          onClick={() => setSelectedScope((prev) => (prev === 'top20pct' ? 'all' : 'top20pct'))}
        >
          <Tile
            label="Principio de Pareto (Top 20 %)"
            value={formatShare(result.top20PercentShare)}
            hint={`Generado por los ${formatCount(Math.max(1, Math.ceil(result.customerCount * 0.2)))} clientes principales`}
          />
        </div>
      </div>

      {/* Lorenz Curve Chart */}
      <Card size="sm">
        <CardHeader>
          <CardTitle>Curva de Lorenz (Distribución de la cartera)</CardTitle>
          <CardDescription className="text-xs text-pretty">
            Cuanto más se aleja la curva azul de la diagonal discontinua, mayor es la desigualdad y dependencia de pocos clientes.
          </CardDescription>
          <CardAction>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7"
                onClick={() => {
                  const dataUrl = chartRef.current?.toPngDataUrl();
                  if (dataUrl != null) downloadDataUrl(`${baseName}-concentracion.png`, dataUrl);
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
                    `${baseName}-concentracion.csv`,
                    concentrationToCsv(result),
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
            option={lorenzOption}
            ariaLabel="Curva de Lorenz de concentración"
            className="min-h-80 w-full sm:min-h-96"
          />
        </CardContent>
      </Card>

      {/* Top Customers Table */}
      <Card size="sm">
        <CardHeader>
          <div>
            <CardTitle>Ranking de concentración por cliente</CardTitle>
            <CardDescription className="text-xs">
              {formatCount(sortedCustomers.length)} clientes
              {sortedCustomers.length > TABLE_LIMIT && ` · mostrando los primeros ${formatCount(TABLE_LIMIT)}`}
              {selectedScope === 'top1' && ' · Mostrando Top 1 Cliente'}
              {selectedScope === 'top20pct' && ' · Mostrando Top 20% Pareto'}
            </CardDescription>
          </div>
          <CardAction>
            <div className="flex items-center gap-1.5">
              {selectedScope !== 'all' && (
                <Badge
                  variant="secondary"
                  className="cursor-pointer gap-1 text-xs py-1"
                  onClick={() => setSelectedScope('all')}
                >
                  {selectedScope === 'top1' ? 'Top 1' : 'Top 20%'}
                  <X className="size-3 text-muted-foreground" />
                </Badge>
              )}
              <input
                type="search"
                placeholder="Buscar cliente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-7 w-40 rounded-md border border-input bg-transparent px-2 text-xs outline-none focus-visible:border-ring sm:w-56"
              />
            </div>
          </CardAction>
        </CardHeader>
        <CardContent>
          <CustomerTable
            customers={sortedCustomers.slice(0, TABLE_LIMIT)}
            currency={currency}
            sort={sort}
            onSort={(key) =>
              setSort((current) =>
                current.key === key
                  ? { key, desc: !current.desc }
                  : { key, desc: key === 'revenue' || key === 'share' || key === 'cumulativeShare' },
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
  currency,
  sort,
  onSort,
}: {
  customers: readonly CustomerShare[];
  currency: Currency;
  sort: { key: SortKey; desc: boolean };
  onSort: (key: SortKey) => void;
}) {
  if (customers.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Ningún cliente coincide con la búsqueda.
      </p>
    );
  }

  const money = { format: 'moneda' as const, currency };

  return (
    <div className="max-h-[28rem] overflow-auto rounded-md border">
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-card">
          <tr className="border-b text-xs">
            <th scope="col" className="px-2.5 py-2 text-center font-medium w-12">
              <button
                type="button"
                onClick={() => onSort('rank')}
                className="inline-flex items-center gap-1 hover:text-foreground"
              >
                #
                {sort.key === 'rank' &&
                  (sort.desc ? <ArrowDown className="size-3" /> : <ArrowUp className="size-3" />)}
              </button>
            </th>
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
            <th scope="col" className="px-2.5 py-2 text-right font-medium">
              <button
                type="button"
                onClick={() => onSort('revenue')}
                className="inline-flex items-center gap-1 hover:text-foreground"
              >
                Facturación
                {sort.key === 'revenue' &&
                  (sort.desc ? <ArrowDown className="size-3" /> : <ArrowUp className="size-3" />)}
              </button>
            </th>
            <th scope="col" className="px-2.5 py-2 text-right font-medium">
              <button
                type="button"
                onClick={() => onSort('share')}
                className="inline-flex items-center gap-1 hover:text-foreground"
              >
                % Total
                {sort.key === 'share' &&
                  (sort.desc ? <ArrowDown className="size-3" /> : <ArrowUp className="size-3" />)}
              </button>
            </th>
            <th scope="col" className="px-2.5 py-2 text-right font-medium">
              <button
                type="button"
                onClick={() => onSort('cumulativeShare')}
                className="inline-flex items-center gap-1 hover:text-foreground"
              >
                % Acumulado
                {sort.key === 'cumulativeShare' &&
                  (sort.desc ? <ArrowDown className="size-3" /> : <ArrowUp className="size-3" />)}
              </button>
            </th>
            <th scope="col" className="px-2.5 py-2 text-left font-medium">Riesgo / Impacto</th>
          </tr>
        </thead>
        <tbody>
          {customers.map((c) => (
            <tr key={c.customerId} className="border-b last:border-0 hover:bg-muted/40">
              <td className="px-2.5 py-1.5 text-center text-xs text-muted-foreground font-mono">
                {c.rank}
              </td>
              <td className="max-w-56 truncate px-2.5 py-1.5 font-medium" title={c.customerId}>
                {c.customerId}
              </td>
              <td className="px-2.5 py-1.5 text-right tabular-nums font-semibold">
                {formatMetric(c.revenue, money)}
              </td>
              <td className="px-2.5 py-1.5 text-right tabular-nums">
                <span className="font-medium">{formatShare(c.share)}</span>
              </td>
              <td className="px-2.5 py-1.5 text-right tabular-nums text-muted-foreground">
                {formatShare(c.cumulativeShare)}
              </td>
              <td className="px-2.5 py-1.5">
                {c.riskCategory === 'critico' ? (
                  <Badge variant="outline" className="border-rose-500/20 bg-rose-500/15 text-rose-700 dark:text-rose-400 text-xs">
                    Crítico (&gt;15 %)
                  </Badge>
                ) : c.riskCategory === 'alto' ? (
                  <Badge variant="outline" className="border-amber-500/20 bg-amber-500/15 text-amber-700 dark:text-amber-400 text-xs">
                    Alto (&gt;7 %)
                  </Badge>
                ) : c.riskCategory === 'medio' ? (
                  <Badge variant="outline" className="border-sky-500/20 bg-sky-500/15 text-sky-700 dark:text-sky-400 text-xs">
                    Medio (&gt;3 %)
                  </Badge>
                ) : (
                  <span className="text-xs text-muted-foreground">Estándar</span>
                )}
              </td>
            </tr>
          ))}
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
