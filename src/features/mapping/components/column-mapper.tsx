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
 * Paso intermedio entre la vista previa y el gráfico: el usuario confirma los
 * tipos inferidos y gestiona posibles errores de conversión.
 */
export function ColumnMapper({ dataset, state }: ColumnMapperProps) {
  const { columns, preserveInvalid, effectiveRowCount, setColumnType, setPreserveInvalid } = state;

  const isFiltered = effectiveRowCount < dataset.rowCount;

  return (
    <div className="space-y-4">
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
                {effectiveRowCount.toLocaleString('es-ES')} de{' '}
                {dataset.rowCount.toLocaleString('es-ES')} filas se incluirán en el análisis.
              </AlertDescription>
            </Alert>
          ) : (
            <Alert role="status">
              <Info className="size-4" />
              <AlertDescription>
                {effectiveRowCount.toLocaleString('es-ES')} de{' '}
                {dataset.rowCount.toLocaleString('es-ES')} filas se incluirán en el análisis.
              </AlertDescription>
            </Alert>
          )}

          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Columna</TableHead>
                  <TableHead scope="col">Tipo</TableHead>
                  <TableHead scope="col">Datos</TableHead>
                  <TableHead scope="col">Muestra</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {columns.map((column) => (
                  <ColumnRow
                    key={column.name}
                    column={column}
                    dataset={dataset}
                    preserveInvalid={!!preserveInvalid[column.name]}
                    setColumnType={setColumnType}
                    setPreserveInvalid={setPreserveInvalid}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ColumnRow({
  column,
  dataset,
  preserveInvalid,
  setColumnType,
  setPreserveInvalid,
}: {
  column: ColumnProfile;
  dataset: ParsedDataset;
  preserveInvalid: boolean;
  setColumnType: (name: string, type: ColumnType) => void;
  setPreserveInvalid: (columnName: string, preserve: boolean) => void;
}) {
  const failures = useMemo(() => {
    if (column.invalidCount === 0) return [];
    return generateCastReport(dataset, column.name, column.type, column.format);
  }, [dataset, column.name, column.type, column.format, column.invalidCount]);

  return (
    <TableRow>
      <TableCell className="font-mono text-xs whitespace-nowrap align-top pt-3">
        {column.name}
      </TableCell>

      <TableCell className="align-top pt-3">
        <Select
          value={column.type}
          onValueChange={(value: ColumnType | null) => {
            if (value !== null) setColumnType(column.name, value);
          }}
          items={SELECTABLE_TYPES.map((type) => ({
            value: type,
            label: TYPE_LABEL[type],
          }))}
        >
          <SelectTrigger
            size="sm"
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
      </TableCell>

      <TableCell className="text-xs align-top pt-3">
        <ColumnStats column={column} />
        {column.invalidCount > 0 && (
          <div className="mt-2 space-y-1.5">
            <CastFailureDetail failures={failures} columnName={column.name} />
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                checked={preserveInvalid}
                onChange={(e) => setPreserveInvalid(column.name, e.target.checked)}
                className="size-3.5 rounded border-input text-primary focus:ring-1 focus:ring-ring"
              />
              <span>Preservar valores no convertibles</span>
            </label>
          </div>
        )}
      </TableCell>

      <TableCell className="max-w-xs truncate font-mono text-xs text-muted-foreground align-top pt-3">
        {column.samples.join(' · ') || '—'}
      </TableCell>
    </TableRow>
  );
}

function ColumnStats({ column }: { column: ColumnProfile }) {
  const format = describeFormat(column.format);

  return (
    <div className="space-y-0.5">
      <p className="text-muted-foreground">
        {column.distinctCount.toLocaleString('es-ES')}
        {column.distinctCountExact ? '' : '+'} distintos
        {column.nullCount > 0 && ` · ${column.nullCount.toLocaleString('es-ES')} vacíos`}
      </p>
      {format && <p className="text-muted-foreground">{format}</p>}
    </div>
  );
}
