import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { downloadTextFile } from '@/lib/download';
import { cn } from '@/lib/utils';
import { explorationToCsv } from '../lib/export-csv';
import { deltaScale, formatCount, formatMetric, formatShare } from '../lib/format';
import type { Currency, ExplorationResult, MetricDef } from '../types';
import { DeltaPill } from './delta-pill';

/** Filas visibles: más allá de esto la tabla deja de ser legible y de ir fluida. */
const MAX_ROWS = 200;

/**
 * Columnas de contexto. Cuando no caben se ocultan: caben cinco columnas o cabe
 * el nombre de la categoría, y sin el nombre la tabla no dice nada. Lo que se
 * esconde es lo derivable —participación y período anterior—, nunca el valor ni
 * su variación, y el CSV sigue exportando la tabla entera.
 *
 * Son consultas de contenedor, no de ventana: en el cuadro de mando esta tabla
 * es una columna de ~700 px dentro de una pantalla de 1920, y preguntarle a la
 * ventana daría por bueno un ancho que la tabla no tiene. El período anterior
 * pide más sitio que la participación porque es la más prescindible: la
 * variación de al lado ya cuenta la misma historia en relativo.
 */
const SHARE_COLUMN = 'hidden @xl:table-cell';
const PREVIOUS_COLUMN = 'hidden @2xl:table-cell';

type SortField = 'name' | 'value' | 'sharePct' | 'previousValue' | 'deltaPct';
type SortOrder = 'asc' | 'desc';

interface DetailTableProps {
  result: ExplorationResult;
  metric: MetricDef;
  currency: Currency;
  dimensionHeader: string;
  selected: readonly string[];
  selectable: boolean;
  fileName: string;
  onSelect: (name: string, additive: boolean) => void;
}

/**
 * Detalle por categoría: valor, peso sobre el total y variación. La barra
 * horizontal es proporcional al mayor valor visible, para leer el reparto de
 * un vistazo sin tener que comparar cifras.
 */
