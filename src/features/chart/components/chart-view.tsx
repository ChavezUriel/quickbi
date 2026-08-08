import { useMemo, useRef } from 'react';
import { Download, TriangleAlert } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ColumnProfile } from '@/features/dataset/lib/column-types';
import type { ParsedDataset } from '@/features/dataset/types';
import {
  AGGREGATION_LABEL,
  AGGREGATION_PHRASE,
  AGGREGATIONS,
} from '@/features/mapping/labels';
import { isMappingComplete, needsMeasure, type Aggregation } from '@/features/mapping/types';
import type { ColumnMappingState } from '@/features/mapping/use-column-mapping';
import {
  GRANULARITY_LABEL,
  SORTS,
  SORT_LABEL,
  TOP_N_OPTIONS,
  topNLabel,
} from '../labels';
import { aggregate } from '../lib/aggregate';
import { buildChartOption } from '../lib/chart-option';
import { downloadDataUrl, downloadTextFile } from '../lib/download';
import { aggregateToCsv } from '../lib/export-csv';
import type { CategorySort, DateGranularity } from '../types';
import { useChartConfig } from '../use-chart-config';
import { ChartTable } from './chart-table';
import { ChartTypePicker } from './chart-type-picker';
import { EChart, type EChartHandle } from './echart';

const MAX_READABLE_CATEGORIES = 50;

interface ChartViewProps {
  dataset: ParsedDataset;
  /** Estado del mapeo: columnas con los tipos ya corregidos y la selección. */
  state: ColumnMappingState;
}

/**
 * Paso final: configura y representa la agregación de datos en un gráfico.
 */
