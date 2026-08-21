import { useMemo, useState } from 'react';
import {
  CalendarDays,
  CircleAlert,
  Copy,
  Download,
  Hash,
  Search,
  SquareStack,
  Tags,
  ToggleLeft,
} from 'lucide-react';
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
import { formatCount, formatMetric } from '@/features/analysis/lib/format';
import type { ColumnType } from '@/features/dataset/lib/column-types';
import type { ParsedDataset } from '@/features/dataset/types';
import type { ColumnMappingState } from '@/features/mapping/use-column-mapping';
import { normalizeName } from '../../lib/slot-suggest';
import { profileToCsv } from '../lib/export-profile-csv';
import { profileDataset, type ColumnStats } from '../lib/profile-stats';

/**
 * Perfil de datos: qué hay dentro de cada columna, antes de medir nada.
 *
 * Es la única herramienta que no pregunta nada: se aplica al dataset entero
 * tal y como quedó tras el paso de tipos, y por eso vale igual para una tabla
 * de ventas que para un censo. Lo que enseña es justamente lo que el resto de
 * herramientas da por supuesto —que las columnas están completas y que los
 * tipos son los que parecen— y conviene comprobar antes.
 */
export function ProfileDashboard({
  dataset,
  mapping,
}: {
  dataset: ParsedDataset;
  mapping: ColumnMappingState;
}) {
  const [query, setQuery] = useState('');

  const profile = useMemo(
    () => profileDataset(dataset.rows, mapping.columns),
    [dataset.rows, mapping.columns],
  );

  const needle = normalizeName(query.trim());
  const visible = profile.columns.filter(
    (column) => needle === '' || normalizeName(column.name).includes(needle),
  );

  const baseName = dataset.fileName.replace(/\.[^.]+$/, '');

  return (
    <div className="space-y-3">
      <Card size="sm">
        <CardHeader>
          <CardTitle>Resumen del dataset</CardTitle>
          <CardDescription className="text-xs text-pretty">
            {dataset.fileName} · {formatCount(profile.rowCount)} filas ·{' '}
            {formatCount(profile.columnCount)} columnas
          </CardDescription>
          <CardAction>
            <Button
              variant="outline"
              size="sm"
              className="h-7"
              onClick={() =>
                downloadTextFile(
                  `${baseName}-perfil.csv`,
                  profileToCsv(profile),
                  'text/csv;charset=utf-8',
                )
              }
            >
              <Download />
              CSV
            </Button>
          </CardAction>
        </CardHeader>

        <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Tile
            label="Celdas con valor"
            value={`${formatMetric(profile.completeness, { format: 'numero', currency: 'EUR' })} %`}
            hint="Sobre el total de celdas del dataset."
            warn={profile.completeness < 90}
          />
          <Tile
            label="Filas duplicadas"
            value={`${formatCount(profile.duplicateRows)}${profile.duplicatesExact ? '' : '+'}`}
            hint={
              profile.duplicateRows === 0
                ? 'Ninguna fila se repite entera.'
                : 'Filas idénticas a otra anterior en todas sus columnas.'
            }
            warn={profile.duplicateRows > 0}
          />
          <Tile
            label="Columnas vacías"
            value={formatCount(profile.emptyColumns)}
            hint="Sin un solo valor aprovechable."
            warn={profile.emptyColumns > 0}
          />
          <Tile
            label="Columnas constantes"
            value={formatCount(profile.columns.filter((column) => column.constant).length)}
            hint="Un único valor: no sirven para agrupar."
            warn={false}
          />
        </CardContent>
      </Card>

      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filtrar columnas por nombre"
          aria-label="Filtrar columnas por nombre"
          className="h-9 w-full rounded-lg border border-input bg-transparent pr-3 pl-8 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:max-w-xs dark:bg-input/30"
        />
      </div>

      {visible.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Ninguna columna coincide con «{query}».
        </p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2 3xl:grid-cols-3">
          {visible.map((column) => (
            <ColumnCard key={column.name} column={column} />
          ))}
        </div>
      )}
    </div>
  );
}

function Tile({
  label,
  value,
  hint,
  warn,
}: {
  label: string;
  value: string;
  hint: string;
  warn: boolean;
}) {
  return (
    <div className="rounded-md border p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {label}
        {warn && <CircleAlert className="size-3.5 text-amber-600" aria-hidden />}
      </div>
      <p className="text-xl font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-pretty text-muted-foreground">{hint}</p>
    </div>
  );
}

const TYPE_ICON: Record<ColumnType, typeof Hash> = {
  number: Hash,
  date: CalendarDays,
  boolean: ToggleLeft,
  text: Tags,
  empty: SquareStack,
};

const TYPE_LABEL: Record<ColumnType, string> = {
  number: 'Número',
  date: 'Fecha',
  boolean: 'Booleano',
  text: 'Texto',
  empty: 'Vacía',
};

function ColumnCard({ column }: { column: ColumnStats }) {
  const Icon = TYPE_ICON[column.type];

  return (
    <Card size="sm" className="min-w-0">
      <CardHeader>
        <CardTitle className="flex min-w-0 items-center gap-1.5">
          <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="truncate font-mono text-xs" title={column.name}>
            {column.name}
          </span>
        </CardTitle>
        <CardDescription className="flex flex-wrap items-center gap-1.5 text-xs">
          <Badge variant="outline">{TYPE_LABEL[column.type]}</Badge>
          <span className="tabular-nums">
            {formatCount(column.distinctCount)}
            {column.distinctCountExact ? '' : '+'} distintos
          </span>
          {column.constant && (
            <Badge variant="secondary">
              <Copy aria-hidden />
              Constante
            </Badge>
          )}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        <Completeness column={column} />

        {column.numeric !== null && <NumericBody column={column} />}
        {column.date !== null && <DateBody column={column} />}
        {column.numeric === null && column.date === null && <TopBody column={column} />}
      </CardContent>
    </Card>
  );
}

