import { useEffect, useMemo, useRef } from 'react';
import { Info, TriangleAlert } from 'lucide-react';
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
  isSelected: boolean;
  preserveInvalid: boolean;
  setColumnType: (name: string, type: ColumnType) => void;
  setPreserveInvalid: (columnName: string, preserve: boolean) => void;
  setColumnSelected: (columnName: string, selected: boolean) => void;
}

/**
 * Paso intermedio entre la vista previa y el gráfico: el usuario confirma los
 * tipos inferidos, selecciona/deselecciona campos para las visualizaciones y gestiona
 * posibles errores de conversión.
 *
 * Se dibuja de dos maneras. Con sitio, una tabla: cuatro datos por columna
 * comparados en vertical de un vistazo. Sin él, una lista de fichas, porque
 * una tabla de cuatro columnas —una con un desplegable dentro— en 375 px se
 * convierte en un carrusel horizontal que nadie quiere manejar.
 */
export function ColumnMapper({ dataset, state }: ColumnMapperProps) {
  const {
    columns,
    allColumns,
    preserveInvalid,
    effectiveRowCount,
    setColumnType,
    setPreserveInvalid,
    setColumnSelected,
    selectAllColumns,
    deselectAllColumns,
    isColumnSelected,
  } = state;

  const isWide = useMediaQuery('(min-width: 40rem)');
  const isFiltered = effectiveRowCount < dataset.rowCount;

  const allSelected = allColumns.length > 0 && columns.length === allColumns.length;
  const someSelected = columns.length > 0 && columns.length < allColumns.length;

  const headerCheckboxRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = someSelected;
    }
  }, [someSelected]);

  const handleToggleAll = () => {
    if (allSelected) {
      deselectAllColumns();
    } else {
      selectAllColumns();
    }
  };

  const rowProps = (column: ColumnProfile): RowProps => ({
    column,
    dataset,
    isSelected: isColumnSelected(column.name),
    preserveInvalid: !!preserveInvalid[column.name],
    setColumnType,
    setPreserveInvalid,
    setColumnSelected,
  });

  return (
    <Card className="mx-auto w-full max-w-5xl shadow-xs">
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg font-semibold tracking-tight">
                Tipos y selección de campos
              </CardTitle>
              <Badge
                variant={columns.length > 0 ? 'secondary' : 'destructive'}
                className="text-xs font-normal"
              >
                {columns.length} de {allColumns.length} seleccionados
              </Badge>
            </div>
            <CardDescription className="text-sm text-pretty text-muted-foreground">
              Detectados automáticamente a partir de los datos. Deselecciona los campos que no quieras
              usar en las herramientas de visualización y ajusta los tipos si es necesario.
            </CardDescription>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={selectAllColumns}
              disabled={allSelected}
              className="h-8 text-xs cursor-pointer"
            >
              Seleccionar todos
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={deselectAllColumns}
              disabled={columns.length === 0}
              className="h-8 text-xs cursor-pointer"
            >
              Deseleccionar todos
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {columns.length === 0 ? (
          <Alert variant="destructive" role="status" className="rounded-xl">
            <TriangleAlert className="size-4" />
            <AlertTitle className="font-semibold">No hay ningún campo seleccionado</AlertTitle>
            <AlertDescription className="text-xs">
              Debes seleccionar al menos un campo para poder avanzar y utilizar las herramientas de
              visualización.
            </AlertDescription>
          </Alert>
        ) : isFiltered ? (
          <Alert variant="destructive" role="status" className="rounded-xl">
            <TriangleAlert className="size-4" />
            <AlertTitle className="font-semibold">Filas excluidas por errores de conversión</AlertTitle>
            <AlertDescription className="text-xs">
              {effectiveRowCount.toLocaleString('es-MX')} de{' '}
              {dataset.rowCount.toLocaleString('es-MX')} filas y {columns.length} de{' '}
              {allColumns.length} campos seleccionados se incluirán en el análisis.
            </AlertDescription>
          </Alert>
        ) : (
          <Alert role="status" className="rounded-xl">
            <Info className="size-4 text-primary" />
            <AlertDescription className="text-xs">
              {effectiveRowCount.toLocaleString('es-MX')} de{' '}
              {dataset.rowCount.toLocaleString('es-MX')} filas y {columns.length} de{' '}
              {allColumns.length} campos se incluirán en el análisis.
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
                  <TableHead scope="col" className="w-12 px-3 py-2.5 text-center">
                    <input
                      ref={headerCheckboxRef}
                      type="checkbox"
                      checked={allSelected}
                      onChange={handleToggleAll}
                      aria-label="Seleccionar o deseleccionar todas las columnas"
                      className="size-4 rounded border-input text-primary focus:ring-1 focus:ring-ring cursor-pointer"
                    />
                  </TableHead>
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
                {allColumns.map((column) => (
                  <ColumnRow key={column.name} {...rowProps(column)} />
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {allColumns.map((column) => (
              <ColumnCard key={column.name} {...rowProps(column)} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function ColumnRow(props: RowProps) {
  const { column, isSelected, setColumnSelected } = props;

  return (
    <TableRow
      className={cn(
        'border-b border-border/60 transition-colors',
        isSelected ? 'hover:bg-muted/15' : 'bg-muted/5 opacity-60 hover:opacity-80',
      )}
    >
      <TableCell className="px-3 py-3 align-top text-center">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(event) => setColumnSelected(column.name, event.target.checked)}
          aria-label={`Incluir campo ${column.name} en el análisis`}
          className="size-4 rounded border-input text-primary focus:ring-1 focus:ring-ring cursor-pointer mt-0.5"
        />
      </TableCell>

      <TableCell className="px-3.5 py-3 align-top font-mono text-xs font-medium text-foreground whitespace-nowrap">
        <div className="flex items-center gap-2">
          <DataTypeIcon
            type={column.type}
            subtype={column.subtype}
            colored={isSelected}
            className={cn('size-4 shrink-0', !isSelected && 'grayscale opacity-60')}
          />
          <span
            className={cn(
              'truncate',
              !isSelected && 'text-muted-foreground line-through decoration-muted-foreground/40',
            )}
          >
            {column.name}
          </span>
          {!isSelected && (
            <Badge variant="outline" className="text-[10px] h-4 px-1 text-muted-foreground font-sans">
              Excluido
            </Badge>
          )}
        </div>
      </TableCell>

      <TableCell className="px-3.5 py-2.5 align-top">
        <div className="w-full min-w-[140px] max-w-[180px]">
          <TypeSelect {...props} />
        </div>
      </TableCell>

      <TableCell className="px-3.5 py-3 align-top text-xs">
        <ColumnStats column={column} isSelected={isSelected} />
        {isSelected && <InvalidControls {...props} />}
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
  const { column, isSelected, setColumnSelected } = props;

  return (
    <li
      className={cn(
        'space-y-2.5 rounded-xl border border-border/80 bg-card p-3.5 shadow-2xs transition-all',
        !isSelected && 'opacity-65 bg-muted/10 border-dashed',
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(event) => setColumnSelected(column.name, event.target.checked)}
            aria-label={`Incluir campo ${column.name} en el análisis`}
            className="size-4 rounded border-input text-primary focus:ring-1 focus:ring-ring cursor-pointer shrink-0"
          />
          <DataTypeIcon
            type={column.type}
            subtype={column.subtype}
            colored={isSelected}
            className={cn('size-4 shrink-0', !isSelected && 'grayscale opacity-60')}
          />
          <span
            className={cn(
              'min-w-0 truncate font-mono text-xs font-semibold text-foreground',
              !isSelected && 'text-muted-foreground line-through decoration-muted-foreground/40',
            )}
            title={column.name}
          >
            {column.name}
          </span>
          {!isSelected && (
            <Badge variant="outline" className="text-[10px] h-4 px-1 text-muted-foreground shrink-0 font-sans">
              Excluido
            </Badge>
          )}
        </div>
        <div className="w-36 shrink-0">
          <TypeSelect {...props} />
        </div>
      </div>

      <div className="text-xs space-y-1">
        <ColumnStats column={column} isSelected={isSelected} />
        <p className="truncate font-mono text-[11px] text-muted-foreground bg-muted/30 px-2 py-1 rounded-md">
          {column.samples.join(' · ') || '—'}
        </p>
        {isSelected && <InvalidControls {...props} />}
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

function ColumnStats({
  column,
  isSelected = true,
}: {
  column: ColumnProfile;
  isSelected?: boolean;
}) {
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
        {!isSelected && (
          <span className="text-muted-foreground/80 italic">
            {' · '}No se procesará en visualizaciones
          </span>
        )}
      </div>
      {format && <p className="text-muted-foreground/80 font-mono text-[11px]">{format}</p>}
    </div>
  );
}
