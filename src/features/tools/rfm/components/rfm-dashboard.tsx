import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Download, TriangleAlert, Users } from 'lucide-react';
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
import { downloadTextFile } from '@/lib/download';
import { cn } from '@/lib/utils';
import { formatDay } from '@/features/analysis/lib/dates';
import { formatCount, formatMetric } from '@/features/analysis/lib/format';
import { prepareRows } from '@/features/analysis/lib/prepare-rows';
import type { ParsedDataset } from '@/features/dataset/types';
import type { ColumnMappingState } from '@/features/mapping/use-column-mapping';
import { rfmToCsv } from '../lib/export-rfm-csv';
import {
  computeRfm,
  RFM_SEGMENTS,
  type RfmCustomer,
  type RfmSegmentDef,
  type RfmSegmentId,
} from '../lib/rfm';
import type { RfmConfigState } from '../use-rfm-config';

/** Clientes que se pintan en la tabla; el CSV se los lleva todos. */
const TABLE_LIMIT = 150;

type Selection =
  | { kind: 'todos' }
  | { kind: 'celda'; r: number; f: number }
  | { kind: 'segmento'; id: RfmSegmentId };

type SortKey = 'id' | 'recencyDays' | 'frequency' | 'monetary';

const TONE_CLASS: Record<RfmSegmentDef['tone'], string> = {
  bueno: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  neutro: 'bg-sky-500/15 text-sky-700 dark:text-sky-400',
  aviso: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  malo: 'bg-muted text-muted-foreground',
};

/**
 * Matriz RFM: la cartera repartida en 25 casillas y en ocho segmentos.
 *
 * La rejilla y la lista de segmentos son dos vistas del mismo reparto, y
 * ambas filtran la tabla de abajo: la pregunta que sigue a «¿cuántos clientes
 * están en riesgo?» es siempre «¿quiénes son?», y la respuesta debería estar
 * a un clic y no en otra pantalla.
 */