/**
 * Reparto de las celdas de la columna en una sola barra: con valor, vacías y
 * las que no convierten. Las inválidas son las que el análisis descartará, así
 * que se pintan aparte de las vacías aunque las dos sean «sin dato».
 */
function Completeness({ column }: { column: ColumnStats }) {
  const total = Math.max(column.total, 1);
  const parts = [
    { key: 'valid', value: column.valid, className: 'bg-emerald-600/70' },
    { key: 'nulls', value: column.nulls, className: 'bg-muted-foreground/30' },
    { key: 'invalid', value: column.invalid, className: 'bg-destructive/70' },
  ];

  return (
    <div className="space-y-1">
      <div className="flex h-1.5 overflow-hidden rounded-full bg-muted">
        {parts.map((part) => (
          <div
            key={part.key}
            className={part.className}
            style={{ width: `${(part.value / total) * 100}%` }}
          />
        ))}
      </div>
      <p className="text-xs tabular-nums text-muted-foreground">
        {formatCount(column.valid)} con valor
        {column.nulls > 0 && ` · ${formatCount(column.nulls)} vacías`}
        {column.invalid > 0 && (
          <span className="text-destructive">
            {' '}
            · {formatCount(column.invalid)} no convierten
          </span>
        )}
      </p>
    </div>
  );
}

function NumericBody({ column }: { column: ColumnStats }) {
  const stats = column.numeric;
  if (stats === null) return null;

  const peak = Math.max(...stats.histogram.map((bin) => bin.count), 1);

  return (
    <div className="space-y-2">
      <div
        className="flex h-16 items-end gap-px"
        role="img"
        aria-label={`Distribución de ${column.name}`}
      >
        {stats.histogram.map((bin, index) => (
          <div
            key={index}
            className="min-h-px flex-1 rounded-t-xs bg-primary/60"
            style={{ height: `${(bin.count / peak) * 100}%` }}
            title={`${number(bin.from)} — ${number(bin.to)}: ${formatCount(bin.count)}`}
          />
        ))}
      </div>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs tabular-nums sm:grid-cols-3">
        <Stat label="Mínimo" value={number(stats.min)} />
        <Stat label="Mediana" value={number(stats.median)} />
        <Stat label="Máximo" value={number(stats.max)} />
        <Stat label="Media" value={number(stats.mean)} />
        <Stat label="Desv. típica" value={number(stats.stdDev)} />
        <Stat label="Suma" value={number(stats.sum, true)} />
        <Stat label="P25" value={number(stats.p25)} />
        <Stat label="P75" value={number(stats.p75)} />
        <Stat
          label="Ceros / negativos"
          value={`${formatCount(stats.zeros)} / ${formatCount(stats.negatives)}`}
        />
      </dl>
    </div>
  );
}

function DateBody({ column }: { column: ColumnStats }) {
  const stats = column.date;
  if (stats === null) return null;

  const peak = Math.max(...stats.buckets.map((bucket) => bucket.count), 1);

  return (
    <div className="space-y-2">
      <div
        className="flex h-16 items-end gap-px"
        role="img"
        aria-label={`Filas por período de ${column.name}`}
      >
        {stats.buckets.map((bucket) => (
          <div
            key={bucket.label}
            className="min-h-px flex-1 rounded-t-xs bg-primary/60"
            style={{ height: `${(bucket.count / peak) * 100}%` }}
            title={`${bucket.label}: ${formatCount(bucket.count)}`}
          />
        ))}
      </div>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs tabular-nums sm:grid-cols-3">
        <Stat label="Desde" value={stats.min} />
        <Stat label="Hasta" value={stats.max} />
        <Stat label="Días" value={formatCount(stats.spanDays)} />
      </dl>
    </div>
  );
}

function TopBody({ column }: { column: ColumnStats }) {
  if (column.top === null || column.top.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Sin valores: esta columna no aporta nada al análisis.
      </p>
    );
  }

  return (
    <ul className="space-y-1">
      {column.top.map((item) => (
        <li key={item.value} className="relative flex items-center gap-2 text-xs">
          {/* La barra va detrás del texto: comparar frecuencias no debería
              costar una columna extra en una tarjeta ya estrecha. */}
          <span
            className="absolute inset-y-0 left-0 -z-10 rounded-xs bg-primary/10"
            style={{ width: `${item.share}%` }}
            aria-hidden
          />
          <span className="min-w-0 flex-1 truncate" title={item.value}>
            {item.value}
          </span>
          <span className="shrink-0 tabular-nums text-muted-foreground">
            {formatCount(item.count)} · {item.share.toFixed(1)} %
          </span>
        </li>
      ))}
    </ul>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="truncate text-muted-foreground">{label}</dt>
      <dd className={cn('truncate font-medium')}>{value}</dd>
    </div>
  );
}

function number(value: number, compact = false): string {
  return formatMetric(value, { format: 'numero', currency: 'EUR', compact });
}
