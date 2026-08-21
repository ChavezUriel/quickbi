import { useMemo } from 'react';
import { Download, TriangleAlert } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { downloadTextFile } from '@/lib/download';
import { cn } from '@/lib/utils';
import { formatCount, formatMetric } from '@/features/analysis/lib/format';
import { prepareRows } from '@/features/analysis/lib/prepare-rows';
import { EMPTY_LABEL } from '@/features/analysis/types';
import type { ParsedDataset } from '@/features/dataset/types';
import type { ColumnMappingState } from '@/features/mapping/use-column-mapping';
import { OptionSelect, type Option } from '../../components/option-select';
import { categoryAxis } from '../../lib/axis';
import { pivotToCsv } from '../lib/export-pivot-csv';
import { computePivot, type PivotAxis, type PivotTable } from '../lib/pivot';
import {
  COUNT_COLUMN,
  NO_DIM,
  TIME_DIM,
  type PivotConfigState,
} from '../use-pivot-config';

/**
 * Tabla dinámica: filas, columnas y una cifra en cada cruce.
 *
 * Los tres ejes se cambian aquí mismo, sin volver a la configuración: una
 * tabla dinámica se usa girándola, y obligar a retroceder un paso para
 * cambiar de métrica convertiría un gesto en un trámite.
 */
