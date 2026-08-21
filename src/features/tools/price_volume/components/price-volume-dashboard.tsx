import { useMemo, useRef, useState } from 'react';
import type { EChartsCoreOption } from 'echarts/core';
import {
  ArrowDown,
  ArrowUp,
  Download,
  ImageDown,
  LineChart,
  TriangleAlert,
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
import { formatCount, formatMetric, formatShare } from '@/features/analysis/lib/format';
import { prepareRows } from '@/features/analysis/lib/prepare-rows';
import type { Currency } from '@/features/analysis/types';
import type { ParsedDataset } from '@/features/dataset/types';
import type { ColumnMappingState } from '@/features/mapping/use-column-mapping';
import {
  computePriceVolume,
  type PriceVolumePoint,
  type PriceVolumeResult,
} from '../lib/price_volume';
import { priceVolumeToCsv } from '../lib/export-price-volume-csv';
import type { PriceVolumeConfigState } from '../use-price-volume-config';

const TABLE_LIMIT = 150;

type SortKey = 'name' | 'volume' | 'price' | 'revenue';

export function PriceVolumeDashboard({
  dataset,
  mapping,
  state,
}: {
  dataset: ParsedDataset;
  mapping: ColumnMappingState;
  state: PriceVolumeConfigState;
}) {
  const scatterRef = useRef<EChartHandle>(null);
  const pvmRef = useRef<EChartHandle>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({
    key: 'revenue',
    desc: true,
  });

  const { assignments } = state.slots;
  const productDim = assignments.producto ?? null;
  const volumeColumn = assignments.volumen ?? null;
  const amountColumn = assignments.importe ?? null;
  const dateColumn = assignments.fecha ?? null;
  const { currency, priceInputType } = state.settings;

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

  const result = useMemo<PriceVolumeResult | null>(() => {
    if (productDim === null || volumeColumn === null || amountColumn === null) return null;
    return computePriceVolume(prepared.rows, {
      productDim,
      volumeColumn,
      amountColumn,
      dateColumn,
      priceInputType,
    });
  }, [prepared.rows, productDim, volumeColumn, amountColumn, dateColumn, priceInputType]);

  const filteredPoints = useMemo(() => {
    if (result === null) return [];
    if (searchTerm.trim() === '') return result.points;
    const term = searchTerm.toLowerCase();
    return result.points.filter((p) => p.name.toLowerCase().includes(term));
  }, [result, searchTerm]);

  const sortedPoints = useMemo(() => {
    const list = [...filteredPoints];
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
  }, [filteredPoints, sort]);

  const money = useMemo(() => ({ format: 'moneda' as const, currency }), [currency]);

  // EChart Dispersión Precio vs Volumen
  const scatterOption = useMemo<EChartsCoreOption>(() => {
    if (result === null || result.points.length === 0) return {};

    const maxRev = Math.max(...result.points.map((p) => p.revenue), 1);
    const data = result.points.map((p) => [p.price, p.volume, p.revenue, p.name]);

    const seriesList: any[] = [
      {
        name: 'Productos',
        type: 'scatter',
        data,
        symbolSize: (val: any) => {
          const rev = val[2] ?? 0;
          return Math.max(10, Math.min(42, Math.sqrt(rev / maxRev) * 38));
        },
        itemStyle: {
          color: 'rgba(59, 130, 246, 0.75)',
          borderColor: '#1d4ed8',
          borderWidth: 1.5,
        },
      },
    ];

    if (result.trendLine !== null) {
      seriesList.push({
        name: 'Curva de Demanda Estimada',
        type: 'line',
        data: [result.trendLine.startPoint, result.trendLine.endPoint],
        showSymbol: false,
        lineStyle: { color: '#f59e0b', width: 2, type: 'dashed' },
      });
    }

    return {
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => {
          if (params.seriesType === 'line') return 'Línea de tendencia / Curva de Demanda';
          const [price, vol, rev, name] = params.data;
          return `
            <div style="font-weight:600;margin-bottom:4px;">${name}</div>
            <div>Precio Unitario: <b>${formatMetric(price, money)}</b></div>
            <div>Volumen Vendido: <b>${formatCount(vol)} unidades</b></div>
            <div style="color:#2563eb;">Facturación: <b>${formatMetric(rev, money)}</b></div>
          `;
        },
      },
      grid: {
        left: '4%',
        right: '5%',
        bottom: '10%',
        top: '10%',
        containLabel: true,
      },
      xAxis: {
        type: 'value',
        name: 'Precio unitario',
        nameLocation: 'middle',
        nameGap: 28,
        axisLabel: {
          formatter: (val: number) => formatMetric(val, { format: 'moneda', currency, compact: true }),
        },
      },
      yAxis: {
        type: 'value',
        name: 'Volumen (Unidades)',
        axisLabel: {
          formatter: (val: number) => formatCount(val),
        },
      },
      series: seriesList,
    };
  }, [result, currency, money]);

  // EChart Descomposición PVM Waterfall
  const pvmOption = useMemo<EChartsCoreOption>(() => {
    if (result === null || result.pvm === null) return {};

    const p = result.pvm;
    const categories = ['Efecto Precio', 'Efecto Volumen', 'Efecto Mix', 'Variación Neta Total'];
    const values = [p.priceEffect, p.volumeEffect, p.mixEffect, p.deltaRevenue];

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: any) => {
          if (!Array.isArray(params) || params[0] == null) return '';
          const idx = params[0].dataIndex;
          const label = categories[idx] ?? '';
          const val = values[idx] ?? 0;
          return `
            <div style="font-weight:600;">${label}</div>
            <div style="color:${val >= 0 ? '#10b981' : '#f43f5e'};">
              <b>${val >= 0 ? '+' : ''}${formatMetric(val, money)}</b>
            </div>
          `;
        },
      },
      grid: {
        left: '4%',
        right: '4%',
        bottom: '8%',
        top: '10%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: categories,
        axisTick: { alignWithLabel: true },
      },
      yAxis: {
        type: 'value',
        name: 'Variación de ingresos',
        axisLabel: {
          formatter: (val: number) => formatMetric(val, { format: 'moneda', currency, compact: true }),
        },
      },
      series: [
        {
          name: 'Impacto en Ingresos',
          type: 'bar',
          data: values.map((v, i) => ({
            value: v,
            itemStyle: {
              color: i === 3 ? '#8b5cf6' : v >= 0 ? '#10b981' : '#f43f5e',
            },
          })),
          label: {
            show: true,
            position: 'top',
            formatter: (params: any) =>
              formatMetric(params.value, { format: 'moneda', currency, compact: true }),
            fontSize: 11,
          },
        },
      ],
    };
  }, [result, currency, money]);

  if (productDim === null || volumeColumn === null || amountColumn === null) {
    return (
      <Alert role="status">
        <TriangleAlert className="size-4" />
        <AlertTitle>Faltan columnas requeridas</AlertTitle>
        <AlertDescription>
          Selecciona qué columna es el producto, cuál el volumen/cantidad y cuál el importe/precio.
        </AlertDescription>
      </Alert>
    );
  }

  if (result === null || result.points.length === 0) {
    return (
      <Alert role="status">
        <TriangleAlert className="size-4" />
        <AlertTitle>Sin datos que analizar</AlertTitle>
        <AlertDescription>
          No se encontraron productos con volumen y precio positivos válidos.
        </AlertDescription>
      </Alert>
    );
  }

  const baseName = dataset.fileName.replace(/\.[^.]+$/, '');

  return (
    <div className="space-y-4">
      {/* Elasticity Diagnosis Alert */}
      <div className="flex items-start gap-3 rounded-xl border bg-muted/40 p-4 text-sm">
        <LineChart className="mt-0.5 size-5 shrink-0 text-primary" />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold">{result.elasticityLabel}</h4>
            {result.elasticity !== null && (
              <Badge variant="outline" className="font-mono text-xs">
                ε = {result.elasticity.toFixed(2)}
              </Badge>
            )}
            {result.rSquared !== null && (
              <Badge variant="secondary" className="text-xs">
                R² = {(result.rSquared * 100).toFixed(0)} % ajuste
              </Badge>
            )}
          </div>
          <p className="text-xs text-pretty text-muted-foreground">{result.elasticityDiagnosis}</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Tile
          label="Facturación total"
          value={formatMetric(result.totalRevenue, money)}
          hint={`${formatCount(result.points.length)} productos analizados`}
        />
        <Tile
          label="Volumen total vendido"
          value={`${formatCount(result.totalVolume)} uds.`}
          hint="Suma de unidades o cantidad demandada"
        />
        <Tile
          label="Precio medio realizado"
          value={formatMetric(result.avgRealizedPrice, money)}
          hint="Facturación total dividida entre volumen total"
        />
        <Tile
          label="Elasticidad Precio (PED)"
          value={result.elasticity !== null ? result.elasticity.toFixed(2) : '—'}
          hint={
            result.elasticity !== null
              ? result.elasticity < -1
                ? 'Demanda muy elástica'
                : result.elasticity < 0
                  ? 'Demanda inelástica'
                  : 'Correlación positiva'
              : 'Sin variación suficiente'
          }
        />
      </div>

      {/* Price vs Volume Scatter Chart */}
      <Card size="sm">
        <CardHeader>
          <CardTitle>Dispersión Precio vs Volumen y Curva de Demanda</CardTitle>
          <CardDescription className="text-xs text-pretty">
            Cada burbuja es un producto (el tamaño representa la facturación). La línea discontinua muestra la curva de demanda estimada.
          </CardDescription>
          <CardAction>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7"
                onClick={() => {
                  const dataUrl = scatterRef.current?.toPngDataUrl();
                  if (dataUrl != null) downloadDataUrl(`${baseName}-precio-volumen.png`, dataUrl);
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
                    `${baseName}-precio-volumen.csv`,
                    priceVolumeToCsv(result),
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
            ref={scatterRef}
            option={scatterOption}
            ariaLabel="Gráfico de dispersión precio vs volumen"
            className="min-h-80 w-full sm:min-h-96"
          />
        </CardContent>
      </Card>

      {/* PVM Decomposition Chart */}
      {result.pvm !== null && (
        <Card size="sm">
          <CardHeader>
            <CardTitle>Descomposición Precio-Volumen-Mix (PVM)</CardTitle>
            <CardDescription className="text-xs text-pretty">
              Explicación de la variación neta de facturación entre {result.pvm.period0Label} y {result.pvm.period1Label}.
            </CardDescription>
            <CardAction>
              <Button
                variant="outline"
                size="sm"
                className="h-7"
                onClick={() => {
                  const dataUrl = pvmRef.current?.toPngDataUrl();
                  if (dataUrl != null) downloadDataUrl(`${baseName}-pvm-variacion.png`, dataUrl);
                }}
              >
                <ImageDown aria-hidden />
                PNG
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <EChart
              ref={pvmRef}
              option={pvmOption}
              ariaLabel="Descomposición PVM de variación de ingresos"
              className="min-h-72 w-full"
            />
          </CardContent>
        </Card>
      )}

      {/* Product Detail Table */}
      <Card size="sm">
        <CardHeader>
          <CardTitle>Detalle por producto</CardTitle>
          <CardDescription className="text-xs">
            {formatCount(sortedPoints.length)} productos
            {sortedPoints.length > TABLE_LIMIT && ` · mostrando los primeros ${formatCount(TABLE_LIMIT)}`}
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
          <ProductTable
            points={sortedPoints.slice(0, TABLE_LIMIT)}
            totalRevenue={result.totalRevenue}
            currency={currency}
            sort={sort}
            onSort={(key) =>
              setSort((current) =>
                current.key === key
                  ? { key, desc: !current.desc }
                  : { key, desc: key !== 'name' },
              )
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}

function ProductTable({
  points,
  totalRevenue,
  currency,
  sort,
  onSort,
}: {
  points: readonly PriceVolumePoint[];
  totalRevenue: number;
  currency: Currency;
  sort: { key: SortKey; desc: boolean };
  onSort: (key: SortKey) => void;
}) {
  if (points.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Ningún producto coincide con la búsqueda.
      </p>
    );
  }

  const money = { format: 'moneda' as const, currency };

  return (
    <div className="max-h-[28rem] overflow-auto rounded-md border">
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-card">
          <tr className="border-b text-xs">
            <th scope="col" className="px-2.5 py-2 text-left font-medium">
              <button
                type="button"
                onClick={() => onSort('name')}
                className="inline-flex items-center gap-1 hover:text-foreground"
              >
                Producto
                {sort.key === 'name' &&
                  (sort.desc ? <ArrowDown className="size-3" /> : <ArrowUp className="size-3" />)}
              </button>
            </th>
            <th scope="col" className="px-2.5 py-2 text-right font-medium">
              <button
                type="button"
                onClick={() => onSort('volume')}
                className="inline-flex items-center gap-1 hover:text-foreground"
              >
                Volumen (Uds.)
                {sort.key === 'volume' &&
                  (sort.desc ? <ArrowDown className="size-3" /> : <ArrowUp className="size-3" />)}
              </button>
            </th>
            <th scope="col" className="px-2.5 py-2 text-right font-medium">
              <button
                type="button"
                onClick={() => onSort('price')}
                className="inline-flex items-center gap-1 hover:text-foreground"
              >
                Precio Medio
                {sort.key === 'price' &&
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
            <th scope="col" className="px-2.5 py-2 text-right font-medium">Cuota %</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => {
            const share = totalRevenue > 0 ? (p.revenue / totalRevenue) * 100 : 0;
            return (
              <tr key={p.name} className="border-b last:border-0 hover:bg-muted/40">
                <td className="max-w-56 truncate px-2.5 py-1.5 font-medium" title={p.name}>
                  {p.name}
                </td>
                <td className="px-2.5 py-1.5 text-right tabular-nums">{formatCount(p.volume)}</td>
                <td className="px-2.5 py-1.5 text-right tabular-nums font-medium">
                  {formatMetric(p.price, money)}
                </td>
                <td className="px-2.5 py-1.5 text-right tabular-nums font-semibold">
                  {formatMetric(p.revenue, money)}
                </td>
                <td className="px-2.5 py-1.5 text-right tabular-nums text-muted-foreground">
                  {formatShare(share)}
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
