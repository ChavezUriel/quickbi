import { useMemo, useRef, useState } from 'react';
import type { EChartsCoreOption } from 'echarts/core';
import { ArrowDown, ArrowUp, Download, ImageDown, Sparkles, TriangleAlert } from 'lucide-react';
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
import { formatCount, formatShare } from '@/features/analysis/lib/format';
import { prepareRows } from '@/features/analysis/lib/prepare-rows';
import type { ParsedDataset } from '@/features/dataset/types';
import type { ColumnMappingState } from '@/features/mapping/use-column-mapping';
import {
  computeBasket,
  type AssociationRule,
  type BasketAnalysisResult,
} from '../lib/basket';
import { basketToCsv } from '../lib/export-basket-csv';
import type { BasketConfigState } from '../use-basket-config';

const TABLE_LIMIT = 150;

type SortKey = 'antecedent' | 'consequent' | 'supportCount' | 'support' | 'confidence' | 'lift';

export function BasketDashboard({
  dataset,
  mapping,
  state,
}: {
  dataset: ParsedDataset;
  mapping: ColumnMappingState;
  state: BasketConfigState;
}) {
  const chartRef = useRef<EChartHandle>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({
    key: 'lift',
    desc: true,
  });

  const { assignments } = state.slots;
  const itemDim = assignments.producto ?? null;
  const basketDim = assignments.pedido ?? null;
  const quantityColumn = assignments.cantidad ?? null;
  const { minSupport, minConfidence, minLift, topMatrixLimit } = state.settings;

  const prepared = useMemo(
    () => prepareRows(dataset.rows, mapping.columns, { dateColumn: null }, mapping.preserveInvalid),
    [dataset.rows, mapping.columns, mapping.preserveInvalid],
  );

  const result = useMemo<BasketAnalysisResult | null>(() => {
    if (itemDim === null || basketDim === null) return null;
    return computeBasket(prepared.rows, {
      itemDim,
      basketDim,
      quantityColumn,
      minSupport,
      minConfidence,
      minLift,
      topMatrixLimit,
    });
  }, [prepared.rows, itemDim, basketDim, quantityColumn, minSupport, minConfidence, minLift, topMatrixLimit]);

  const filteredRules = useMemo(() => {
    if (result === null) return [];
    if (searchTerm.trim() === '') return result.rules;
    const term = searchTerm.toLowerCase();
    return result.rules.filter(
      (r) =>
        r.antecedent.toLowerCase().includes(term) ||
        r.consequent.toLowerCase().includes(term),
    );
  }, [result, searchTerm]);

  const sortedRules = useMemo(() => {
    const list = [...filteredRules];
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
  }, [filteredRules, sort]);

  const topLiftRule = result?.rules[0] ?? null;

  // Matriz de calor EChart (Top productos vs Top productos por Lift)
  const heatmapOption = useMemo<EChartsCoreOption>(() => {
    if (result === null || result.matrix.topItems.length === 0) return {};

    const topItems = result.matrix.topItems;
    const data: [number, number, number][] = [];
    let maxLiftVal = 1;

    topItems.forEach((itemA, yIndex) => {
      topItems.forEach((itemB, xIndex) => {
        const cell = result.matrix.cells.find(
          (c) => c.itemA === itemA && c.itemB === itemB,
        );
        const liftVal = cell ? Number(cell.lift.toFixed(2)) : 0;
        if (itemA !== itemB && liftVal > maxLiftVal) {
          maxLiftVal = liftVal;
        }
        data.push([xIndex, yIndex, liftVal]);
      });
    });

    return {
      tooltip: {
        position: 'top',
        formatter: (params: any) => {
          const [x, y, value] = params.data;
          const itemX = topItems[x];
          const itemY = topItems[y];
          if (itemX === itemY) {
            return `<b>${itemX}</b><br/>Producto individual`;
          }
          return `<b>Si compran:</b> ${itemY}<br/><b>También compran:</b> ${itemX}<br/><b>Lift:</b> ${value}x afinidad`;
        },
      },
      grid: {
        top: '4%',
        bottom: '22%',
        left: '20%',
        right: '6%',
      },
      xAxis: {
        type: 'category',
        data: topItems,
        splitArea: { show: true },
        axisLabel: {
          interval: 0,
          rotate: 35,
          fontSize: 11,
          formatter: (val: string) => (val.length > 14 ? `${val.slice(0, 12)}…` : val),
        },
      },
      yAxis: {
        type: 'category',
        data: topItems,
        splitArea: { show: true },
        axisLabel: {
          interval: 0,
          fontSize: 11,
          formatter: (val: string) => (val.length > 14 ? `${val.slice(0, 12)}…` : val),
        },
      },
      visualMap: {
        min: 0.5,
        max: Math.max(maxLiftVal, 2.5),
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        bottom: '0%',
        inRange: {
          color: ['#f1f5f9', '#93c5fd', '#3b82f6', '#1d4ed8'],
        },
      },
      series: [
        {
          name: 'Afinidad (Lift)',
          type: 'heatmap',
          data,
          label: {
            show: topItems.length <= 8,
            formatter: (p: any) => (p.data[2] > 0 ? p.data[2].toFixed(1) : ''),
            fontSize: 10,
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowColor: 'rgba(0, 0, 0, 0.5)',
            },
          },
        },
      ],
    };
  }, [result]);

  if (itemDim === null || basketDim === null) {
    return (
      <Alert role="status">
        <TriangleAlert className="size-4" />
        <AlertTitle>Faltan columnas requeridas</AlertTitle>
        <AlertDescription>
          Elige qué columna identifica al producto y cuál agrupa el ticket/pedido en la configuración.
        </AlertDescription>
      </Alert>
    );
  }

  if (result === null || result.totalBaskets === 0) {
    return (
      <Alert role="status">
        <TriangleAlert className="size-4" />
        <AlertTitle>Sin datos suficientes</AlertTitle>
        <AlertDescription>
          No se encontraron cestas con productos válidos en el dataset.
        </AlertDescription>
      </Alert>
    );
  }

  const baseName = dataset.fileName.replace(/\.[^.]+$/, '');

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Tile
          label="Cestas / Tickets analizados"
          value={formatCount(result.totalBaskets)}
          hint={`${formatCount(result.uniqueItems)} productos únicos en catálogo`}
        />
        <Tile
          label="Tamaño medio de cesta"
          value={`${result.avgBasketSize.toFixed(1)} artículos`}
          hint="Media de productos distintos por ticket"
        />
        <Tile
          label="Reglas de venta cruzada"
          value={formatCount(result.rules.length)}
          hint={`Con Lift ≥ ${minLift.toFixed(1)} y Confianza ≥ ${(minConfidence * 100).toFixed(0)} %`}
        />
        <Tile
          label="Mayor afinidad (Top Lift)"
          value={topLiftRule ? `${topLiftRule.lift.toFixed(2)}x` : '—'}
          hint={
            topLiftRule
              ? `${topLiftRule.antecedent} → ${topLiftRule.consequent}`
              : 'Sin reglas con los filtros actuales'
          }
        />
      </div>

      {/* Cross-sell Matrix Chart */}
      {result.matrix.topItems.length > 1 && (
        <Card size="sm">
          <CardHeader>
            <CardTitle>Matriz de afinidad y co-ocurrencia (Top Productos)</CardTitle>
            <CardDescription className="text-xs text-pretty">
              Fuerza de asociación (Lift) entre los productos más vendidos. Colores más oscuros indican mayor propensión a comprarse juntos.
            </CardDescription>
            <CardAction>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7"
                  onClick={() => {
                    const dataUrl = chartRef.current?.toPngDataUrl();
                    if (dataUrl != null) downloadDataUrl(`${baseName}-cesta-compra.png`, dataUrl);
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
                      `${baseName}-cesta-compra.csv`,
                      basketToCsv(result),
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
              option={heatmapOption}
              ariaLabel="Matriz de afinidad de compra"
              className="min-h-80 w-full sm:min-h-96"
            />
          </CardContent>
        </Card>
      )}

      {/* Association Rules Table */}
      <Card size="sm">
        <CardHeader>
          <CardTitle>Recomendaciones de venta cruzada (Cross-Selling)</CardTitle>
          <CardDescription className="text-xs">
            {formatCount(sortedRules.length)} reglas identificadas
            {sortedRules.length > TABLE_LIMIT && ` · mostrando las primeras ${formatCount(TABLE_LIMIT)}`}
          </CardDescription>
          <CardAction>
            <input
              type="search"
              placeholder="Buscar producto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-7 w-40 rounded-md border border-input bg-transparent px-2 text-xs outline-none focus-visible:border-ring sm:w-56"
            />
          </CardAction>
        </CardHeader>
        <CardContent>
          <RulesTable
            rules={sortedRules.slice(0, TABLE_LIMIT)}
            sort={sort}
            onSort={(key) =>
              setSort((current) =>
                current.key === key
                  ? { key, desc: !current.desc }
                  : { key, desc: key !== 'antecedent' && key !== 'consequent' },
              )
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}

function RulesTable({
  rules,
  sort,
  onSort,
}: {
  rules: readonly AssociationRule[];
  sort: { key: SortKey; desc: boolean };
  onSort: (key: SortKey) => void;
}) {
  if (rules.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        <p>No se encontraron reglas con los umbrales actuales.</p>
        <p className="mt-1 text-xs">Prueba a reducir el soporte o la confianza mínima en la configuración.</p>
      </div>
    );
  }

  return (
    <div className="max-h-[28rem] overflow-auto rounded-md border">
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-card">
          <tr className="border-b text-xs">
            <th scope="col" className="px-3 py-2 text-left font-medium">
              <button
                type="button"
                onClick={() => onSort('antecedent')}
                className="inline-flex items-center gap-1 hover:text-foreground"
              >
                Si compran...
                {sort.key === 'antecedent' &&
                  (sort.desc ? <ArrowDown className="size-3" /> : <ArrowUp className="size-3" />)}
              </button>
            </th>
            <th scope="col" className="px-3 py-2 text-left font-medium">
              <button
                type="button"
                onClick={() => onSort('consequent')}
                className="inline-flex items-center gap-1 hover:text-foreground"
              >
                Recomendar también...
                {sort.key === 'consequent' &&
                  (sort.desc ? <ArrowDown className="size-3" /> : <ArrowUp className="size-3" />)}
              </button>
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium">
              <button
                type="button"
                onClick={() => onSort('support')}
                className="inline-flex items-center gap-1 hover:text-foreground"
              >
                Soporte
                {sort.key === 'support' &&
                  (sort.desc ? <ArrowDown className="size-3" /> : <ArrowUp className="size-3" />)}
              </button>
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium">
              <button
                type="button"
                onClick={() => onSort('confidence')}
                className="inline-flex items-center gap-1 hover:text-foreground"
              >
                Confianza
                {sort.key === 'confidence' &&
                  (sort.desc ? <ArrowDown className="size-3" /> : <ArrowUp className="size-3" />)}
              </button>
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium">
              <button
                type="button"
                onClick={() => onSort('lift')}
                className="inline-flex items-center gap-1 hover:text-foreground"
              >
                Lift
                {sort.key === 'lift' &&
                  (sort.desc ? <ArrowDown className="size-3" /> : <ArrowUp className="size-3" />)}
              </button>
            </th>
            <th scope="col" className="px-3 py-2 text-left font-medium">Impacto comercial</th>
          </tr>
        </thead>
        <tbody>
          {rules.map((r, i) => {
            const isHighLift = r.lift >= 1.5;
            const isPositiveLift = r.lift > 1.0;

            return (
              <tr key={`${r.antecedent}->${r.consequent}-${i}`} className="border-b last:border-0 hover:bg-muted/40">
                <td className="max-w-44 truncate px-3 py-1.5 font-medium" title={r.antecedent}>
                  {r.antecedent}
                </td>
                <td className="max-w-44 truncate px-3 py-1.5 font-medium text-primary" title={r.consequent}>
                  {r.consequent}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground text-xs">
                  {formatShare(r.support * 100)} ({formatCount(r.supportCount)})
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums font-medium">
                  {formatShare(r.confidence * 100)}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums">
                  <Badge
                    variant="outline"
                    className={cn(
                      'font-mono text-xs font-semibold',
                      isHighLift
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
                        : isPositiveLift
                          ? 'bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/20'
                          : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {r.lift.toFixed(2)}x
                  </Badge>
                </td>
                <td className="px-3 py-1.5 text-xs text-muted-foreground">
                  {isHighLift ? (
                    <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                      <Sparkles className="size-3" /> {r.lift.toFixed(1)}x más probable que el azar
                    </span>
                  ) : isPositiveLift ? (
                    <span>Afinidad positiva (+{((r.lift - 1) * 100).toFixed(0)} %)</span>
                  ) : (
                    <span>Compra independiente</span>
                  )}
                </td>
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
