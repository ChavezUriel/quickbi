import { useMemo, useRef, useState } from 'react';
import type { EChartsCoreOption } from 'echarts/core';
import {
  Crown,
  Download,
  ImageDown,
  Search,
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
import { cn } from '@/lib/utils';
import { formatCount, formatMetric } from '@/features/analysis/lib/format';
import { prepareRows } from '@/features/analysis/lib/prepare-rows';
import type { ParsedDataset } from '@/features/dataset/types';
import type { ColumnMappingState } from '@/features/mapping/use-column-mapping';
import { paretoToCsv } from '../lib/export-pareto-csv';
import { computePareto, type ABCClass } from '../lib/pareto';
import type { ParetoConfigState } from '../use-pareto-config';

const TABLE_LIMIT = 150;

const ABC_COLOR: Record<ABCClass, string> = {
  A: '#10b981', // emerald-500
  B: '#f59e0b', // amber-500
  C: '#64748b', // slate-500
};

export function ParetoDashboard({
  dataset,
  mapping,
  state,
}: {
  dataset: ParsedDataset;
  mapping: ColumnMappingState;
  state: ParetoConfigState;
}) {
  const chartRef = useRef<EChartHandle>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState<ABCClass | 'all'>('all');

  const { entityDim, measureColumn, settings } = state;

  const prepared = useMemo(
    () => prepareRows(dataset.rows, mapping.columns, { dateColumn: null }, mapping.preserveInvalid),
    [dataset.rows, mapping.columns, mapping.preserveInvalid],
  );

  const result = useMemo(() => {
    if (!entityDim || !measureColumn) return null;
    return computePareto(prepared.rows, entityDim, measureColumn, {
      thresholdA: settings.thresholdA,
      thresholdB: settings.thresholdB,
    });
  }, [prepared.rows, entityDim, measureColumn, settings.thresholdA, settings.thresholdB]);

  const baseName = dataset.fileName.replace(/\.[^.]+$/, '');
  const currency = settings.currency;
  const numFormat = useMemo(
    () => ({ format: 'moneda' as const, currency }),
    [currency],
  );

  // Filtered items for table
  const filteredItems = useMemo(() => {
    if (!result) return [];
    return result.items.filter((item) => {
      if (selectedClass !== 'all' && item.classABC !== selectedClass) return false;
      if (
        searchQuery.trim() !== '' &&
        !item.entity.toLowerCase().includes(searchQuery.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [result, selectedClass, searchQuery]);

  // Dual-Axis Pareto EChart Option
  const paretoChartOption = useMemo<EChartsCoreOption>(() => {
    if (!result || result.items.length === 0) return {};

    const maxDisplay = Math.min(100, result.items.length);
    const displayItems = result.items.slice(0, maxDisplay);

    const categories = displayItems.map((it) => it.entity);
    const barData = displayItems.map((it) => ({
      value: it.value,
      itemStyle: { color: ABC_COLOR[it.classABC] },
    }));
    const lineData = displayItems.map((it) => it.cumulativeShare);

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
        formatter: (params: any) => {
          const idx = params[0]?.dataIndex;
          const it = displayItems[idx];
          if (!it) return '';
          return `<div class="font-sans text-xs">
            <div class="font-semibold mb-1">#${it.rank} · ${it.entity}</div>
            <div>${result.measureColumn}: <b>${formatMetric(it.value, numFormat)}</b></div>
            <div>Cuota individual: <b>${it.share.toFixed(2)} %</b></div>
            <div class="mt-1 border-t pt-1">Acumulado: <b>${it.cumulativeShare.toFixed(1)} %</b> (${formatMetric(it.cumulativeValue, numFormat)})</div>
            <div>Clasificación: <b style="color: ${ABC_COLOR[it.classABC]}">Clase ${it.classABC}</b></div>
          </div>`;
        },
      },
      legend: {
        data: ['Valor individual', 'Cuota acumulada (%)'],
        bottom: 0,
      },
      grid: {
        top: 30,
        bottom: 60,
        left: 60,
        right: 60,
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: categories,
        axisLabel: {
          rotate: categories.length > 15 ? 40 : 0,
          interval: categories.length > 30 ? Math.floor(categories.length / 15) : 0,
          fontSize: 10,
          overflow: 'truncate',
          width: 70,
        },
      },
      yAxis: [
        {
          type: 'value',
          name: result.measureColumn,
          splitLine: { lineStyle: { type: 'dashed' } },
        },
        {
          type: 'value',
          name: 'Acumulado (%)',
          min: 0,
          max: 100,
          axisLabel: { formatter: '{value} %' },
          splitLine: { show: false },
        },
      ],
      dataZoom: [
        {
          type: 'slider',
          show: categories.length > 25,
          start: 0,
          end: Math.min(100, (25 / categories.length) * 100),
          bottom: 25,
          height: 16,
        },
      ],
      series: [
        {
          name: 'Valor individual',
          type: 'bar',
          data: barData,
          borderRadius: [3, 3, 0, 0],
        },
        {
          name: 'Cuota acumulada (%)',
          type: 'line',
          yAxisIndex: 1,
          data: lineData,
          symbol: 'circle',
          symbolSize: 5,
          itemStyle: { color: '#ec4899' },
          lineStyle: { width: 2.5, color: '#ec4899' },
          markLine: {
            silent: true,
            data: [
              {
                yAxis: 80,
                lineStyle: { color: '#10b981', type: 'dashed', width: 1.5 },
                label: { formatter: 'Corte 80%', position: 'insideEndTop', color: '#10b981' },
              },
            ],
          },
        },
      ],
    };
  }, [result, numFormat]);

  if (!entityDim || !measureColumn) {
    return (
      <Alert role="status">
        <TriangleAlert className="size-4" />
        <AlertTitle>Faltan columnas requeridas</AlertTitle>
        <AlertDescription>
          Selecciona una columna de entidades y una columna numérica en la configuración.
        </AlertDescription>
      </Alert>
    );
  }

  if (!result || result.totalEntities === 0) {
    return (
      <Alert role="status">
        <TriangleAlert className="size-4" />
        <AlertTitle>Sin datos que analizar</AlertTitle>
        <AlertDescription>
          No se han encontrado registros numéricos positivos para la combinación elegida.
        </AlertDescription>
      </Alert>
    );
  }

  const { concentration, summaryABC } = result;
  const giniLabel =
    concentration.gini > 0.7
      ? 'Muy alta concentración'
      : concentration.gini > 0.5
        ? 'Alta concentración'
        : concentration.gini > 0.3
          ? 'Concentración moderada'
          : 'Baja concentración (distribución equitativa)';

  return (
    <div className="space-y-3">
      {/* Top Concentration KPI Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile
          label="Regla 80 / 20"
          value={`${concentration.entitiesFor80Share.toFixed(1)} % de ${entityDim}`}
          hint={`${formatCount(concentration.entitiesFor80)} de ${formatCount(result.totalEntities)} generan el 80%`}
          badge="80/20"
          badgeVariant="positive"
        />
        <Tile
          label="Coeficiente de Gini"
          value={concentration.gini.toFixed(2)}
          hint={giniLabel}
          badge="Desigualdad"
        />
        <Tile
          label={`Clase A (Top ${settings.thresholdA}%)`}
          value={`${formatMetric(summaryABC.A.totalValue, numFormat)}`}
          hint={`${formatCount(summaryABC.A.count)} elementos (${summaryABC.A.countShare.toFixed(1)}% del catálogo)`}
          badge="Clase A"
          badgeVariant="classA"
        />
        <Tile
          label="Clase B + Clase C"
          value={`${formatMetric(summaryABC.B.totalValue + summaryABC.C.totalValue, numFormat)}`}
          hint={`${formatCount(summaryABC.B.count + summaryABC.C.count)} elementos restantes (${(summaryABC.B.countShare + summaryABC.C.countShare).toFixed(1)}%)`}
          badge="Clase B/C"
        />
      </div>

      {/* ABC Breakdown Summary Banner */}
      <Card size="sm">
        <CardContent className="space-y-2 py-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold flex items-center gap-1.5">
              <Crown className="size-3.5 text-amber-500" />
              Reparto del volumen total ({formatMetric(result.totalValue, numFormat)})
            </span>
            <span className="text-muted-foreground">
              {formatCount(result.totalEntities)} {entityDim}
            </span>
          </div>

          <div className="flex h-4 w-full overflow-hidden rounded-full border bg-muted/40">
            <div
              style={{ width: `${summaryABC.A.valueShare}%` }}
              className="bg-emerald-500 transition-all"
              title={`Clase A: ${summaryABC.A.valueShare.toFixed(1)}%`}
            />
            <div
              style={{ width: `${summaryABC.B.valueShare}%` }}
              className="bg-amber-500 transition-all"
              title={`Clase B: ${summaryABC.B.valueShare.toFixed(1)}%`}
            />
            <div
              style={{ width: `${summaryABC.C.valueShare}%` }}
              className="bg-slate-400 dark:bg-slate-600 transition-all"
              title={`Clase C: ${summaryABC.C.valueShare.toFixed(1)}%`}
            />
          </div>

          <div className="grid grid-cols-3 gap-2 pt-1 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-emerald-500" />
              <span>
                <b>Clase A:</b> {summaryABC.A.valueShare.toFixed(1)}% valor · {summaryABC.A.countShare.toFixed(1)}% {entityDim}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-amber-500" />
              <span>
                <b>Clase B:</b> {summaryABC.B.valueShare.toFixed(1)}% valor · {summaryABC.B.countShare.toFixed(1)}% {entityDim}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-slate-400" />
              <span>
                <b>Clase C:</b> {summaryABC.C.valueShare.toFixed(1)}% valor · {summaryABC.C.countShare.toFixed(1)}% {entityDim}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Dual-Axis Pareto Chart */}
      <Card size="sm">
        <CardHeader>
          <CardTitle>Curva de Pareto de doble eje ({entityDim})</CardTitle>
          <CardDescription className="text-xs">
            Barras: valor individual por elemento · Línea rosa: porcentaje acumulado (corte 80 % marcado)
          </CardDescription>
          <CardAction>
            <Button
              variant="outline"
              size="sm"
              className="h-7"
              onClick={() => {
                const url = chartRef.current?.toPngDataUrl();
                if (url) downloadDataUrl(`${baseName}-pareto-${entityDim}.png`, url);
              }}
            >
              <ImageDown className="size-3.5" />
              PNG
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 ml-1"
              onClick={() =>
                downloadTextFile(
                  `${baseName}-pareto-${entityDim}.csv`,
                  paretoToCsv(result),
                  'text/csv;charset=utf-8',
                )
              }
            >
              <Download className="size-3.5" />
              CSV
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <EChart
            ref={chartRef}
            option={paretoChartOption}
            ariaLabel={`Curva de Pareto de ${entityDim}`}
            className="h-80 w-full sm:h-96"
          />
        </CardContent>
      </Card>

      {/* Filterable Table of Items */}
      <Card size="sm">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle>Detalle de elementos rankeados</CardTitle>
              <CardDescription className="text-xs">
                {formatCount(filteredItems.length)} de {formatCount(result.items.length)} elementos
                {filteredItems.length > TABLE_LIMIT && ` · mostrados los primeros ${TABLE_LIMIT}`}
              </CardDescription>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="size-3.5 absolute left-2.5 top-2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Buscar elemento..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-7 w-40 rounded-md border border-input bg-transparent pl-8 pr-2 text-xs outline-none focus:border-primary"
                />
              </div>

              <div className="flex items-center rounded-md border p-0.5 text-xs bg-muted/20">
                <button
                  type="button"
                  onClick={() => setSelectedClass('all')}
                  className={cn(
                    'px-2 py-0.5 rounded-sm transition-colors',
                    selectedClass === 'all' && 'bg-background font-medium shadow-xs',
                  )}
                >
                  Todos
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedClass('A')}
                  className={cn(
                    'px-2 py-0.5 rounded-sm transition-colors text-emerald-700 dark:text-emerald-400',
                    selectedClass === 'A' && 'bg-background font-medium shadow-xs',
                  )}
                >
                  Clase A
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedClass('B')}
                  className={cn(
                    'px-2 py-0.5 rounded-sm transition-colors text-amber-700 dark:text-amber-400',
                    selectedClass === 'B' && 'bg-background font-medium shadow-xs',
                  )}
                >
                  Clase B
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedClass('C')}
                  className={cn(
                    'px-2 py-0.5 rounded-sm transition-colors text-slate-700 dark:text-slate-400',
                    selectedClass === 'C' && 'bg-background font-medium shadow-xs',
                  )}
                >
                  Clase C
                </button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="max-h-80 overflow-auto rounded-md border">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-card">
                <tr className="border-b">
                  <th scope="col" className="px-3 py-2 text-left font-medium w-16">Rango</th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">{entityDim}</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">{measureColumn}</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">% Cuota</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">% Acumulado</th>
                  <th scope="col" className="px-3 py-2 text-center font-medium w-24">Clase ABC</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.slice(0, TABLE_LIMIT).map((item) => (
                  <tr key={item.rank} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="px-3 py-1.5 font-mono text-xs text-muted-foreground">#{item.rank}</td>
                    <td className="px-3 py-1.5 font-medium max-w-64 truncate" title={item.entity}>
                      {item.entity}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {formatMetric(item.value, numFormat)}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {item.share.toFixed(2)} %
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums font-medium">
                      {item.cumulativeShare.toFixed(1)} %
                    </td>
                    <td className="px-3 py-1.5 text-center">
                      <ABCBadge cls={item.classABC} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ABCBadge({ cls }: { cls: ABCClass }) {
  if (cls === 'A') {
    return (
      <Badge variant="outline" className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-300 font-bold text-xs">
        Clase A
      </Badge>
    );
  }
  if (cls === 'B') {
    return (
      <Badge variant="outline" className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-300 font-semibold text-xs">
        Clase B
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="bg-slate-500/15 text-slate-700 dark:text-slate-400 border-slate-300 text-xs">
      Clase C
    </Badge>
  );
}

function Tile({
  label,
  value,
  hint,
  badge,
  badgeVariant,
}: {
  label: string;
  value: string;
  hint?: string;
  badge?: string;
  badgeVariant?: 'positive' | 'classA';
}) {
  return (
    <div className="rounded-md border p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{label}</p>
        {badge && (
          <Badge
            variant="outline"
            className={cn(
              'text-[10px] px-1 py-0 h-4',
              badgeVariant === 'positive' && 'bg-blue-500/10 text-blue-600 border-blue-200',
              badgeVariant === 'classA' && 'bg-emerald-500/10 text-emerald-700 border-emerald-200',
            )}
          >
            {badge}
          </Badge>
        )}
      </div>
      <p className="text-base font-semibold tabular-nums mt-0.5">{value}</p>
      {hint !== undefined && <p className="text-xs text-pretty text-muted-foreground truncate">{hint}</p>}
    </div>
  );
}
