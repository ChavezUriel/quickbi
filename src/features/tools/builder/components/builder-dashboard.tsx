import { useMemo, useRef, useState } from 'react';
import { Download, ImageDown, TriangleAlert, X } from 'lucide-react';
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
import { GRANULARITIES, GRANULARITY_LABEL } from '@/features/analysis/labels';
import { formatCount, formatMetric } from '@/features/analysis/lib/format';
import { prepareRows } from '@/features/analysis/lib/prepare-rows';
import type { Granularity } from '@/features/analysis/types';
import type { ParsedDataset } from '@/features/dataset/types';
import type { ColumnMappingState } from '@/features/mapping/use-column-mapping';
import { OptionSelect, type Option } from '../../components/option-select';
import { buildChartData, SUPPORTS_SERIES } from '../lib/build-chart';
import { buildChartOption } from '../lib/chart-option';
import { chartToCsv } from '../lib/export-chart-csv';
import {
  COUNT_COLUMN,
  NO_DIM,
  TIME_DIM,
  type BuilderConfigState,
} from '../use-builder-config';
import { ChartKindPicker } from './chart-kind-picker';

const GRAINS: Granularity[] = [...GRANULARITIES, 'anio'];

export function BuilderDashboard({
  dataset,
  mapping,
  state,
}: {
  dataset: ParsedDataset;
  mapping: ColumnMappingState;
  state: BuilderConfigState;
}) {
  const [showTable, setShowTable] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const chartRef = useRef<EChartHandle>(null);
  const { settings, update, spec, metric, metricY, usesTime } = state;

  const prepared = useMemo(
    () =>
      prepareRows(
        dataset.rows,
        mapping.columns,
        { dateColumn: usesTime ? settings.dateColumn : null },
        mapping.preserveInvalid,
      ),
    [dataset.rows, mapping.columns, mapping.preserveInvalid, usesTime, settings.dateColumn],
  );

  const data = useMemo(() => buildChartData(prepared.rows, spec), [prepared.rows, spec]);

  const title = `${metric.label}${
    settings.categoryDim === TIME_DIM ? ' en el tiempo' : ` por ${settings.categoryDim}`
  }`;

  const option = useMemo(
    () =>
      buildChartOption({
        data,
        kind: settings.kind,
        metric,
        metricY,
        currency: settings.currency,
        horizontal: settings.horizontal,
        showLegend: settings.showLegend && data.series.length > 1,
        showLabels: settings.showLabels,
        ariaDescription: title,
      }),
    [data, settings, metric, metricY, title],
  );

  const categoryOptions: Option[] = [
    ...(mapping.dateColumns.length > 0
      ? [{ value: TIME_DIM, label: 'Tiempo (períodos)' }]
      : []),
    ...mapping.dimensions.map((column) => ({ value: column.name, label: column.name })),
  ];

  const seriesOptions: Option[] = [
    { value: NO_DIM, label: 'Una sola serie' },
    ...mapping.dimensions
      .filter((column) => column.name !== settings.categoryDim)
      .map((column) => ({ value: column.name, label: column.name })),
  ];

  const metricOptions: Option[] = [
    ...mapping.measures.map((column) => ({ value: column.name, label: column.name })),
    { value: COUNT_COLUMN, label: 'Número de filas' },
  ];

  const baseName = dataset.fileName.replace(/\.[^.]+$/, '');
  const isScatter = settings.kind === 'dispersion';
  const empty = data.categories.length === 0;

  return (
    <div className="space-y-3">
      <Card size="sm" className="relative z-20 overflow-visible">
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-full sm:w-auto">
              <span className="mb-1 block text-xs text-muted-foreground">Gráfico</span>
              <ChartKindPicker
                value={settings.kind}
                onChange={(kind) => update({ kind })}
                compact
              />
            </div>

            <Control label={isScatter ? 'Un punto por' : 'Categorías'}>
              <OptionSelect
                value={settings.categoryDim}
                options={categoryOptions}
                ariaLabel="Eje de categorías"
                size="sm"
                onChange={(value) => update({ categoryDim: value })}
              />
            </Control>

            <Control label={isScatter ? 'Eje X' : 'Métrica'}>
              <OptionSelect
                value={settings.metricColumn}
                options={metricOptions}
                ariaLabel="Métrica"
                size="sm"
                onChange={(value) => update({ metricColumn: value })}
              />
            </Control>

            {isScatter ? (
              <Control label="Eje Y">
                <OptionSelect
                  value={settings.metricYColumn}
                  options={metricOptions}
                  ariaLabel="Métrica del eje Y"
                  size="sm"
                  onChange={(value) => update({ metricYColumn: value })}
                />
              </Control>
            ) : (
              <Control label="Series">
                <OptionSelect
                  value={settings.seriesDim}
                  options={seriesOptions}
                  ariaLabel="Dimensión de las series"
                  size="sm"
                  disabled={!SUPPORTS_SERIES[settings.kind]}
                  onChange={(value) => update({ seriesDim: value })}
                />
              </Control>
            )}

            {usesTime && (
              <Control label="Grano">
                <OptionSelect
                  value={settings.grain}
                  options={GRAINS.map((grain) => ({
                    value: grain,
                    label: GRANULARITY_LABEL[grain],
                  }))}
                  ariaLabel="Grano temporal"
                  size="sm"
                  onChange={(value) => update({ grain: value as Granularity })}
                />
              </Control>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t pt-2">
            <Toggle
              label="Horizontal"
              checked={settings.horizontal}
              disabled={isScatter || settings.kind === 'circular'}
              onChange={(checked) => update({ horizontal: checked })}
            />
            <Toggle
              label="Leyenda"
              checked={settings.showLegend}
              onChange={(checked) => update({ showLegend: checked })}
            />
            <Toggle
              label="Valores"
              checked={settings.showLabels}
              onChange={(checked) => update({ showLabels: checked })}
            />
            <Toggle
              label="Tabla de datos"
              checked={showTable}
              onChange={setShowTable}
            />

            <div className="ml-auto flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7"
                disabled={empty}
                onClick={() => {
                  const dataUrl = chartRef.current?.toPngDataUrl();
                  if (dataUrl != null) downloadDataUrl(`${baseName}-grafico.png`, dataUrl);
                }}
              >
                <ImageDown aria-hidden />
                PNG
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7"
                disabled={empty}
                onClick={() =>
                  downloadTextFile(
                    `${baseName}-grafico.csv`,
                    chartToCsv(
                      data,
                      settings.categoryDim === TIME_DIM ? 'Período' : settings.categoryDim,
                      metric.label,
                      metricY?.label ?? metric.label,
                    ),
                    'text/csv;charset=utf-8',
                  )
                }
              >
                <Download />
                CSV
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {empty ? (
        <Alert role="status">
          <TriangleAlert className="size-4" />
          <AlertTitle>Nada que dibujar</AlertTitle>
          <AlertDescription>
            Ninguna fila llega hasta aquí con la combinación elegida. Prueba otra columna
            de categorías o revisa los tipos del paso anterior.
          </AlertDescription>
        </Alert>
      ) : (
        <Card size="sm">
          <CardHeader>
            <CardTitle>{title}</CardTitle>
            <CardDescription className="text-xs text-pretty">
              {formatCount(data.categories.length)} categorías
              {data.series.length > 1 && ` · ${formatCount(data.series.length)} series`}
              {data.hiddenCategories > 0 &&
                ` · ${formatCount(data.hiddenCategories)} fuera del máximo`}
              {!isScatter && ` · total ${formatMetric(data.total, {
                format: metric.format,
                currency: settings.currency,
              })}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EChart
              ref={chartRef}
              option={option}
              ariaLabel={title}
              className="min-h-80 w-full sm:min-h-96"
              onSelect={({ category, name, dataIndex }) => {
                const clicked = category ?? name;
                if (clicked) {
                  setSelectedCategory((prev) => (prev === clicked ? null : clicked));
                } else if (dataIndex !== undefined && data.categories[dataIndex]) {
                  const cat = data.categories[dataIndex].label;
                  setSelectedCategory((prev) => (prev === cat ? null : cat));
                }
              }}
            />
          </CardContent>
        </Card>
      )}

      {showTable && !empty && (
        <Card size="sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Datos del gráfico</CardTitle>
              <CardDescription className="text-xs">
                Las mismas cifras, exactas.{' '}
                {selectedCategory !== null && `Filtrado por: ${selectedCategory}`}
              </CardDescription>
            </div>
            <CardAction>
              <div className="flex items-center gap-1.5">
                {selectedCategory !== null && (
                  <Badge
                    variant="secondary"
                    className="cursor-pointer gap-1 text-xs py-1"
                    onClick={() => setSelectedCategory(null)}
                  >
                    {selectedCategory}
                    <X className="size-3 text-muted-foreground" />
                  </Badge>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7"
                  onClick={() => setShowTable(false)}
                >
                  Ocultar
                </Button>
              </div>
            </CardAction>
          </CardHeader>
          <CardContent>
            <DataTable
              state={state}
              data={data}
              selectedCategory={selectedCategory}
              onSelectCategory={setSelectedCategory}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function DataTable({
  state,
  data,
  selectedCategory,
  onSelectCategory,
}: {
  state: BuilderConfigState;
  data: ReturnType<typeof buildChartData>;
  selectedCategory: string | null;
  onSelectCategory: React.Dispatch<React.SetStateAction<string | null>>;
}) {
  const { settings, metric, metricY } = state;
  const format = { format: metric.format, currency: settings.currency };
  const categoryHeader =
    settings.categoryDim === TIME_DIM ? 'Período' : settings.categoryDim;

  const headers =
    data.points === null
      ? data.series.map((serie) => serie.name)
      : [metric.label, metricY?.label ?? metric.label];

  return (
    <div className="max-h-96 overflow-auto rounded-md border">
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-card">
          <tr className="border-b">
            <th scope="col" className="px-2 py-2 text-left font-medium">
              {categoryHeader}
            </th>
            {headers.map((header) => (
              <th
                key={header}
                scope="col"
                className="px-2 py-2 text-right font-medium whitespace-nowrap"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.points === null
            ? data.categories.map((category, index) => {
                const isSelected = selectedCategory === category.label || selectedCategory === category.key;
                return (
                  <tr
                    key={category.key}
                    onClick={() =>
                      onSelectCategory((prev) => (prev === category.label ? null : category.label))
                    }
                    className={cn(
                      'border-b last:border-0 hover:bg-muted/40 cursor-pointer transition-colors',
                      isSelected && 'bg-primary/10 font-semibold',
                    )}
                  >
                    <td className="max-w-56 truncate px-2 py-1.5" title={category.label}>
                      {category.label}
                    </td>
                    {data.series.map((serie) => (
                      <td
                        key={serie.name}
                        className="px-2 py-1.5 text-right tabular-nums"
                      >
                        {formatMetric(serie.values[index] ?? null, format)}
                      </td>
                    ))}
                  </tr>
                );
              })
            : data.points.map((point) => {
                const isSelected = selectedCategory === point.name;
                return (
                  <tr
                    key={point.name}
                    onClick={() =>
                      onSelectCategory((prev) => (prev === point.name ? null : point.name))
                    }
                    className={cn(
                      'border-b last:border-0 hover:bg-muted/40 cursor-pointer transition-colors',
                      isSelected && 'bg-primary/10 font-semibold',
                    )}
                  >
                    <td className="max-w-56 truncate px-2 py-1.5" title={point.name}>
                      {point.name}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums">
                      {formatMetric(point.x, format)}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums">
                      {formatMetric(point.y, {
                        format: metricY?.format ?? metric.format,
                        currency: settings.currency,
                      })}
                    </td>
                  </tr>
                );
              })}
        </tbody>
      </table>
    </div>
  );
}

function Control({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-32 flex-1 space-y-1 sm:max-w-48">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

function Toggle({
  label,
  checked,
  disabled = false,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      className={cn(
        'flex items-center gap-1.5 text-xs select-none',
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
      )}
      aria-disabled={disabled ? true : undefined}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="size-3.5 rounded border-input text-primary focus:ring-1 focus:ring-ring"
      />
      {label}
    </label>
  );
}