export function ChartView({ dataset, state }: ChartViewProps) {
  const {
    columns,
    dimensions,
    measures,
    mapping,
    setDimension,
    setMeasure,
    setAggregation,
  } = state;

  const dimension = columns.find((column) => column.name === mapping.dimension);
  const measure = columns.find((column) => column.name === mapping.measure) ?? null;
  const config = useChartConfig(dimension);
  const chartRef = useRef<EChartHandle>(null);

  const complete = isMappingComplete(mapping) && dimension !== undefined;
  const showMeasure = needsMeasure(mapping.aggregation);

  const result = useMemo(() => {
    if (!complete || dimension === undefined) return null;
    return aggregate(dataset.rows, {
      dimension,
      measure,
      aggregation: mapping.aggregation,
      granularity: config.granularity,
      sort: config.sort,
      topN: config.topN,
    });
  }, [
    complete,
    dataset.rows,
    dimension,
    measure,
    mapping.aggregation,
    config.granularity,
    config.sort,
    config.topN,
  ]);

  const title =
    complete && dimension !== undefined
      ? `${capitalize(
          measure === null
            ? AGGREGATION_PHRASE[mapping.aggregation]
            : `${AGGREGATION_PHRASE[mapping.aggregation]} ${measure.name}`,
        )} por ${dimension.name}`
      : '';

  const valueName =
    measure === null
      ? 'Número de filas'
      : `${AGGREGATION_LABEL[mapping.aggregation]} de ${measure.name}`;

  const option = useMemo(
    () =>
      result === null ? null : buildChartOption(result, config.chartType, { title, valueName }),
    [result, config.chartType, title, valueName],
  );

  const baseName = dataset.fileName.replace(/\.[^.]+$/, '');

  const exportPng = () => {
    const dataUrl = chartRef.current?.toPngDataUrl();
    if (dataUrl !== null && dataUrl !== undefined) {
      downloadDataUrl(`${baseName}-grafico.png`, dataUrl);
    }
  };

  const exportCsv = () => {
    if (result === null || dimension === undefined) return;
    downloadTextFile(
      `${baseName}-agregado.csv`,
      aggregateToCsv(result, dimension.name, valueName),
      'text/csv;charset=utf-8',
    );
  };

  return (
    <div className="space-y-4">
      {/* 1. Configuración del gráfico (Dimensión, Agregación, Medida) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Configuración del gráfico</CardTitle>
          <CardDescription>
            Elige qué se agrupa (dimensión) y qué se agrega (medida).
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-4">
            <Field label="Dimensión" hint="Agrupa las filas">
              <ColumnSelect
                value={mapping.dimension}
                columns={dimensions}
                onChange={setDimension}
                ariaLabel="Columna de dimensión"
                emptyLabel="Sin columnas agrupables"
              />
            </Field>

            <Field label="Agregación" hint="Cómo se combinan los valores">
              <Select
                value={mapping.aggregation}
                onValueChange={(value: Aggregation | null) => {
                  if (value !== null) setAggregation(value);
                }}
                items={AGGREGATIONS.map((aggregation) => ({
                  value: aggregation,
                  label: AGGREGATION_LABEL[aggregation],
                }))}
              >
                <SelectTrigger aria-label="Agregación">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AGGREGATIONS.map((aggregation) => (
                    <SelectItem key={aggregation} value={aggregation}>
                      {AGGREGATION_LABEL[aggregation]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            {showMeasure && (
              <Field label="Medida" hint="Columna numérica a agregar">
                <ColumnSelect
                  value={mapping.measure}
                  columns={measures}
                  onChange={setMeasure}
                  ariaLabel="Columna de medida"
                  emptyLabel="Sin columnas numéricas"
                />
              </Field>
            )}
          </div>

          <MappingSummary
            dataset={dataset}
            dimension={dimension}
            measureName={mapping.measure}
            aggregation={mapping.aggregation}
            complete={complete}
            hasDimensions={dimensions.length > 0}
            hasMeasures={measures.length > 0}
          />
        </CardContent>
      </Card>

      {/* 2. Visualización y controles adicionales (si el mapeo está completo) */}
      {complete && dimension !== undefined && result !== null && option !== null && (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="space-y-1.5">
                <CardTitle className="text-lg">Gráfico</CardTitle>
                <CardDescription>{title}</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={exportPng}>
                  <Download />
                  PNG
                </Button>
                <Button variant="outline" size="sm" onClick={exportCsv}>
                  <Download />
                  CSV
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            <Field label="Tipo de gráfico" hint="Cómo se representa">
              <ChartTypePicker
                value={config.chartType}
                available={config.availableChartTypes}
                onChange={config.setChartType}
              />
            </Field>

            <div className="flex flex-wrap items-end gap-4 pt-2 border-t">
              {dimension.type === 'date' && (
                <Field label="Agrupar por" hint="Nivel de la fecha">
                  <Select
                    value={config.granularity}
                    onValueChange={(value: DateGranularity | null) => {
                      if (value !== null) config.setGranularity(value);
                    }}
                    items={(['day', 'week', 'month', 'quarter', 'year'] as const).map((granularity) => ({
                      value: granularity,
                      label: GRANULARITY_LABEL[granularity],
                    }))}
                  >
                    <SelectTrigger aria-label="Granularidad de la fecha">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(['day', 'week', 'month', 'quarter', 'year'] as const).map((granularity) => (
                        <SelectItem key={granularity} value={granularity}>
                          {GRANULARITY_LABEL[granularity]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}

              <Field label="Orden" hint="De las categorías">
                <Select
                  value={config.sort}
                  onValueChange={(value: CategorySort | null) => {
                    if (value !== null) config.setSort(value);
                  }}
                  items={SORTS.map((sort) => ({ value: sort, label: SORT_LABEL[sort] }))}
                >
                  <SelectTrigger aria-label="Orden de las categorías">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SORTS.map((sort) => (
                      <SelectItem key={sort} value={sort}>
                        {SORT_LABEL[sort]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              {dimension.type !== 'date' && (
                <Field label="Categorías" hint="El resto se pliega en «Otros»">
                  <Select
                    value={config.topN === null ? 'all' : String(config.topN)}
                    onValueChange={(value: string | null) => {
                      if (value !== null) {
                        config.setTopN(value === 'all' ? null : Number(value));
                      }
                    }}
                    items={TOP_N_OPTIONS.map((topN) => ({
                      value: topN === null ? 'all' : String(topN),
                      label: topNLabel(topN),
                    }))}
                  >
                    <SelectTrigger aria-label="Número de categorías visibles">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TOP_N_OPTIONS.map((topN) => (
                        <SelectItem key={topN ?? 'all'} value={topN === null ? 'all' : String(topN)}>
                          {topNLabel(topN)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}
            </div>

            {result.rows.length === 0 ? (
              <Alert role="status">
                <TriangleAlert className="size-4" />
                <AlertTitle>No hay nada que representar</AlertTitle>
                <AlertDescription>
                  Ninguna de las {result.totalRows.toLocaleString('es-ES')} filas tiene la
                  dimensión y la medida convertibles a los tipos elegidos. Revisa los tipos en
                  el paso de mapeo.
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <EChart
                  ref={chartRef}
                  option={option}
                  ariaLabel={title}
                  className="h-96 w-full"
                />

                {result.excludedCount > 0 && (
                  <p className="text-sm text-muted-foreground">
                    {result.excludedCount.toLocaleString('es-ES')} de{' '}
                    {result.totalRows.toLocaleString('es-ES')} filas no se han representado:
                    su dimensión o su medida no son convertibles al tipo elegido.
                  </p>
                )}

                <ChartTable
                  result={result}
                  dimensionHeader={dimension.name}
                  valueHeader={valueName}
                />
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/** Mismo patrón que en el mapeo: etiqueta + pista + control. */
function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="space-y-0.5">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      {children}
    </div>
  );
}

function ColumnSelect({
  value,
  columns,
  onChange,
  ariaLabel,
  emptyLabel,
}: {
  value: string | null;
  columns: readonly ColumnProfile[];
  onChange: (name: string) => void;
  ariaLabel: string;
  emptyLabel: string;
}) {
  if (columns.length === 0) {
    return (
      <p className="flex h-8 items-center text-sm text-muted-foreground">{emptyLabel}</p>
    );
  }

  return (
    <Select
      value={value}
      onValueChange={(next: string | null) => {
        if (next !== null) onChange(next);
      }}
      items={columns.map((column) => ({ value: column.name, label: column.name }))}
    >
      <SelectTrigger aria-label={ariaLabel}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {columns.map((column) => (
          <SelectItem key={column.name} value={column.name}>
            {column.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function MappingSummary({
  dataset,
  dimension,
  measureName,
  aggregation,
  complete,
  hasDimensions,
  hasMeasures,
}: {
  dataset: ParsedDataset;
  dimension: ColumnProfile | undefined;
  measureName: string | null;
  aggregation: Aggregation;
  complete: boolean;
  hasDimensions: boolean;
  hasMeasures: boolean;
}) {
  if (!complete) {
    return (
      <Alert variant="destructive" role="status">
        <TriangleAlert className="size-4" />
        <AlertTitle>Todavía no se puede representar</AlertTitle>
        <AlertDescription>
          {!hasDimensions
            ? 'Ninguna columna sirve para agrupar. Corrige arriba el tipo de alguna columna.'
            : !hasMeasures
              ? 'Ninguna columna es numérica. Corrige el tipo de la columna que quieras medir, o usa la agregación «Recuento».'
              : 'Completa la selección para continuar.'}
        </AlertDescription>
      </Alert>
    );
  }

  const categories = dimension?.distinctCount ?? 0;
  const tooManyCategories = categories > MAX_READABLE_CATEGORIES;

  return (
    <div className="space-y-2">
      <div className="rounded-md border bg-muted/40 p-3 text-sm">
        Se representará{' '}
        <strong>
          {AGGREGATION_PHRASE[aggregation]}
          {measureName !== null && ' '}
          {measureName !== null && <span className="font-mono">{measureName}</span>}
        </strong>{' '}
        por <span className="font-mono font-medium">{dimension?.name}</span>, sobre{' '}
        {dataset.rowCount.toLocaleString('es-ES')} filas agrupadas en{' '}
        {categories.toLocaleString('es-ES')}
        {dimension?.distinctCountExact === false ? '+' : ''} categorías.
      </div>

      {tooManyCategories && (
        <Alert role="status">
          <TriangleAlert className="size-4" />
          <AlertTitle>Demasiadas categorías</AlertTitle>
          <AlertDescription>
            {categories.toLocaleString('es-ES')} valores distintos son difíciles de leer
            en un gráfico. Abajo puedes limitarlas: las categorías menores se pliegan en
            «Otros».
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
