import { useMemo, useRef, useState } from 'react';
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
import { formatCount, formatDelta, formatMetric } from '@/features/analysis/lib/format';
import { prepareRows } from '@/features/analysis/lib/prepare-rows';
import type { ParsedDataset } from '@/features/dataset/types';
import type { ColumnMappingState } from '@/features/mapping/use-column-mapping';
import { OptionSelect } from '../../components/option-select';
import {
  computeAnomalies,
  type AnomalySeverity,
} from '../lib/anomalies';
import { buildAnomaliesChartOption } from '../lib/anomalies-chart-option';
import { anomaliesToCsv } from '../lib/export-anomalies-csv';
import type { AnomaliesConfigState } from '../use-anomalies-config';

type TableFilter = 'todos' | 'anomalias' | 'picos' | 'caidas';
type SortKey = 'bucket' | 'actual' | 'expected' | 'diff' | 'score';

const SEVERITY_BADGE: Record<AnomalySeverity, { label: string; className: string }> = {
  critica: { label: 'Crítica', className: 'bg-rose-500/15 text-rose-700 dark:text-rose-400' },
  alta: { label: 'Alta', className: 'bg-orange-500/15 text-orange-700 dark:text-orange-400' },
  moderada: { label: 'Moderada', className: 'bg-amber-500/15 text-amber-700 dark:text-amber-400' },
  leve: { label: 'Leve', className: 'bg-muted text-muted-foreground' },
};

