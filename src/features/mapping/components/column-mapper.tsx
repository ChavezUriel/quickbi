import { useMemo } from 'react';
import { Info, TriangleAlert } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useMediaQuery } from '@/lib/use-media-query';
import { cn } from '@/lib/utils';
import type { ColumnProfile, ColumnType } from '@/features/dataset/lib/column-types';
import type { ParsedDataset } from '@/features/dataset/types';
import { DataTypeBadge, DataTypeIcon } from '@/components/icons/data-type-icons';
import { SELECTABLE_TYPES, TYPE_LABEL, describeFormat } from '../labels';
import type { ColumnMappingState } from '../use-column-mapping';
import { CastFailureDetail } from './cast-failure-detail';
import { generateCastReport } from '../lib/cast-report';

interface ColumnMapperProps {
  dataset: ParsedDataset;
  /**
   * Estado del mapeo, creado por el padre con `useColumnMapping`: el gráfico
   * necesita el mismo estado, así que no puede vivir dentro de este componente.
   */
  state: ColumnMappingState;
}

/**
 * La muestra es lo primero que sobra cuando el ancho aprieta: confirma la
 * lectura de la columna, pero el tipo y el recuento ya la resumen. En la ficha
 * de móvil sigue estando, donde va debajo y no compite con nada.
 */
const SAMPLE_COLUMN = 'hidden lg:table-cell';

interface RowProps {
  column: ColumnProfile;
  dataset: ParsedDataset;
  preserveInvalid: boolean;
  setColumnType: (name: string, type: ColumnType) => void;
  setPreserveInvalid: (columnName: string, preserve: boolean) => void;
}

/**
 * Paso intermedio entre la vista previa y el gráfico: el usuario confirma los
 * tipos inferidos y gestiona posibles errores de conversión.
 *
 * Se dibuja de dos maneras. Con sitio, una tabla: cuatro datos por columna
 * comparados en vertical de un vistazo. Sin él, una lista de fichas, porque
 * una tabla de cuatro columnas —una con un desplegable dentro— en 375 px se
 * convierte en un carrusel horizontal que nadie quiere manejar.
 */
