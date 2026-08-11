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
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Tipos de columna</CardTitle>
        <CardDescription>
          Detectados a partir de los datos. Corrige el que no encaje: de ello depende
          qué columnas puedes medir y por cuáles puedes agrupar.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {isFiltered ? (
          <Alert variant="destructive" role="status">
            <TriangleAlert className="size-4" />
            <AlertTitle>Filas excluidas por errores de conversión</AlertTitle>
            <AlertDescription>
              {effectiveRowCount.toLocaleString('es-MX')} de{' '}
              {dataset.rowCount.toLocaleString('es-MX')} filas se incluirán en el análisis.
            </AlertDescription>
          </Alert>
        ) : (
          <Alert role="status">
            <Info className="size-4" />
            <AlertDescription>
              {effectiveRowCount.toLocaleString('es-MX')} de{' '}
              {dataset.rowCount.toLocaleString('es-MX')} filas se incluirán en el análisis.
            </AlertDescription>
          </Alert>
        )}

        {/* Se elige en JS, no con `hidden`: montar las dos formas duplicaría el
            informe de casteo de cada columna, que recorre el dataset entero. */}
        {isWide ? (
          <div className="max-h-[65vh] overflow-auto rounded-md border">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow>
                  <TableHead scope="col">Columna</TableHead>
                  <TableHead scope="col">Tipo</TableHead>
                  <TableHead scope="col">Datos</TableHead>
                  <TableHead scope="col" className={SAMPLE_COLUMN}>
                    Muestra
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
          <ul className="space-y-2">
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
    <TableRow>
      <TableCell className="pt-3 align-top font-mono text-xs whitespace-nowrap">
        {column.name}
      </TableCell>

      <TableCell className="pt-3 align-top">
        <TypeSelect {...props} />
      </TableCell>

      <TableCell className="pt-3 align-top text-xs">
        <ColumnStats column={column} />
        <InvalidControls {...props} />
      </TableCell>

      <TableCell
        className={cn(
          'max-w-xs truncate pt-3 align-top font-mono text-xs text-muted-foreground',
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
    <li className="space-y-2 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0 truncate font-mono text-xs font-medium" title={column.name}>
          {column.name}
        </span>
        <TypeSelect {...props} />
      </div>

      <div className="text-xs">
        <ColumnStats column={column} />
        <p className="mt-0.5 truncate font-mono text-muted-foreground">
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
        className="h-8 shrink-0 md:h-7"
        aria-label={`Tipo de la columna ${column.name}`}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SELECTABLE_TYPES.map((type) => (
          <SelectItem key={type} value={type}>
            {TYPE_LABEL[type]}
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
      <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground select-none">
        <input
          type="checkbox"
          checked={preserveInvalid}
          onChange={(event) => setPreserveInvalid(column.name, event.target.checked)}
          className="size-3.5 rounded border-input text-primary focus:ring-1 focus:ring-ring"
        />
        <span>Preservar valores no convertibles</span>
      </label>
    </div>
  );
}

function ColumnStats({ column }: { column: ColumnProfile }) {
  const format = describeFormat(column.format);

  return (
    <div className="space-y-0.5">
      <p className="text-muted-foreground">
        {column.distinctCount.toLocaleString('es-MX')}
        {column.distinctCountExact ? '' : '+'} distintos
        {column.nullCount > 0 && ` · ${column.nullCount.toLocaleString('es-MX')} vacíos`}
      </p>
      {format && <p className="text-muted-foreground">{format}</p>}
    </div>
  );
}