export function RfmDashboard({
  dataset,
  mapping,
  state,
}: {
  dataset: ParsedDataset;
  mapping: ColumnMappingState;
  state: RfmConfigState;
}) {
  const [selection, setSelection] = useState<Selection>({ kind: 'todos' });
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({
    key: 'monetary',
    desc: true,
  });

  const { assignments } = state.slots;
  const customerDim = assignments.cliente ?? null;
  const dateColumn = assignments.fecha ?? null;
  const amountColumn = assignments.importe ?? null;
  const orderDim = assignments.pedido ?? null;
  const currency = state.settings.currency;

  const prepared = useMemo(
    () => prepareRows(dataset.rows, mapping.columns, { dateColumn }, mapping.preserveInvalid),
    [dataset.rows, mapping.columns, mapping.preserveInvalid, dateColumn],
  );

  const result = useMemo(() => {
    if (customerDim === null || amountColumn === null) return null;
    return computeRfm(prepared.rows, {
      customerDim,
      amountColumn,
      orderDim,
      referenceDay: state.referenceDay,
    });
  }, [prepared.rows, customerDim, amountColumn, orderDim, state.referenceDay]);

  const filtered = useMemo(() => {
    if (result === null) return [];
    if (selection.kind === 'celda') {
      return result.customers.filter(
        (customer) => customer.r === selection.r && customer.f === selection.f,
      );
    }
    if (selection.kind === 'segmento') {
      return result.customers.filter((customer) => customer.segment === selection.id);
    }
    return result.customers;
  }, [result, selection]);

  const sorted = useMemo(() => {
    const list = [...filtered];
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
  }, [filtered, sort]);

  if (result === null) {
    return (
      <Alert role="status">
        <TriangleAlert className="size-4" />
        <AlertTitle>Faltan columnas</AlertTitle>
        <AlertDescription>
          Vuelve al paso anterior y elige qué columna es el cliente y cuál el importe.
        </AlertDescription>
      </Alert>
    );
  }

  if (result.customers.length === 0) {
    return (
      <Alert role="status">
        <TriangleAlert className="size-4" />
        <AlertTitle>Sin clientes que segmentar</AlertTitle>
        <AlertDescription>
          Ninguna fila tiene a la vez cliente, fecha e importe.
          {result.ignoredRows > 0 &&
            ` Se han descartado ${formatCount(result.ignoredRows)} filas por ese motivo.`}
        </AlertDescription>
      </Alert>
    );
  }

  const money = { format: 'moneda' as const, currency };
  const baseName = dataset.fileName.replace(/\.[^.]+$/, '');
  const peak = Math.max(...result.grid.map((cell) => cell.customers), 1);

  return (
    <div className="space-y-3">
      <Card size="sm">
        <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Tile label="Clientes" value={formatCount(result.customers.length)} />
          <Tile
            label="Importe de la cartera"
            value={formatMetric(result.totalMonetary, money)}
          />
          <Tile
            label="Valor medio por cliente"
            value={formatMetric(result.totalMonetary / result.customers.length, money)}
          />
          <Tile
            label="Recencia medida desde"
            value={formatDay(result.referenceDay)}
            hint={
              result.ignoredRows > 0
                ? `${formatCount(result.ignoredRows)} filas sin cliente, fecha o importe`
                : undefined
            }
          />
        </CardContent>
      </Card>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <Card size="sm">
          <CardHeader>
            <CardTitle>Rejilla RFM</CardTitle>
            <CardDescription className="text-xs text-pretty">
              Cada casilla es una pareja de notas: recencia de arriba abajo, frecuencia de
              izquierda a derecha. Pulsa una para ver quién está dentro.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <div className="flex flex-col justify-center">
                <span className="[writing-mode:vertical-rl] rotate-180 text-xs text-muted-foreground">
                  Recencia (5 = más reciente)
                </span>
              </div>

              <div className="min-w-0 flex-1 space-y-1">
                <div className="grid grid-cols-5 gap-1">
                  {result.grid.map((cell) => {
                    const active =
                      selection.kind === 'celda' &&
                      selection.r === cell.r &&
                      selection.f === cell.f;

                    return (
                      <button
                        key={`${cell.r}:${cell.f}`}
                        type="button"
                        onClick={() =>
                          setSelection(
                            active ? { kind: 'todos' } : { kind: 'celda', r: cell.r, f: cell.f },
                          )
                        }
                        title={`R${cell.r} · F${cell.f}: ${formatCount(cell.customers)} clientes · ${formatMetric(cell.monetary, money)}`}
                        className={cn(
                          'flex aspect-square min-h-10 flex-col items-center justify-center rounded-md border text-xs transition-colors',
                          'focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
                          active ? 'border-primary ring-2 ring-primary/30' : 'border-transparent',
                          cell.customers === 0 && 'text-muted-foreground/40',
                        )}
                        style={{
                          backgroundColor: `color-mix(in oklch, var(--primary) ${((cell.customers / peak) * 65).toFixed(1)}%, transparent)`,
                        }}
                      >
                        <span className="font-medium tabular-nums">
                          {cell.customers === 0 ? '·' : formatCount(cell.customers)}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="grid grid-cols-5 gap-1 text-center text-xs text-muted-foreground">
                  {[1, 2, 3, 4, 5].map((f) => (
                    <span key={f}>F{f}</span>
                  ))}
                </div>
                <p className="text-center text-xs text-muted-foreground">
                  Frecuencia (5 = compra más a menudo)
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardTitle>Segmentos</CardTitle>
            <CardDescription className="text-xs text-pretty">
              El reparto de la cartera y qué hacer con cada grupo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1">
              {RFM_SEGMENTS.map((definition) => {
                const summary = result.segments.find(
                  (item) => item.segment === definition.id,
                );
                if (summary === undefined) return null;

                const active =
                  selection.kind === 'segmento' && selection.id === definition.id;

                return (
                  <li key={definition.id}>
                    <button
                      type="button"
                      onClick={() =>
                        setSelection(
                          active ? { kind: 'todos' } : { kind: 'segmento', id: definition.id },
                        )
                      }
                      className={cn(
                        'flex w-full items-center gap-2 rounded-md border p-2 text-left transition-colors hover:bg-muted/50',
                        active ? 'border-primary bg-primary/5' : 'border-transparent',
                      )}
                    >
                      <span
                        className={cn(
                          'shrink-0 rounded-md px-1.5 py-0.5 text-xs font-medium',
                          TONE_CLASS[definition.tone],
                        )}
                      >
                        {formatCount(summary.customers)}
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {definition.label}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {definition.advice}
                        </span>
                      </span>

                      <span className="shrink-0 text-right text-xs tabular-nums">
                        <span className="block font-medium">
                          {formatMetric(summary.monetary, { ...money, compact: true })}
                        </span>
                        <span className="block text-muted-foreground">
                          {summary.share.toFixed(1)} %
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card size="sm">
        <CardHeader>
          <CardTitle>
            {selection.kind === 'todos'
              ? 'Todos los clientes'
              : selection.kind === 'segmento'
                ? RFM_SEGMENTS.find((segment) => segment.id === selection.id)?.label
                : `Casilla R${selection.r} · F${selection.f}`}
          </CardTitle>
          <CardDescription className="text-xs">
            {formatCount(sorted.length)} clientes
            {sorted.length > TABLE_LIMIT &&
              ` · se muestran los ${formatCount(TABLE_LIMIT)} primeros`}
            {selection.kind !== 'todos' && ' · pulsa de nuevo para quitar el filtro'}
          </CardDescription>
          <CardAction>
            <div className="flex items-center gap-2">
              {selection.kind !== 'todos' && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7"
                  onClick={() => setSelection({ kind: 'todos' })}
                >
                  <Users />
                  Ver todos
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="h-7"
                onClick={() =>
                  downloadTextFile(
                    `${baseName}-rfm.csv`,
                    rfmToCsv(sorted),
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
          <CustomerTable
            customers={sorted.slice(0, TABLE_LIMIT)}
            currency={currency}
            sort={sort}
            onSort={(key) =>
              setSort((current) =>
                current.key === key
                  ? { key, desc: !current.desc }
                  : { key, desc: key !== 'id' },
              )
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}

const COLUMNS: { key: SortKey; label: string; numeric: boolean }[] = [
  { key: 'id', label: 'Cliente', numeric: false },
  { key: 'recencyDays', label: 'Días sin comprar', numeric: true },
  { key: 'frequency', label: 'Compras', numeric: true },
  { key: 'monetary', label: 'Importe', numeric: true },
];

function CustomerTable({
  customers,
  currency,
  sort,
  onSort,
}: {
  customers: readonly RfmCustomer[];
  currency: RfmConfigState['settings']['currency'];
  sort: { key: SortKey; desc: boolean };
  onSort: (key: SortKey) => void;
}) {
  if (customers.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Ningún cliente en esta selección.
      </p>
    );
  }

  return (
    <div className="max-h-[28rem] overflow-auto rounded-md border">
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-card">
          <tr className="border-b">
            {COLUMNS.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cn(
                  'px-2 py-2 font-medium whitespace-nowrap',
                  column.numeric ? 'text-right' : 'text-left',
                )}
              >
                <button
                  type="button"
                  onClick={() => onSort(column.key)}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-sm hover:text-foreground',
                    sort.key === column.key ? 'text-foreground' : 'text-muted-foreground',
                  )}
                >
                  {column.label}
                  {sort.key === column.key &&
                    (sort.desc ? (
                      <ArrowDown className="size-3" aria-hidden />
                    ) : (
                      <ArrowUp className="size-3" aria-hidden />
                    ))}
                </button>
              </th>
            ))}
            <th scope="col" className="px-2 py-2 text-center font-medium">
              RFM
            </th>
            <th scope="col" className="px-2 py-2 text-left font-medium">
              Segmento
            </th>
          </tr>
        </thead>

        <tbody>
          {customers.map((customer) => (
            <tr key={customer.id} className="border-b last:border-0 hover:bg-muted/40">
              <td className="max-w-56 truncate px-2 py-1.5" title={customer.id}>
                {customer.id}
              </td>
              <td className="px-2 py-1.5 text-right tabular-nums">
                {formatCount(customer.recencyDays)}
              </td>
              <td className="px-2 py-1.5 text-right tabular-nums">
                {formatCount(customer.frequency)}
              </td>
              <td className="px-2 py-1.5 text-right tabular-nums">
                {formatMetric(customer.monetary, { format: 'moneda', currency })}
              </td>
              <td className="px-2 py-1.5 text-center font-mono text-xs whitespace-nowrap">
                {customer.r}
                {customer.f}
                {customer.m}
              </td>
              <td className="px-2 py-1.5">
                <Badge variant="outline" className="max-w-full truncate">
                  {RFM_SEGMENTS.find((segment) => segment.id === customer.segment)?.label}
                </Badge>
              </td>
            </tr>
          ))}
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