export function PivotDashboard({
  dataset,
  mapping,
  state,
}: {
  dataset: ParsedDataset;
  mapping: ColumnMappingState;
  state: PivotConfigState;
}) {
  const { settings, update, metric } = state;
  const usesTime = settings.colDim === TIME_DIM;

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

  const table = useMemo<PivotTable>(() => {
    const rowAxis: PivotAxis = {
      keyOf: (row) => row.dims[settings.rowDim] ?? EMPTY_LABEL,
      labelOf: (key) => key,
      sort: settings.sort,
      max: settings.maxRows,
    };

    return computePivot(prepared.rows, {
      row: rowAxis,
      col: colAxisOf(settings),
      metric,
    });
  }, [prepared.rows, settings, metric]);

  const dimensionOptions: Option[] = mapping.dimensions.map((column) => ({
    value: column.name,
    label: column.name,
  }));

  const colOptions: Option[] = [
    ...dimensionOptions.filter((option) => option.value !== settings.rowDim),
    ...(mapping.dateColumns.length > 0
      ? [{ value: TIME_DIM, label: 'Tiempo (períodos)' }]
      : []),
    { value: NO_DIM, label: 'Sin columnas' },
  ];

  const metricOptions: Option[] = [
    ...mapping.measures.map((column) => ({ value: column.name, label: column.name })),
    { value: COUNT_COLUMN, label: 'Número de filas' },
  ];

  const baseName = dataset.fileName.replace(/\.[^.]+$/, '');

  return (
    <div className="space-y-3">
      <Card size="sm" className="relative z-20 overflow-visible">
        <CardContent className="flex flex-wrap items-end gap-3">
          <Control label="Filas">
            <OptionSelect
              value={settings.rowDim}
              options={dimensionOptions}
              ariaLabel="Dimensión de las filas"
              size="sm"
              onChange={(value) => update({ rowDim: value })}
            />
          </Control>

          <Control label="Columnas">
            <OptionSelect
              value={settings.colDim}
              options={colOptions}
              ariaLabel="Dimensión de las columnas"
              size="sm"
              onChange={(value) => update({ colDim: value })}
            />
          </Control>

          <Control label="Métrica">
            <OptionSelect
              value={settings.metricColumn}
              options={metricOptions}
              ariaLabel="Métrica"
              size="sm"
              onChange={(value) => update({ metricColumn: value })}
            />
          </Control>

          <div className="ml-auto flex items-center gap-3">
            <Toggle
              label="Mapa de calor"
              checked={settings.heatmap}
              onChange={(checked) => update({ heatmap: checked })}
            />
            <Toggle
              label="Totales"
              checked={settings.showTotals}
              onChange={(checked) => update({ showTotals: checked })}
            />
            <Button
              variant="outline"
              size="sm"
              className="h-7"
              disabled={table.rows.length === 0}
              onClick={() =>
                downloadTextFile(
                  `${baseName}-tabla-dinamica.csv`,
                  pivotToCsv(table, settings.rowDim, settings.showTotals),
                  'text/csv;charset=utf-8',
                )
              }
            >
              <Download />
              CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {table.rows.length === 0 ? (
        <Alert role="status">
          <TriangleAlert className="size-4" />
          <AlertTitle>Sin datos que cruzar</AlertTitle>
          <AlertDescription>
            Ninguna fila del dataset llega hasta aquí. Revisa los tipos del paso anterior.
          </AlertDescription>
        </Alert>
      ) : (
        <Card size="sm">
          <CardContent className="space-y-2">
            <PivotGrid table={table} state={state} />

            <p className="text-xs text-pretty text-muted-foreground">
              {formatCount(prepared.rows.length)} filas ·{' '}
              {formatCount(table.rows.length)} categorías en las filas
              {table.hiddenRows > 0 &&
                ` · ${formatCount(table.hiddenRows)} fuera del máximo`}
              {table.hiddenCols > 0 &&
                ` · ${formatCount(table.hiddenCols)} columnas fuera del máximo`}
              {prepared.dropped > 0 &&
                ` · ${formatCount(prepared.dropped)} filas descartadas por errores de conversión`}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function colAxisOf(settings: PivotConfigState['settings']): PivotAxis | null {
  if (settings.colDim === NO_DIM) return null;

  return categoryAxis({
    dim: settings.colDim,
    grain: settings.grain,
    sort: settings.sort,
    max: settings.maxCols,
  });
}

/**
 * La rejilla, con la cabecera y la primera columna pegadas: en una tabla de
 * cincuenta filas por veinte columnas, saber qué se está mirando no puede
 * depender de dónde esté el scroll.
 */
function PivotGrid({ table, state }: { table: PivotTable; state: PivotConfigState }) {
  const { settings, metric } = state;
  const format = { format: metric.format, currency: settings.currency };

  return (
    <div className="max-h-[calc(100dvh-19rem)] min-h-64 overflow-auto rounded-md border">
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-card">
          <tr className="border-b">
            <th
              scope="col"
              className="sticky left-0 z-10 bg-card px-2 py-2 text-left font-medium whitespace-nowrap"
            >
              {settings.rowDim}
            </th>
            {table.cols.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={cn(
                  'px-2 py-2 text-right font-medium whitespace-nowrap tabular-nums',
                  col.isOthers && 'text-muted-foreground',
                )}
              >
                {col.label}
              </th>
            ))}
            {settings.showTotals && (
              <th
                scope="col"
                className="px-2 py-2 text-right font-semibold whitespace-nowrap"
              >
                Total
              </th>
            )}
          </tr>
        </thead>

        <tbody>
          {table.rows.map((row, rowIndex) => (
            <tr key={row.key} className="border-b last:border-0 hover:bg-muted/40">
              <th
                scope="row"
                className={cn(
                  'sticky left-0 z-10 max-w-56 truncate bg-card px-2 py-1.5 text-left font-normal',
                  row.isOthers && 'text-muted-foreground italic',
                )}
                title={row.label}
              >
                {row.label}
              </th>

              {(table.cells[rowIndex] ?? []).map((value, colIndex) => (
                <td
                  key={table.cols[colIndex]?.key ?? colIndex}
                  className="px-2 py-1.5 text-right tabular-nums"
                  style={
                    settings.heatmap ? heatStyle(value, table.min, table.max) : undefined
                  }
                >
                  {value === null ? (
                    <span className="text-muted-foreground/50">—</span>
                  ) : (
                    formatMetric(value, { ...format, compact: true })
                  )}
                </td>
              ))}

              {settings.showTotals && (
                <td className="px-2 py-1.5 text-right font-medium tabular-nums">
                  {formatMetric(table.rowTotals[rowIndex] ?? null, {
                    ...format,
                    compact: true,
                  })}
                </td>
              )}
            </tr>
          ))}
        </tbody>

        {settings.showTotals && (
          <tfoot className="sticky bottom-0 bg-muted/70 backdrop-blur-sm">
            <tr className="border-t">
              <th
                scope="row"
                className="sticky left-0 bg-muted/70 px-2 py-2 text-left font-semibold"
              >
                Total
              </th>
              {table.colTotals.map((value, index) => (
                <td
                  key={table.cols[index]?.key ?? index}
                  className="px-2 py-2 text-right font-medium tabular-nums"
                >
                  {formatMetric(value, { ...format, compact: true })}
                </td>
              ))}
              <td className="px-2 py-2 text-right font-semibold tabular-nums">
                {formatMetric(table.grandTotal, { ...format, compact: true })}
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

/**
 * Intensidad de la celda según su valor.
 *
 * La escala es relativa a lo que se ve, no al dataset entero: el mapa de calor
 * responde a la pregunta «dentro de esta tabla, ¿dónde está lo gordo?». Los
 * negativos usan el color de alerta porque en una tabla de importes son otra
 * cosa, no simplemente «menos».
 */
function heatStyle(
  value: number | null,
  min: number,
  max: number,
): React.CSSProperties | undefined {
  if (value === null) return undefined;

  const negative = value < 0;
  const scale = Math.max(Math.abs(max), Math.abs(min));
  if (scale === 0) return undefined;

  const intensity = Math.min((Math.abs(value) / scale) * 70, 70);
  const color = negative ? 'var(--destructive)' : 'var(--primary)';

  return {
    backgroundColor: `color-mix(in oklch, ${color} ${intensity.toFixed(1)}%, transparent)`,
  };
}

function Control({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-36 flex-1 space-y-1 sm:max-w-56">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-1.5 text-xs select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="size-3.5 rounded border-input text-primary focus:ring-1 focus:ring-ring"
      />
      {label}
    </label>
  );
}
