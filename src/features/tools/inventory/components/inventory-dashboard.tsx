import { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  Boxes,
  Download,
  ImageDown,
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
import { inventoryToCsv } from '../lib/export-inventory-csv';
import {
  computeInventory,
  type AgingBucketId,
  type InventoryResult,
  type VelocityCategoryId,
} from '../lib/inventory';
import type { InventoryConfigState } from '../use-inventory-config';

const TONE_BADGE: Record<string, string> = {
  bueno: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
  neutro: 'bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/30',
  aviso: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
  malo: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30 font-medium',
};

export function InventoryDashboard({
  dataset,
  mapping,
  state,
}: {
  dataset: ParsedDataset;
  mapping: ColumnMappingState;
  state: InventoryConfigState;
}) {
  const chartRef = useRef<EChartHandle>(null);
  const [activeBucket, setActiveBucket] = useState<AgingBucketId | 'todos'>('todos');
  const [activeVelocity, setActiveVelocity] = useState<VelocityCategoryId | 'todos'>('todos');

  const { assignments } = state.slots;
  const productDim = assignments.producto ?? null;
  const stockColumn = assignments.stock ?? null;
  const salesColumn = assignments.ventas ?? null;
  const daysOrDateColumn = assignments.dias_o_fecha ?? null;
  const categoryDim = assignments.categoria ?? null;
  const { periodDays, currency } = state.settings;

  const prepared = useMemo(
    () => prepareRows(dataset.rows, mapping.columns, { dateColumn: null }, mapping.preserveInvalid),
    [dataset.rows, mapping.columns, mapping.preserveInvalid],
  );

  const result: InventoryResult | null = useMemo(() => {
    if (productDim === null || stockColumn === null) return null;
    return computeInventory(prepared.rows, {
      productDim,
      stockColumn,
      salesColumn,
      daysOrDateColumn,
      categoryDim,
      periodDays,
      referenceDay: state.referenceDay,
    });
  }, [
    prepared.rows,
    productDim,
    stockColumn,
    salesColumn,
    daysOrDateColumn,
    categoryDim,
    periodDays,
    state.referenceDay,
  ]);

  const items = useMemo(() => result?.items ?? [], [result]);
  const summary = result?.summary;
  const empty = items.length === 0;

  // Filtrado por tramos
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (activeBucket !== 'todos' && item.agingBucket !== activeBucket) return false;
      if (activeVelocity !== 'todos' && item.velocityCategory !== activeVelocity) return false;
      return true;
    });
  }, [items, activeBucket, activeVelocity]);

  // Opción de ECharts para distribución de stock por antigüedad
  const chartOption = useMemo(() => {
    if (empty || !summary) return {};

    const colors = ['#10b981', '#38bdf8', '#f59e0b', '#ef4444'];
    const bucketData = summary.agingDistribution.map((b, idx) => ({
      value: b.stockValue,
      name: b.label,
      itemStyle: {
        color: colors[idx % colors.length],
        opacity: activeBucket === 'todos' || activeBucket === b.id ? 1 : 0.35,
      },
    }));

    return {
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => {
          const b = summary.agingDistribution.find((x) => x.label === params.name);
          return `
            <div class="text-xs font-sans">
              <div class="font-bold border-b pb-1 mb-1">${params.name}</div>
              <div>Valor de stock: <b>${formatMetric(params.value, { format: 'moneda', currency })}</b></div>
              <div>Participación: <b>${b?.share ?? 0} %</b></div>
              <div>Artículos: <b>${formatCount(b?.itemCount ?? 0)} SKUs</b></div>
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
          name: 'Antigüedad de Stock',
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
            formatter: '{d}%',
            fontSize: 11,
          },
          data: bucketData,
        },
      ],
    };
  }, [summary, empty, currency, activeBucket]);

  if (empty || summary == null) {
    return (
      <Alert role="status">
        <AlertTriangle className="size-4" />
        <AlertTitle>Sin datos de inventario</AlertTitle>
        <AlertDescription>
          Selecciona una columna de producto/SKU y una columna de existencias de stock para calcular la rotación.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toolbar y exportaciones */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1.5 py-1">
            <Boxes className="size-3.5 text-primary" />
            <span>{summary.skuCount} referencias</span>
          </Badge>
          {summary.deadStockSkuCount > 0 && (
            <Badge variant="destructive" className="gap-1 py-1">
              <Archive className="size-3" />
              <span>{summary.deadStockSkuCount} stock muerto</span>
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => {
              const dataUrl = chartRef.current?.toPngDataUrl();
              if (dataUrl) downloadDataUrl('antiguedad-inventario.png', dataUrl);
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
                'rotacion-inventario.csv',
                inventoryToCsv(items),
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
            <CardDescription>Valor de inventario</CardDescription>
            <CardTitle className="text-xl">
              {formatMetric(summary.totalStock, { format: 'moneda', currency })}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardDescription>Rotación anualizada</CardDescription>
            <CardTitle className="text-xl font-bold text-primary">
              {summary.avgTurnover}x / año
            </CardTitle>
            <p className="text-[11px] text-muted-foreground">Turnover global</p>
          </CardHeader>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardDescription>DSI promedio</CardDescription>
            <CardTitle className="text-xl font-bold">
              {summary.avgDsi >= 999 ? '> 999 días' : `${summary.avgDsi} días`}
            </CardTitle>
            <p className="text-[11px] text-muted-foreground">Días de stock en almacén</p>
          </CardHeader>
        </Card>

        <Card
          size="sm"
          className={cn(
            summary.deadStockShare > 20 && 'border-red-500/30 bg-red-500/5',
          )}
        >
          <CardHeader>
            <CardDescription>Stock muerto / obsoleto</CardDescription>
            <CardTitle className="text-xl text-red-600 dark:text-red-400">
              {formatMetric(summary.deadStockValue, { format: 'moneda', currency })}
            </CardTitle>
            <p className="text-xs font-semibold text-red-600 dark:text-red-400">
              {summary.deadStockShare} % del almacén
            </p>
          </CardHeader>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardDescription>Ventas / Salidas totales</CardDescription>
            <CardTitle className="text-xl text-muted-foreground">
              {formatMetric(summary.totalSales, { format: 'moneda', currency })}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Gráfico y Distribución por Tramos */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Gráfico de distribución de stock */}
        <Card className="lg:col-span-6">
          <CardHeader>
            <CardTitle>Antigüedad del inventario</CardTitle>
            <CardDescription>
              Proporción de existencias según días de permanencia en almacén.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72 w-full">
              <EChart
                ref={chartRef}
                option={chartOption}
                ariaLabel="Distribución de antigüedad de stock"
                onSelect={({ category, name }) => {
                  const clickedLabel = category ?? name;
                  const bucket = summary.agingDistribution.find((b) => b.label === clickedLabel);
                  if (bucket) {
                    setActiveBucket((curr) => (curr === bucket.id ? 'todos' : bucket.id));
                  }
                }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Clasificación por Tramos y Velocidad */}
        <Card className="lg:col-span-6">
          <CardHeader>
            <CardTitle>Tramos y velocidad de salida</CardTitle>
            <CardDescription>
              Haz clic en cualquier tramo o categoría para filtrar la tabla de detalle.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Tramos de antigüedad
              </h4>
              <div className="grid gap-2 sm:grid-cols-2">
                {summary.agingDistribution.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() =>
                      setActiveBucket(activeBucket === b.id ? 'todos' : b.id)
                    }
                    className={cn(
                      'flex flex-col rounded-lg border p-2.5 text-left text-xs transition-all',
                      activeBucket === b.id
                        ? 'border-primary ring-2 ring-primary/20 bg-primary/5'
                        : 'bg-card hover:bg-muted/40',
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{b.label}</span>
                      <span className="font-mono font-bold">{b.share} %</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>{formatCount(b.itemCount)} SKUs</span>
                      <span>{formatMetric(b.stockValue, { format: 'moneda', currency })}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h4 className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Velocidad de rotación
              </h4>
              <div className="grid gap-2 sm:grid-cols-2">
                {summary.velocityDistribution.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() =>
                      setActiveVelocity(activeVelocity === v.id ? 'todos' : v.id)
                    }
                    className={cn(
                      'flex flex-col rounded-lg border p-2.5 text-left text-xs transition-all',
                      activeVelocity === v.id
                        ? 'border-primary ring-2 ring-primary/20 bg-primary/5'
                        : 'bg-card hover:bg-muted/40',
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{v.label}</span>
                      <span className="font-mono font-bold">{v.share} %</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>{formatCount(v.itemCount)} SKUs</span>
                      <span>{formatMetric(v.stockValue, { format: 'moneda', currency })}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabla detallada de SKUs */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle>Catálogo de inventario y recomendaciones</CardTitle>
              <CardDescription>
                Mostrando {filteredItems.length} de {items.length} artículos.
              </CardDescription>
            </div>
            {(activeBucket !== 'todos' || activeVelocity !== 'todos') && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => {
                  setActiveBucket('todos');
                  setActiveVelocity('todos');
                }}
              >
                Limpiar filtros
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-muted/30 text-xs font-medium text-muted-foreground">
              <tr>
                <th className="py-2.5 pl-3 pr-2">SKU / Producto</th>
                <th className="px-3 py-2.5">Categoría</th>
                <th className="px-3 py-2.5 text-right">Stock</th>
                <th className="px-3 py-2.5 text-right">Ventas</th>
                <th className="px-3 py-2.5 text-right">Rotación</th>
                <th className="px-3 py-2.5 text-right">DSI (Días)</th>
                <th className="px-3 py-2.5 text-center">Velocidad</th>
                <th className="py-2.5 pl-3 pr-4">Recomendación</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filteredItems.slice(0, 150).map((item) => (
                <tr key={item.id} className="hover:bg-muted/40 transition-colors">
                  <td className="py-2 pl-3 pr-2 font-medium">{item.id}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{item.category}</td>
                  <td className="px-3 py-2 text-right font-mono font-medium">
                    {formatMetric(item.stock, { format: 'moneda', currency })}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-muted-foreground">
                    {formatMetric(item.sales, { format: 'moneda', currency })}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    <span className="font-semibold">{item.turnover}x</span>
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {item.dsi >= 999 ? (
                      <span className="text-red-600 dark:text-red-400 font-semibold">&gt; 999d</span>
                    ) : (
                      `${item.dsi}d`
                    )}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <Badge
                      variant="outline"
                      className={cn('text-[11px]', TONE_BADGE[item.agingBucket === 'over_90' ? 'malo' : item.velocityCategory === 'alta' ? 'bueno' : 'neutro'])}
                    >
                      {item.velocityCategory === 'alta'
                        ? 'Rápida'
                        : item.velocityCategory === 'media'
                        ? 'Media'
                        : item.velocityCategory === 'baja'
                        ? 'Lenta'
                        : 'Stock muerto'}
                    </Badge>
                  </td>
                  <td className="py-2 pl-3 pr-4 text-xs font-medium text-muted-foreground">
                    {item.recommendation}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredItems.length > 150 && (
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Mostrando los primeros 150 artículos. Descarga el CSV para consultar el catálogo completo.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
