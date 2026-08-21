import { useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Download, ImageDown, TrendingDown, TrendingUp, TriangleAlert } from 'lucide-react';
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
import { formatDelta, formatMetric } from '@/features/analysis/lib/format';
import { prepareRows } from '@/features/analysis/lib/prepare-rows';
import type { ParsedDataset } from '@/features/dataset/types';
import type { ColumnMappingState } from '@/features/mapping/use-column-mapping';
import { waterfallToCsv } from '../lib/export-waterfall-csv';
import { computeWaterfall, type WaterfallBucketType } from '../lib/waterfall';
import { buildWaterfallChartOption } from '../lib/waterfall-chart-option';
import type { WaterfallConfigState } from '../use-waterfall-config';

type SortKey = 'category' | 'p1' | 'p2' | 'diff' | 'shareOfDiff';

const TYPE_BADGE_STYLE: Record<WaterfallBucketType, { label: string; className: string }> = {
  inicio: { label: 'Inicio', className: 'bg-blue-500/15 text-blue-700 dark:text-blue-400' },
  crecimiento: {
    label: 'Crecimiento',
    className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  },
  nuevo: { label: 'Nuevo', className: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-400' },
  contraccion: {
    label: 'Contracción',
    className: 'bg-rose-500/15 text-rose-700 dark:text-rose-400',
  },
  perdido: { label: 'Perdido', className: 'bg-orange-500/15 text-orange-700 dark:text-orange-400' },
  sin_cambio: { label: 'Sin cambio', className: 'bg-muted text-muted-foreground' },
  final: { label: 'Final', className: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-400' },
};

export function WaterfallDashboard({
  dataset,
  mapping,
  state,
}: {
  dataset: ParsedDataset;
  mapping: ColumnMappingState;
  state: WaterfallConfigState;
}) {
  const chartRef = useRef<EChartHandle>(null);
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({
    key: 'diff',
    desc: true,
  });

  const { assignments } = state.slots;
  const dimension = assignments.dimension ?? null;
  const measure = assignments.measure ?? null;
  const dateColumn = assignments.date ?? null;
  const currency = state.settings.currency;

  const prepared = useMemo(
    () => prepareRows(dataset.rows, mapping.columns, { dateColumn }, mapping.preserveInvalid),
    [dataset.rows, mapping.columns, mapping.preserveInvalid, dateColumn],
  );

  const result = useMemo(() => {
    if (dimension === null || measure === null) return null;
    return computeWaterfall(prepared.rows, {
      dimension,
      measure,
      splitMode: state.settings.splitMode,
      periodUnit: state.settings.periodUnit,
      customPeriod1: state.settings.customPeriod1,
      customPeriod2: state.settings.customPeriod2,
      maxCategories: state.settings.maxCategories,
    });
  }, [
    prepared.rows,
    dimension,
    measure,
    state.settings.splitMode,
    state.settings.periodUnit,
    state.settings.customPeriod1,
    state.settings.customPeriod2,
    state.settings.maxCategories,
  ]);

  const sortedItems = useMemo(() => {
    if (result === null) return [];
    const list = [...result.items];
    list.sort((a, b) => {
      let comparison = 0;
      if (sort.key === 'category') {
        comparison = a.category.localeCompare(b.category, 'es');
      } else {
        comparison = (a[sort.key] ?? 0) - (b[sort.key] ?? 0);
      }
      return sort.desc ? -comparison : comparison;
    });
    return list;
  }, [result, sort]);

  const chartOption = useMemo(() => {
    if (result === null) return null;
    return buildWaterfallChartOption({ result, currency });
  }, [result, currency]);

  if (result === null) {
    return (
      <Alert role="status">
        <TriangleAlert className="size-4" />
        <AlertTitle>Faltan datos o configuración</AlertTitle>
        <AlertDescription>
          Asegúrate de haber seleccionado una dimensión, una métrica y una columna de fecha en la
          configuración.
        </AlertDescription>
      </Alert>
    );
  }

  const format = { format: 'moneda' as const, currency };
  const baseName = dataset.fileName.replace(/\.[^.]+$/, '');
  const positiveGains = result.buckets.newAmount + result.buckets.growthAmount;
  const negativeLosses = result.buckets.shrinkageAmount + result.buckets.lostAmount;

  return (
    <div className="space-y-3">
      {/* KPI Cards */}
      <Card size="sm">
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Tile
            label={`Período 1 (${result.period1Label})`}
            value={formatMetric(result.totalP1, format)}
          />
          <Tile
            label={`Período 2 (${result.period2Label})`}
            value={formatMetric(result.totalP2, format)}
          />
          <Tile
            label="Variación Neta"
            value={formatMetric(result.netDiff, format)}
            badge={formatDelta(result.netDiffPct)}
            isPositive={result.netDiff >= 0}
          />
          <Tile
            label="Aportes Positivos"
            value={`+${formatMetric(positiveGains, format)}`}
            hint={`${result.buckets.newCount} nuevos · ${result.buckets.growthCount} crecieron`}
            highlight="green"
          />
          <Tile
            label="Aportes Negativos"
            value={formatMetric(negativeLosses, format)}
            hint={`${result.buckets.lostCount} perdidos · ${result.buckets.shrinkageCount} cayeron`}
            highlight="red"
          />
        </CardContent>
      </Card>

      {/* Waterfall Chart */}
      <Card size="sm">
        <CardHeader>
          <CardTitle>Puente de variación por {dimension}</CardTitle>
          <CardDescription className="text-xs">
            Descomposición paso a paso desde el Período 1 ({result.period1Label}) hasta el Período 2 ({result.period2Label}).
          </CardDescription>
          <CardAction>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7"
                onClick={() => {
                  const dataUrl = chartRef.current?.toPngDataUrl();
                  if (dataUrl != null) downloadDataUrl(`${baseName}-puente-variacion.png`, dataUrl);
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
                    `${baseName}-puente-variacion.csv`,
                    waterfallToCsv(result),
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
              ariaLabel="Gráfico de cascada de variación"
              className="min-h-80 w-full sm:min-h-96"
            />
          )}
        </CardContent>
      </Card>

      {/* Breakdown Table */}
      <Card size="sm">
        <CardHeader>
          <CardTitle>Detalle por categoría</CardTitle>
          <CardDescription className="text-xs">
            Aporte de cada categoría al cambio total.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-h-96 overflow-auto rounded-md border">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-card">
                <tr className="border-b">
                  <Th label="Categoría" sortKey="category" sort={sort} onSort={setSort} align="left" />
                  <th scope="col" className="px-2 py-2 text-left font-medium">
                    Tipo
                  </th>
                  <Th label="Período 1" sortKey="p1" sort={sort} onSort={setSort} align="right" />
                  <Th label="Período 2" sortKey="p2" sort={sort} onSort={setSort} align="right" />
                  <Th label="Variación" sortKey="diff" sort={sort} onSort={setSort} align="right" />
                  <th scope="col" className="px-2 py-2 text-right font-medium">
                    Var %
                  </th>
                  <Th label="Aporte %" sortKey="shareOfDiff" sort={sort} onSort={setSort} align="right" />
                </tr>
              </thead>
              <tbody>
                {sortedItems.map((item) => {
                  const style = TYPE_BADGE_STYLE[item.type];
                  return (
                    <tr key={item.category} className="border-b last:border-0 hover:bg-muted/40">
                      <td className="max-w-56 truncate px-2 py-1.5 font-medium" title={item.category}>
                        {item.category}
                      </td>
                      <td className="px-2 py-1.5">
                        <Badge variant="outline" className={cn('text-xs', style.className)}>
                          {style.label}
                        </Badge>
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {formatMetric(item.p1, format)}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {formatMetric(item.p2, format)}
                      </td>
                      <td
                        className={cn(
                          'px-2 py-1.5 text-right font-medium tabular-nums',
                          item.diff > 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : item.diff < 0
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-muted-foreground',
                        )}
                      >
                        {item.diff > 0 ? `+${formatMetric(item.diff, format)}` : formatMetric(item.diff, format)}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-xs">
                        {formatDelta(item.diffPct)}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-xs font-semibold">
                        {item.shareOfDiff.toFixed(1)} %
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
  align: 'left' | 'right';
}) {
  return (
    <th
      scope="col"
      className={cn('px-2 py-2 font-medium whitespace-nowrap', align === 'right' ? 'text-right' : 'text-left')}
    >
      <button
        type="button"
        onClick={() =>
          onSort({
            key: sortKey,
            desc: sort.key === sortKey ? !sort.desc : sortKey !== 'category',
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
  badge,
  isPositive,
  highlight,
}: {
  label: string;
  value: string;
  hint?: string;
  badge?: string;
  isPositive?: boolean;
  highlight?: 'green' | 'red';
}) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground truncate" title={label}>
        {label}
      </p>
      <div className="mt-1 flex items-baseline gap-2">
        <p
          className={cn(
            'text-lg font-semibold tabular-nums',
            highlight === 'green' && 'text-emerald-600 dark:text-emerald-400',
            highlight === 'red' && 'text-rose-600 dark:text-rose-400',
          )}
        >
          {value}
        </p>
        {badge && (
          <span
            className={cn(
              'inline-flex items-center text-xs font-medium',
              isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400',
            )}
          >
            {isPositive ? <TrendingUp className="mr-0.5 size-3" /> : <TrendingDown className="mr-0.5 size-3" />}
            {badge}
          </span>
        )}
      </div>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground truncate">{hint}</p>}
    </div>
  );
}