export function AnomaliesDashboard({
  dataset,
  mapping,
  state,
}: {
  dataset: ParsedDataset;
  mapping: ColumnMappingState;
  state: AnomaliesConfigState;
}) {
  const chartRef = useRef<EChartHandle>(null);
  const [tableFilter, setTableFilter] = useState<TableFilter>('anomalias');
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({
    key: 'diff',
    desc: true,
  });

  const { assignments } = state.slots;
  const dateColumn = assignments.fecha ?? null;
  const measure = assignments.metrica ?? null;
  const dimension = assignments.dimension ?? null;
  const currency = state.settings.currency;

  const prepared = useMemo(
    () => prepareRows(dataset.rows, mapping.columns, { dateColumn }, mapping.preserveInvalid),
    [dataset.rows, mapping.columns, mapping.preserveInvalid, dateColumn],
  );

  // Dimension distinct values for optional filtering
  const dimensionValues = useMemo(() => {
    if (dimension === null) return [];
    const set = new Set<string>();
    for (const row of prepared.rows) {
      const val = row.dims[dimension];
      if (val) set.add(val);
    }
    return Array.from(set).sort();
  }, [prepared.rows, dimension]);

  const result = useMemo(() => {
    if (dateColumn === null || measure === null) return null;
    return computeAnomalies(prepared.rows, {
      dateColumn,
      measure,
      dimensionFilter:
        dimension && state.settings.selectedDimensionValue
          ? { dimension, value: state.settings.selectedDimensionValue }
          : undefined,
      grain: state.settings.grain,
      method: state.settings.method,
      sensitivity: state.settings.sensitivity,
      windowSize: state.settings.windowSize,
    });
  }, [
    prepared.rows,
    dateColumn,
    measure,
    dimension,
    state.settings.selectedDimensionValue,
    state.settings.grain,
    state.settings.method,
    state.settings.sensitivity,
    state.settings.windowSize,
  ]);

  const filteredPoints = useMemo(() => {
    if (result === null) return [];
    let list = result.points;
    if (tableFilter === 'anomalias') {
      list = list.filter((p) => p.isAnomaly);
    } else if (tableFilter === 'picos') {
      list = list.filter((p) => p.type === 'pico');
    } else if (tableFilter === 'caidas') {
      list = list.filter((p) => p.type === 'caida');
    }
    return list;
  }, [result, tableFilter]);

  const sortedPoints = useMemo(() => {
    const list = [...filteredPoints];
    list.sort((a, b) => {
      let comp = 0;
      if (sort.key === 'bucket') {
        comp = a.bucket.localeCompare(b.bucket);
      } else {
        comp = Math.abs(a[sort.key]) - Math.abs(b[sort.key]);
      }
      return sort.desc ? -comp : comp;
    });
    return list;
  }, [filteredPoints, sort]);

  const chartOption = useMemo(() => {
    if (result === null) return null;
    return buildAnomaliesChartOption({ result, currency });
  }, [result, currency]);

  if (result === null) {
    return (
      <Alert role="status">
        <TriangleAlert className="size-4" />
        <AlertTitle>Faltan columnas</AlertTitle>
        <AlertDescription>
          Asegúrate de haber asignado una columna de fecha y una métrica numérica.
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
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Tile
            label="Puntos analizados"
            value={formatCount(summary.totalPoints)}
            hint={`Agrupación por ${state.settings.grain}`}
          />
          <Tile
            label="Anomalías detectadas"
            value={formatCount(summary.anomalyCount)}
            hint={`${summary.anomalyRate.toFixed(1)} % de la serie total`}
            highlight={summary.anomalyCount > 0 ? 'amber' : undefined}
          />
          <Tile
            label="Mayor pico inusual"
            value={summary.maxSpike ? `+${formatMetric(summary.maxSpike.diff, format)}` : 'Ninguno'}
            hint={summary.maxSpike ? `${summary.maxSpike.label} (Real: ${formatMetric(summary.maxSpike.actual, format)})` : undefined}
            highlight="red"
          />
          <Tile
            label="Mayor caída brusca"
            value={summary.maxDrop ? formatMetric(summary.maxDrop.diff, format) : 'Ninguna'}
            hint={summary.maxDrop ? `${summary.maxDrop.label} (Real: ${formatMetric(summary.maxDrop.actual, format)})` : undefined}
            highlight="red"
          />
        </CardContent>
      </Card>

      {/* Main Chart */}
      <Card size="sm">
        <CardHeader>
          <CardTitle>Evolución y detección de anomalías</CardTitle>
          <CardDescription className="text-xs">
            La franja sombreada representa el intervalo de normalidad estadística esperado.
          </CardDescription>
          <CardAction>
            <div className="flex flex-wrap items-center gap-2">
              {dimension && dimensionValues.length > 0 && (
                <div className="min-w-40">
                  <OptionSelect
                    value={state.settings.selectedDimensionValue ?? '__todos__'}
                    options={[
                      { value: '__todos__', label: `Todos los ${dimension}` },
                      ...dimensionValues.map((v) => ({ value: v, label: v })),
                    ]}
                    size="sm"
                    ariaLabel="Filtrar por dimensión"
                    onChange={(val) =>
                      state.update({
                        selectedDimensionValue: val === '__todos__' ? null : val,
                      })
                    }
                  />
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                className="h-7"
                onClick={() => {
                  const dataUrl = chartRef.current?.toPngDataUrl();
                  if (dataUrl != null) downloadDataUrl(`${baseName}-anomalias.png`, dataUrl);
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
                    `${baseName}-anomalias.csv`,
                    anomaliesToCsv(result),
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
              ariaLabel="Gráfico de serie temporal con detección de anomalías"
              className="min-h-80 w-full sm:min-h-96"
            />
          )}
        </CardContent>
      </Card>

      {/* Table Card */}
      <Card size="sm">
        <CardHeader>
          <CardTitle>Tabla de puntos y anomalías</CardTitle>
          <CardDescription className="text-xs">
            {formatCount(sortedPoints.length)} puntos en la vista actual.
          </CardDescription>
          <CardAction>
            <div className="flex items-center gap-1">
              {(['anomalias', 'todos', 'picos', 'caidas'] as TableFilter[]).map((f) => (
                <Button
                  key={f}
                  variant={tableFilter === f ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-7 text-xs capitalize"
                  onClick={() => setTableFilter(f)}
                >
                  {f === 'anomalias'
                    ? 'Solo anomalías'
                    : f === 'todos'
                      ? 'Todos los puntos'
                      : f === 'picos'
                        ? 'Picos'
                        : 'Caídas'}
                </Button>
              ))}
            </div>
          </CardAction>
        </CardHeader>
        <CardContent>
          {sortedPoints.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No se han detectado anomalías con los filtros actuales.
            </p>
          ) : (
            <div className="max-h-96 overflow-auto rounded-md border">
              <table className="w-full border-collapse text-sm">
                <thead className="sticky top-0 z-10 bg-card">
                  <tr className="border-b">
                    <Th label="Período" sortKey="bucket" sort={sort} onSort={setSort} align="left" />
                    <Th label="Valor Real" sortKey="actual" sort={sort} onSort={setSort} align="right" />
                    <Th label="Valor Esperado" sortKey="expected" sort={sort} onSort={setSort} align="right" />
                    <Th label="Desviación" sortKey="diff" sort={sort} onSort={setSort} align="right" />
                    <th scope="col" className="px-2 py-2 text-right font-medium">
                      Desv %
                    </th>
                    <th scope="col" className="px-2 py-2 text-center font-medium">
                      Tipo
                    </th>
                    <th scope="col" className="px-2 py-2 text-center font-medium">
                      Severidad
                    </th>
                    <Th label="Z-Score" sortKey="score" sort={sort} onSort={setSort} align="right" />
                  </tr>
                </thead>
                <tbody>
                  {sortedPoints.map((p) => {
                    const badge = SEVERITY_BADGE[p.severity];
                    return (
                      <tr key={p.bucket} className="border-b last:border-0 hover:bg-muted/40">
                        <td className="px-2 py-1.5 font-medium whitespace-nowrap">
                          {p.label} <span className="text-xs text-muted-foreground">({p.bucket})</span>
                        </td>
                        <td className="px-2 py-1.5 text-right font-medium tabular-nums">
                          {formatMetric(p.actual, format)}
                        </td>
                        <td className="px-2 py-1.5 text-right text-muted-foreground tabular-nums">
                          {formatMetric(p.expected, format)}
                        </td>
                        <td
                          className={cn(
                            'px-2 py-1.5 text-right font-medium tabular-nums',
                            p.diff > 0
                              ? 'text-rose-600 dark:text-rose-400'
                              : p.diff < 0
                                ? 'text-orange-600 dark:text-orange-400'
                                : 'text-muted-foreground',
                          )}
                        >
                          {p.diff > 0 ? `+${formatMetric(p.diff, format)}` : formatMetric(p.diff, format)}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-xs">
                          {formatDelta(p.diffPct)}
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          {p.isAnomaly ? (
                            <Badge
                              variant="outline"
                              className={cn(
                                'text-xs',
                                p.type === 'pico'
                                  ? 'bg-rose-500/15 text-rose-700 dark:text-rose-400'
                                  : 'bg-orange-500/15 text-orange-700 dark:text-orange-400',
                              )}
                            >
                              {p.type === 'pico' ? 'Pico' : 'Caída'}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">Normal</span>
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          {p.isAnomaly && (
                            <Badge variant="outline" className={cn('text-xs', badge.className)}>
                              {badge.label}
                            </Badge>
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-xs font-mono">
                          {p.score.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
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
            desc: sort.key === sortKey ? !sort.desc : true,
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
  highlight?: 'red' | 'amber';
}) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground truncate" title={label}>
        {label}
      </p>
      <p
        className={cn(
          'mt-1 text-lg font-semibold tabular-nums',
          highlight === 'red' && 'text-rose-600 dark:text-rose-400',
          highlight === 'amber' && 'text-amber-600 dark:text-amber-400',
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground truncate">{hint}</p>}
    </div>
  );
}