export function ColumnMapper({ dataset, state }: ColumnMapperProps) {
  const { columns, preserveInvalid, effectiveRowCount, setColumnType, setPreserveInvalid } =
    state;

  const isWide = useMediaQuery('(min-width: 40rem)');
  const isFiltered = effectiveRowCount < dataset.rowCount;

  const rowProps = (column: ColumnProfile): RowProps => ({
    column,
    dataset,
    preserveInvalid: !!preserveInvalid[column.name],
    setColumnType,
    setPreserveInvalid,
  });

  return (
    <Card className="mx-auto w-full max-w-5xl shadow-xs">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold tracking-tight">Tipos de columna</CardTitle>
        <CardDescription className="text-sm text-pretty text-muted-foreground">
          Detectados automáticamente a partir de los datos. Corrige el que no encaje: de ello depende
          qué columnas puedes medir y por cuáles puedes agrupar.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {isFiltered ? (
          <Alert variant="destructive" role="status" className="rounded-xl">
            <TriangleAlert className="size-4" />
            <AlertTitle className="font-semibold">Filas excluidas por errores de conversión</AlertTitle>
            <AlertDescription className="text-xs">
              {effectiveRowCount.toLocaleString('es-MX')} de{' '}
              {dataset.rowCount.toLocaleString('es-MX')} filas se incluirán en el análisis.
            </AlertDescription>
          </Alert>
        ) : (
          <Alert role="status" className="rounded-xl">
            <Info className="size-4 text-primary" />
            <AlertDescription className="text-xs">
              {effectiveRowCount.toLocaleString('es-MX')} de{' '}
              {dataset.rowCount.toLocaleString('es-MX')} filas se incluirán en el análisis.
            </AlertDescription>
          </Alert>
        )}

        {/* Se elige en JS, no con `hidden`: montar las dos formas duplicaría el
            informe de casteo de cada columna, que recorre el dataset entero. */}
        {isWide ? (
          <div className="max-h-[60vh] overflow-auto rounded-xl border border-border/80 bg-card">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-muted/40 backdrop-blur-xs border-b border-border/80">
                <TableRow className="hover:bg-transparent border-b border-border/80">
                  <TableHead scope="col" className="w-48 px-3.5 py-2.5 text-xs font-semibold text-foreground">
                    Columna
                  </TableHead>
                  <TableHead scope="col" className="w-44 px-3.5 py-2.5 text-xs font-semibold text-foreground">
                    Tipo de dato
                  </TableHead>
                  <TableHead scope="col" className="px-3.5 py-2.5 text-xs font-semibold text-foreground">
                    Datos y Calidad
                  </TableHead>
                  <TableHead scope="col" className={cn('px-3.5 py-2.5 text-xs font-semibold text-foreground', SAMPLE_COLUMN)}>
                    Muestra de valores
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {columns.map((column) => (
                  <ColumnRow key={column.name} {...rowProps(column)} />
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {columns.map((column) => (
              <ColumnCard key={column.name} {...rowProps(column)} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function ColumnRow(props: RowProps) {
  const { column } = props;

  return (
    <TableRow className="hover:bg-muted/15 border-b border-border/60 transition-colors">
      <TableCell className="px-3.5 py-3 align-top font-mono text-xs font-medium text-foreground whitespace-nowrap">
        <div className="flex items-center gap-2">
          <DataTypeIcon type={column.type} subtype={column.subtype} colored className="size-4 shrink-0" />
          <span className="truncate">{column.name}</span>
        </div>
      </TableCell>

      <TableCell className="px-3.5 py-2.5 align-top">
        <div className="w-full min-w-[140px] max-w-[180px]">
          <TypeSelect {...props} />
        </div>
      </TableCell>

      <TableCell className="px-3.5 py-3 align-top text-xs">
        <ColumnStats column={column} />
        <InvalidControls {...props} />
      </TableCell>

      <TableCell
        className={cn(
          'max-w-xs truncate px-3.5 py-3 align-top font-mono text-xs text-muted-foreground',
          SAMPLE_COLUMN,
        )}
      >
        {column.samples.join(' · ') || '—'}
      </TableCell>
    </TableRow>
  );
}

function ColumnCard(props: RowProps) {
  const { column } = props;

  return (
    <li className="space-y-2.5 rounded-xl border border-border/80 bg-card p-3.5 shadow-2xs">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <DataTypeIcon type={column.type} subtype={column.subtype} colored className="size-4 shrink-0" />
          <span className="min-w-0 truncate font-mono text-xs font-semibold text-foreground" title={column.name}>
            {column.name}
          </span>
        </div>
        <div className="w-36 shrink-0">
          <TypeSelect {...props} />
        </div>
      </div>

      <div className="text-xs space-y-1">
        <ColumnStats column={column} />
        <p className="truncate font-mono text-[11px] text-muted-foreground bg-muted/30 px-2 py-1 rounded-md">
          {column.samples.join(' · ') || '—'}
        </p>
        <InvalidControls {...props} />
      </div>
    </li>
  );
}

function TypeSelect({ column, setColumnType }: RowProps) {
  return (
    <Select
      value={column.type}
      onValueChange={(value: ColumnType | null) => {
        if (value !== null) setColumnType(column.name, value);
      }}
      items={SELECTABLE_TYPES.map((type) => ({ value: type, label: TYPE_LABEL[type] }))}
    >
      <SelectTrigger
        size="sm"
        className="h-8 w-full shrink-0 rounded-lg text-xs"
        aria-label={`Tipo de la columna ${column.name}`}
      >
        <div className="flex items-center gap-1.5 truncate">
          <DataTypeIcon type={column.type} subtype={column.subtype} colored className="size-3.5 shrink-0" />
          <SelectValue />
        </div>
      </SelectTrigger>
      <SelectContent>
        {SELECTABLE_TYPES.map((type) => (
          <SelectItem key={type} value={type} className="text-xs">
            <div className="flex items-center gap-2">
              <DataTypeIcon type={type} colored className="size-3.5 shrink-0" />
              <span>{TYPE_LABEL[type]}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Detalle de los valores que no convierten y qué hacer con ellos. */
function InvalidControls({ column, dataset, preserveInvalid, setPreserveInvalid }: RowProps) {
  const failures = useMemo(() => {
    if (column.invalidCount === 0) return [];
    return generateCastReport(dataset, column.name, column.type, column.format);
  }, [dataset, column.name, column.type, column.format, column.invalidCount]);

  if (column.invalidCount === 0) return null;

  return (
    <div className="mt-2 space-y-1.5">
      <CastFailureDetail failures={failures} columnName={column.name} />
      <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground select-none hover:text-foreground transition-colors">
        <input
          type="checkbox"
          checked={preserveInvalid}
          onChange={(event) => setPreserveInvalid(column.name, event.target.checked)}
          className="size-3.5 rounded border-input text-primary focus:ring-1 focus:ring-ring cursor-pointer"
        />
        <span>Preservar valores no convertibles</span>
      </label>
    </div>
  );
}

function ColumnStats({ column }: { column: ColumnProfile }) {
  const format = describeFormat(column.format);

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-1.5 text-muted-foreground leading-snug">
        {column.subtype && column.subtype !== (column.type as string) && (
          <DataTypeBadge type={column.type} subtype={column.subtype} showSubtype size="xs" />
        )}
        <span>
          <strong className="font-medium text-foreground">
            {column.distinctCount.toLocaleString('es-MX')}
            {column.distinctCountExact ? '' : '+'}
          </strong>{' '}
          distintos
        </span>
        {column.nullCount > 0 && (
          <span className="text-amber-600 dark:text-amber-400">
            {' · '}
            {column.nullCount.toLocaleString('es-MX')} vacíos
          </span>
        )}
      </div>
      {format && <p className="text-muted-foreground/80 font-mono text-[11px]">{format}</p>}
    </div>
  );
}
