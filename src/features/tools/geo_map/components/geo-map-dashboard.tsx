import { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Download,
  Globe,
  ImageDown,
  LayoutGrid,
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
import { formatCount, formatMetric } from '@/features/analysis/lib/format';
import { prepareRows } from '@/features/analysis/lib/prepare-rows';
import type { ParsedDataset } from '@/features/dataset/types';
import type { ColumnMappingState } from '@/features/mapping/use-column-mapping';
import { geoMapToCsv } from '../lib/export-geo-map-csv';
import { computeGeoMap, type GeoMapResult } from '../lib/geo_map';
import type { GeoMapConfigState } from '../use-geo-map-config';

export function GeoMapDashboard({
  dataset,
  mapping,
  state,
}: {
  dataset: ParsedDataset;
  mapping: ColumnMappingState;
  state: GeoMapConfigState;
}) {
  const chartRef = useRef<EChartHandle>(null);
  const [visualMode, setVisualMode] = useState<'bar' | 'treemap'>('bar');
  const [selectedZone, setSelectedZone] = useState<string | null>(null);

  const { assignments } = state.slots;
  const territoryDim = assignments.territorio ?? null;
  const metricColumn = assignments.metrica ?? null;
  const secondaryColumn = assignments.secundaria ?? null;
  const { aggregation, format, currency, topN } = state.settings;

  const prepared = useMemo(
    () => prepareRows(dataset.rows, mapping.columns, { dateColumn: null }, mapping.preserveInvalid),
    [dataset.rows, mapping.columns, mapping.preserveInvalid],
  );

  const result: GeoMapResult | null = useMemo(() => {
    if (territoryDim === null || metricColumn === null) return null;
    return computeGeoMap(prepared.rows, {
      territoryDim,
      metricColumn,
      secondaryColumn,
      aggregation,
      topN,
    });
  }, [prepared.rows, territoryDim, metricColumn, secondaryColumn, aggregation, topN]);

  const territories = useMemo(() => result?.territories ?? [], [result]);
  const summary = result?.summary;
  const empty = territories.length === 0;

  // Filtrado por zona seleccionada
  const filteredTerritories = useMemo(() => {
    if (selectedZone === null) return territories;
    return territories.filter((t) => t.zone === selectedZone);
  }, [territories, selectedZone]);

  // Lista de zonas únicas
  const zones = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of territories) {
      counts.set(t.zone, (counts.get(t.zone) ?? 0) + t.value);
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [territories]);

  // Opción de ECharts
  const chartOption = useMemo(() => {
    if (empty) return {};

    const topItems = territories.slice(0, 15);

    if (visualMode === 'treemap') {
      const treemapData = topItems.map((item) => ({
        name: `${item.normalizedName}\n(${item.share}%)`,
        value: item.value,
      }));

      return {
        tooltip: {
          formatter: (params: any) => {
            return `<div class="text-xs font-sans"><b>${params.name}</b><br/>Valor: ${formatMetric(params.value, { format, currency })}</div>`;
          },
        },
        series: [
          {
            name: 'Territorios',
            type: 'treemap',
            roam: false,
            nodeClick: false,
            breadcrumb: { show: false },
            label: {
              show: true,
              fontSize: 11,
              fontWeight: 500,
            },
            data: treemapData,
          },
        ],
      };
    }

    // Modo barras horizontales ordenadas
    const reversed = [...topItems].reverse();
    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: any) => {
          const p = params[0];
          const item = territories.find((t) => t.normalizedName === p.name || t.territory === p.name);
          return `
            <div class="text-xs font-sans">
              <div class="font-bold border-b pb-1 mb-1">${p.name}</div>
              <div>Valor: <b>${formatMetric(p.value, { format, currency })}</b></div>
              ${item ? `<div>Participación: <b>${item.share} %</b></div>` : ''}
              ${item ? `<div>Registros: <b>${formatCount(item.rowCount)}</b></div>` : ''}
            </div>
          `;
        },
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        top: '3%',
        containLabel: true,
      },
      xAxis: {
        type: 'value',
        axisLabel: {
          formatter: (val: number) => formatMetric(val, { format, currency, compact: true }),
        },
      },
      yAxis: {
        type: 'category',
        data: reversed.map((t) => t.normalizedName),
        axisLabel: {
          fontSize: 11,
        },
      },
      series: [
        {
          name: 'Valor',
          type: 'bar',
          data: reversed.map((t) => t.value),
          itemStyle: {
            borderRadius: [0, 4, 4, 0],
            color: '#3b82f6',
          },
          label: {
            show: true,
            position: 'right',
            formatter: (params: any) =>
              formatMetric(params.value, { format, currency, compact: true }),
            fontSize: 11,
          },
        },
      ],
    };
  }, [territories, visualMode, empty, format, currency]);

  if (empty || summary == null) {
    return (
      <Alert role="status">
        <AlertTriangle className="size-4" />
        <AlertTitle>Sin datos territoriales</AlertTitle>
        <AlertDescription>
          Selecciona una columna de territorio y una métrica numérica para calcular la distribución geográfica.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Barra de herramientas */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="gap-1.5 py-1">
            <Globe className="size-3.5 text-primary" />
            <span>{summary.territoryCount} territorios</span>
          </Badge>
          <div className="flex items-center rounded-lg border bg-muted/40 p-0.5 text-xs">
            <Button
              variant={visualMode === 'bar' ? 'default' : 'ghost'}
              size="sm"
              className="h-7 px-2.5 text-xs"
              onClick={() => setVisualMode('bar')}
            >
              <BarChart3 className="mr-1 size-3.5" />
              Barras
            </Button>
            <Button
              variant={visualMode === 'treemap' ? 'default' : 'ghost'}
              size="sm"
              className="h-7 px-2.5 text-xs"
              onClick={() => setVisualMode('treemap')}
            >
              <LayoutGrid className="mr-1 size-3.5" />
              Treemap
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => {
              const dataUrl = chartRef.current?.toPngDataUrl();
              if (dataUrl) downloadDataUrl('mapa-territorial.png', dataUrl);
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
                  'analisis-territorial.csv',
                  geoMapToCsv(result),
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
            <CardDescription>Volumen territorial total</CardDescription>
            <CardTitle className="text-xl">
              {formatMetric(summary.totalValue, { format, currency })}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardDescription>Territorios activos</CardDescription>
            <CardTitle className="text-xl font-bold">
              {formatCount(summary.territoryCount)}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardDescription>Territorio líder</CardDescription>
            <CardTitle className="truncate text-base font-semibold text-primary">
              {summary.topTerritory?.normalizedName ?? '—'}
            </CardTitle>
            {summary.topTerritory && (
              <p className="text-xs text-muted-foreground">
                {summary.topTerritory.share} % del total ({formatMetric(summary.topTerritory.value, { format, currency })})
              </p>
            )}
          </CardHeader>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardDescription>Concentración Top 3</CardDescription>
            <CardTitle className="text-xl font-bold text-sky-600 dark:text-sky-400">
              {summary.top3Concentration} %
            </CardTitle>
          </CardHeader>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardDescription>Promedio por territorio</CardDescription>
            <CardTitle className="text-xl text-muted-foreground">
              {formatMetric(summary.avgPerTerritory, { format, currency })}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Zonas y Gráfico */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Gráfico principal */}
        <Card className="lg:col-span-8">
          <CardHeader>
            <CardTitle>Distribución territorial</CardTitle>
            <CardDescription>
              Comparativa de volumen por regiones y entidades territoriales.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-84 w-full">
              <EChart
                ref={chartRef}
                option={chartOption}
                ariaLabel="Gráfico territorial"
              />
            </div>
          </CardContent>
        </Card>

        {/* Reparto por Zonas Geográficas */}
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>Zonas identificadas</CardTitle>
            <CardDescription>
              Agrupación automática por macro-regiones y zonas geográficas.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5">
            <div className="flex flex-wrap gap-1.5 pb-2">
              <Button
                variant={selectedZone === null ? 'default' : 'outline'}
                size="sm"
                className="h-6 text-xs"
                onClick={() => setSelectedZone(null)}
              >
                Todas ({territories.length})
              </Button>
              {zones.map(([zoneName, _val]) => (
                <Button
                  key={zoneName}
                  variant={selectedZone === zoneName ? 'default' : 'outline'}
                  size="sm"
                  className="h-6 text-xs"
                  onClick={() => setSelectedZone(zoneName === selectedZone ? null : zoneName)}
                >
                  {zoneName}
                </Button>
              ))}
            </div>

            <div className="space-y-2">
              {zones.slice(0, 6).map(([zoneName, zoneVal]) => {
                const zoneShare = summary.totalValue > 0 ? (zoneVal / summary.totalValue) * 100 : 0;
                return (
                  <div key={zoneName} className="rounded-lg border bg-muted/20 p-2.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{zoneName}</span>
                      <span className="font-mono font-semibold">
                        {formatMetric(zoneVal, { format, currency })}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>{Math.round(zoneShare * 10) / 10} % del total</span>
                    </div>
                    <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${Math.min(100, Math.max(2, zoneShare))}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabla detallada de territorios */}
      <Card>
        <CardHeader>
          <CardTitle>Desglose por territorio</CardTitle>
          <CardDescription>
            Ranking y métricas detalladas para cada territorio registrado.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-muted/30 text-xs font-medium text-muted-foreground">
              <tr>
                <th className="py-2.5 pl-3 pr-2">Rank</th>
                <th className="px-3 py-2.5">Territorio</th>
                <th className="px-3 py-2.5">Zona / Región</th>
                <th className="px-3 py-2.5 text-right">Valor</th>
                <th className="px-3 py-2.5 text-right">% Del Total</th>
                <th className="px-3 py-2.5 text-right">% Acumulado</th>
                <th className="px-3 py-2.5 text-right">Registros</th>
                <th className="py-2.5 pl-3 pr-4 text-right">Promedio / Reg</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filteredTerritories.map((t) => (
                <tr key={t.territory} className="hover:bg-muted/40 transition-colors">
                  <td className="py-2 pl-3 pr-2 font-mono text-xs text-muted-foreground">
                    #{t.rank}
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{t.normalizedName}</div>
                    {t.territory !== t.normalizedName && (
                      <div className="text-[11px] text-muted-foreground">({t.territory})</div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    <Badge variant="outline" className="text-[11px]">
                      {t.zone}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-right font-mono font-medium">
                    {formatMetric(t.value, { format, currency })}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    <span className="inline-block rounded px-1.5 py-0.5 bg-primary/10 text-primary">
                      {t.share} %
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-muted-foreground">
                    {t.cumulativeShare} %
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-muted-foreground">
                    {formatCount(t.rowCount)}
                  </td>
                  <td className="py-2 pl-3 pr-4 text-right font-mono text-muted-foreground">
                    {formatMetric(t.avgPerRecord, { format, currency })}
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