export function DetailTable({
  result,
  metric,
  currency,
  dimensionHeader,
  selected,
  selectable,
  fileName,
  onSelect,
}: DetailTableProps) {
  const [sortField, setSortField] = useState<SortField>('value');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const hasComparison = result.previousWindow !== null;

  const effectiveSortField = useMemo(() => {
    if (sortField === 'sharePct' && !metric.cumulative) return 'value';
    if ((sortField === 'previousValue' || sortField === 'deltaPct') && !hasComparison) {
      return 'value';
    }
    return sortField;
  }, [sortField, metric.cumulative, hasComparison]);

  const handleSort = (field: SortField) => {
    if (effectiveSortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder(field === 'name' ? 'asc' : 'desc');
    }
  };

  const sortedItems = useMemo(() => {
    return [...result.items].sort((a, b) => {
      const valA = a[effectiveSortField];
      const valB = b[effectiveSortField];

      if (valA === valB) return a.name.localeCompare(b.name, 'es');
      if (valA === null || valA === undefined) return 1;
      if (valB === null || valB === undefined) return -1;

      let comp = 0;
      if (typeof valA === 'string' && typeof valB === 'string') {
        comp = valA.localeCompare(valB, 'es', { numeric: true, sensitivity: 'base' });
      } else {
        comp = (valA as number) < (valB as number) ? -1 : 1;
      }

      return sortOrder === 'asc' ? comp : -comp;
    });
  }, [result.items, effectiveSortField, sortOrder]);

  const visible = sortedItems.slice(0, MAX_ROWS);
  const max = visible.reduce((peak, item) => Math.max(peak, Math.abs(item.value)), 0);
  const scale = deltaScale(visible.map((item) => item.deltaPct));
  const dimming = selected.length > 0;
  const useCompact = visible.some(
    (item) =>
      Math.abs(item.value) > 99999 ||
      (item.previousValue !== null && Math.abs(item.previousValue) > 99999),
  );

  const exportCsv = () => {
    downloadTextFile(
      `${fileName}-detalle.csv`,
      explorationToCsv(result, dimensionHeader, metric.label),
      'text/csv;charset=utf-8',
    );
  };

  return (
    <div className="@container flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {formatCount(result.items.length)}{' '}
          {result.items.length === 1 ? 'categoría' : 'categorías'}
          {result.items.length > MAX_ROWS && ` — se muestran las ${MAX_ROWS} mayores`}
        </p>
        <Button variant="outline" size="sm" className="h-7" onClick={exportCsv}>
          <Download />
          CSV
        </Button>
      </div>

      {/* Tope propio mientras la página scrollea —más generoso cuando la tabla
          baja a ocupar el ancho entero, que es cuando más filas caben de un
          vistazo—; dentro del cuadro de mando la altura la marca el panel y la
          tabla se come lo que quede. */}
      <div className="max-h-96 min-h-0 flex-1 overflow-auto rounded-md border lg:max-h-[34rem] 3xl:max-h-none">
        <Table>
          <TableCaption className="sr-only">
            {metric.label} por {dimensionHeader}
            {hasComparison && ', con la variación respecto al período de comparación'}.
          </TableCaption>
          {/* `bg-card`, no `bg-background`: la tabla vive dentro de una tarjeta
              y en tema oscuro las dos no son el mismo color. */}
          <TableHeader className="sticky top-0 z-10 bg-card">
            <TableRow>
              <TableHead
                scope="col"
                aria-sort={
                  effectiveSortField === 'name'
                    ? sortOrder === 'asc'
                      ? 'ascending'
                      : 'descending'
                    : 'none'
                }
                className="max-w-32 truncate sm:max-w-44"
              >
                <button
                  type="button"
                  onClick={() => handleSort('name')}
                  className="inline-flex items-center gap-1 font-medium transition-colors hover:text-foreground focus-visible:outline-none"
                >
                  <span className="truncate" title={dimensionHeader}>
                    {dimensionHeader}
                  </span>
                  <SortIcon active={effectiveSortField === 'name'} order={sortOrder} />
                </button>
              </TableHead>

              <TableHead
                scope="col"
                aria-sort={
                  effectiveSortField === 'value'
                    ? sortOrder === 'asc'
                      ? 'ascending'
                      : 'descending'
                    : 'none'
                }
                className="text-right"
              >
                <button
                  type="button"
                  onClick={() => handleSort('value')}
                  className="inline-flex w-full items-center justify-end gap-1 font-medium transition-colors hover:text-foreground focus-visible:outline-none"
                >
                  <span>{metric.label}</span>
                  <SortIcon active={effectiveSortField === 'value'} order={sortOrder} />
                </button>
              </TableHead>

              {metric.cumulative && (
                <TableHead
                  scope="col"
                  aria-sort={
                    effectiveSortField === 'sharePct'
                      ? sortOrder === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : 'none'
                  }
                  className={cn('text-right', SHARE_COLUMN)}
                >
                  <button
                    type="button"
                    onClick={() => handleSort('sharePct')}
                    className="inline-flex w-full items-center justify-end gap-1 font-medium transition-colors hover:text-foreground focus-visible:outline-none"
                  >
                    <span>Participación</span>
                    <SortIcon active={effectiveSortField === 'sharePct'} order={sortOrder} />
                  </button>
                </TableHead>
              )}

              {hasComparison && (
                <>
                  <TableHead
                    scope="col"
                    aria-sort={
                      effectiveSortField === 'previousValue'
                        ? sortOrder === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                    }
                    className={cn('text-right', PREVIOUS_COLUMN)}
                  >
                    <button
                      type="button"
                      onClick={() => handleSort('previousValue')}
                      className="inline-flex w-full items-center justify-end gap-1 font-medium transition-colors hover:text-foreground focus-visible:outline-none"
                    >
                      <span>Período anterior</span>
                      <SortIcon
                        active={effectiveSortField === 'previousValue'}
                        order={sortOrder}
                      />
                    </button>
                  </TableHead>

                  <TableHead
                    scope="col"
                    aria-sort={
                      effectiveSortField === 'deltaPct'
                        ? sortOrder === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                    }
                    className="text-right"
                  >
                    <button
                      type="button"
                      onClick={() => handleSort('deltaPct')}
                      className="inline-flex w-full items-center justify-end gap-1 font-medium transition-colors hover:text-foreground focus-visible:outline-none"
                    >
                      <span>Variación</span>
                      <SortIcon active={effectiveSortField === 'deltaPct'} order={sortOrder} />
                    </button>
                  </TableHead>
                </>
              )}
            </TableRow>
          </TableHeader>

          <TableBody>
            {visible.map((item) => {
              const isSelected = selected.includes(item.name);
              const width = max === 0 ? 0 : (Math.abs(item.value) / max) * 100;

              return (
                <TableRow
                  key={item.name}
                  onClick={
                    selectable
                      ? (event) => onSelect(item.name, event.ctrlKey || event.metaKey)
                      : undefined
                  }
                  aria-selected={selectable ? isSelected : undefined}
                  className={cn(
                    selectable && 'cursor-pointer',
                    dimming && !isSelected && 'opacity-40',
                    isSelected && 'bg-muted',
                  )}
                >
                  <TableCell
                    className="max-w-32 truncate font-medium sm:max-w-44"
                    title={item.name}
                  >
                    {selectable ? (
                      <button
                        type="button"
                        aria-pressed={isSelected}
                        className="block max-w-full truncate text-left underline-offset-2 hover:underline"
                        onClick={(event) => {
                          event.stopPropagation();
                          onSelect(item.name, event.ctrlKey || event.metaKey);
                        }}
                      >
                        {item.name}
                      </button>
                    ) : (
                      item.name
                    )}
                  </TableCell>

                  <TableCell>
                    <div className="flex items-center justify-end gap-2">
                      <span className="tabular-nums">
                        {formatMetric(item.value, {
                          format: metric.format,
                          currency,
                          compact: useCompact,
                        })}
                      </span>
                      <span
                        className="hidden h-2 w-20 shrink-0 overflow-hidden rounded-full bg-muted sm:block"
                        aria-hidden
                      >
                        <span
                          className={cn(
                            'block h-full rounded-full',
                            item.value < 0 ? 'bg-destructive/60' : 'bg-primary/60',
                          )}
                          style={{ width: `${width}%` }}
                        />
                      </span>
                    </div>
                  </TableCell>

                  {metric.cumulative && (
                    <TableCell
                      className={cn(
                        'text-right tabular-nums text-muted-foreground',
                        SHARE_COLUMN,
                      )}
                    >
                      {formatShare(item.sharePct)}
                    </TableCell>
                  )}

                  {hasComparison && (
                    <>
                      <TableCell
                        className={cn(
                          'text-right tabular-nums text-muted-foreground',
                          PREVIOUS_COLUMN,
                        )}
                      >
                        {formatMetric(item.previousValue, {
                          format: metric.format,
                          currency,
                          compact: useCompact,
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        <DeltaPill value={item.deltaPct} scale={scale} />
                      </TableCell>
                    </>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function SortIcon({ active, order }: { active: boolean; order: SortOrder }) {
  if (active) {
    return order === 'asc' ? (
      <ArrowUp className="size-3.5 shrink-0 text-primary" aria-hidden />
    ) : (
      <ArrowDown className="size-3.5 shrink-0 text-primary" aria-hidden />
    );
  }
  return <ArrowUpDown className="size-3 shrink-0 opacity-40 hover:opacity-75" aria-hidden />;
}

