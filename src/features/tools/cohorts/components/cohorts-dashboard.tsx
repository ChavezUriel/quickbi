import { useMemo, useRef, useState } from 'react';
import { Download, Flame, ImageDown, TriangleAlert, Users } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
import { computeCohorts } from '../lib/cohorts';
import { buildCohortsDecayChartOption } from '../lib/cohorts-chart-option';
import { cohortsToCsv } from '../lib/export-cohorts-csv';
import type { CohortsConfigState } from '../use-cohorts-config';

export function CohortsDashboard({
  dataset,
  mapping,
  state,
}: {
  dataset: ParsedDataset;
  mapping: ColumnMappingState;
  state: CohortsConfigState;
}) {
  const chartRef = useRef<EChartHandle>(null);
  const [metricType, setMetricType] = useState<'clientes' | 'ingresos'>(state.settings.metricType);
  const [displayMode, setDisplayMode] = useState<'porcentaje' | 'absoluto'>(state.settings.displayMode);

  const { assignments } = state.slots;
  const customerDim = assignments.cliente ?? null;
  const dateColumn = assignments.fecha ?? null;
  const amountColumn = assignments.importe ?? null;
  const currency = state.settings.currency;

  const prepared = useMemo(
    () => prepareRows(dataset.rows, mapping.columns, { dateColumn }, mapping.preserveInvalid),
    [dataset.rows, mapping.columns, mapping.preserveInvalid, dateColumn],
  );

  const result = useMemo(() => {
    if (customerDim === null || amountColumn === null || dateColumn === null) return null;
    return computeCohorts(prepared.rows, {
      customerDim,
      dateColumn,
      amountColumn,
      grain: state.settings.grain,
    });
  }, [prepared.rows, customerDim, dateColumn, amountColumn, state.settings.grain]);

  const chartOption = useMemo(() => {
    if (result === null) return null;
    return buildCohortsDecayChartOption({ result, metricType });
  }, [result, metricType]);

  if (result === null) {
    return (
      <Alert role="status">
        <TriangleAlert className="size-4" />
        <AlertTitle>Faltan columnas</AlertTitle>
        <AlertDescription>
          Asegúrate de haber asignado las columnas de Cliente, Fecha de compra e Importe.
        </AlertDescription>
      </Alert>
    );
  }

  const format = { format: 'moneda' as const, currency };
  const baseName = dataset.fileName.replace(/\.[^.]+$/, '');
  const { summary } = result;

  const maxPeriodsToShow = Math.min(result.maxPeriods, 15);
  const prefix = result.grain === 'mes' ? 'M' : result.grain === 'semana' ? 'S' : 'T';

  return (
    <div className="space-y-3">
      {/* KPI Cards */}
      <Card size="sm">
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Tile
            label="Cohortes analizadas"
            value={formatCount(summary.totalCohorts)}
            hint={`${formatCount(summary.totalCustomers)} clientes totales`}
          />
          <Tile
            label={`Retención ${prefix}1 promedio`}
            value={summary.avgM1CustomerRetention !== null ? `${summary.avgM1CustomerRetention.toFixed(1)} %` : '—'}
            hint="Repiten al siguiente período"
            highlight={summary.avgM1CustomerRetention && summary.avgM1CustomerRetention > 30 ? 'green' : undefined}
          />
          <Tile
            label={`Retención ${prefix}3 promedio`}
            value={summary.avgM3CustomerRetention !== null ? `${summary.avgM3CustomerRetention.toFixed(1)} %` : '—'}
            hint="Repiten tras 3 períodos"
          />
          <Tile
            label={`Retención ${prefix}6 promedio`}
            value={summary.avgM6CustomerRetention !== null ? `${summary.avgM6CustomerRetention.toFixed(1)} %` : '—'}
            hint="Repiten tras 6 períodos"
          />
          <Tile
            label="Mejor Cohorte"
            value={summary.bestCohort ? summary.bestCohort.cohortLabel : '—'}
            hint={summary.bestCohort ? `${summary.bestCohort.m1Rate.toFixed(1)} % retención ${prefix}1` : undefined}
            highlight="amber"
          />
        </CardContent>
      </Card>

      {/* Decay Curve Chart */}
      <Card size="sm">
        <CardHeader>
          <CardTitle>Curvas de decaimiento de retención</CardTitle>
          <CardDescription className="text-xs">
            Evolución de la tasa de retención período a período para las cohortes recientes vs el promedio.
          </CardDescription>
          <CardAction>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center rounded-lg border bg-muted/30 p-0.5">
                <Button
                  variant={metricType === 'clientes' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-6 text-xs"
                  onClick={() => setMetricType('clientes')}
                >
                  <Users className="mr-1 size-3" />
                  Clientes
                </Button>
                <Button
                  variant={metricType === 'ingresos' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-6 text-xs"
                  onClick={() => setMetricType('ingresos')}
                >
                  <Flame className="mr-1 size-3" />
                  Ingresos
                </Button>
              </div>

              <Button
                variant="outline"
                size="sm"
                className="h-7"
                onClick={() => {
                  const dataUrl = chartRef.current?.toPngDataUrl();
                  if (dataUrl != null) downloadDataUrl(`${baseName}-cohortes-curva.png`, dataUrl);
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
                    `${baseName}-cohortes.csv`,
                    cohortsToCsv(result, metricType, displayMode),
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
              ariaLabel="Gráfico de decaimiento de cohortes"
              className="min-h-72 w-full sm:min-h-80"
            />
          )}
        </CardContent>
      </Card>

      {/* Heatmap Matrix Table */}
      <Card size="sm">
        <CardHeader>
          <CardTitle>Matriz de calor de retención</CardTitle>
          <CardDescription className="text-xs">
            Cada fila es una cohorte por fecha de primera compra; las columnas muestran la retención en los períodos posteriores.
          </CardDescription>
          <CardAction>
            <div className="flex items-center rounded-lg border bg-muted/30 p-0.5">
              <Button
                variant={displayMode === 'porcentaje' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-6 text-xs"
                onClick={() => setDisplayMode('porcentaje')}
              >
                % Retención
              </Button>
              <Button
                variant={displayMode === 'absoluto' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-6 text-xs"
                onClick={() => setDisplayMode('absoluto')}
              >
                Absoluto ({metricType === 'clientes' ? 'Clientes' : 'Importe'})
              </Button>
            </div>
          </CardAction>
        </CardHeader>
        <CardContent>
          <div className="max-h-[32rem] overflow-auto rounded-md border">
            <table className="w-full border-collapse text-xs">
              <thead className="sticky top-0 z-20 bg-card shadow-xs">
                <tr className="border-b">
                  <th scope="col" className="sticky left-0 z-30 bg-card px-2.5 py-2 text-left font-medium whitespace-nowrap">
                    Cohorte
                  </th>
                  <th scope="col" className="px-2 py-2 text-right font-medium whitespace-nowrap">
                    {metricType === 'clientes' ? 'Clientes M0' : 'Ingreso M0'}
                  </th>
                  {Array.from({ length: maxPeriodsToShow }).map((_, pIdx) => (
                    <th key={pIdx} scope="col" className="min-w-14 px-1.5 py-2 text-center font-medium whitespace-nowrap">
                      {prefix}
                      {pIdx}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.cohorts.map((cohort) => (
                  <tr key={cohort.cohort} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="sticky left-0 z-10 bg-card px-2.5 py-1.5 font-medium whitespace-nowrap">
                      {cohort.cohortLabel}
                    </td>
                    <td className="px-2 py-1.5 text-right font-medium tabular-nums text-muted-foreground whitespace-nowrap">
                      {metricType === 'clientes'
                        ? formatCount(cohort.initialCustomers)
                        : formatMetric(cohort.initialRevenue, format)}
                    </td>

                    {Array.from({ length: maxPeriodsToShow }).map((_, pIdx) => {
                      const cell = cohort.periods[pIdx];
                      if (!cell || !cell.hasData) {
                        return (
                          <td key={pIdx} className="bg-muted/10 px-1 py-1.5 text-center text-muted-foreground/30">
                            ·
                          </td>
                        );
                      }

                      const rate = metricType === 'clientes' ? cell.customerRetentionRate : cell.revenueRetentionRate;
                      const intensity = Math.min(100, Math.max(0, rate));

                      return (
                        <td
                          key={pIdx}
                          className="px-1 py-1.5 text-center tabular-nums transition-colors"
                          style={{
                            backgroundColor: `color-mix(in oklch, var(--primary) ${(intensity * 0.65).toFixed(1)}%, transparent)`,
                          }}
                          title={`Cohorte ${cohort.cohortLabel} · ${prefix}${pIdx}: ${cell.activeCustomers} clientes (${formatShare(cell.customerRetentionRate)}) · ${formatMetric(cell.revenue, format)}`}
                        >
                          <span
                            className={cn(
                              'font-medium',
                              intensity > 40 ? 'text-primary-foreground font-semibold' : 'text-foreground',
                            )}
                          >
                            {displayMode === 'porcentaje'
                              ? `${rate.toFixed(0)}%`
                              : metricType === 'clientes'
                                ? formatCount(cell.activeCustomers)
                                : formatMetric(cell.revenue, { ...format, compact: true })}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}

                {/* Benchmark Row */}
                <tr className="border-t-2 border-primary/30 bg-muted/40 font-semibold">
                  <td className="sticky left-0 z-10 bg-muted/40 px-2.5 py-2 font-bold whitespace-nowrap">
                    Promedio Cartera
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">
                    —
                  </td>
                  {Array.from({ length: maxPeriodsToShow }).map((_, pIdx) => {
                    const avg = result.averageCurve.find((a) => a.periodIndex === pIdx);
                    if (!avg) {
                      return (
                        <td key={pIdx} className="px-1 py-2 text-center text-muted-foreground/30">
                          ·
                        </td>
                      );
                    }

                    const rate = metricType === 'clientes' ? avg.avgCustomerRetentionRate : avg.avgRevenueRetentionRate;

                    return (
                      <td key={pIdx} className="px-1 py-2 text-center font-bold tabular-nums">
                        {rate.toFixed(0)}%
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
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
  highlight?: 'green' | 'amber';
}) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground truncate" title={label}>
        {label}
      </p>
      <p
        className={cn(
          'mt-1 text-lg font-semibold tabular-nums',
          highlight === 'green' && 'text-emerald-600 dark:text-emerald-400',
          highlight === 'amber' && 'text-amber-600 dark:text-amber-400',
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground truncate">{hint}</p>}
    </div>
  );
}
