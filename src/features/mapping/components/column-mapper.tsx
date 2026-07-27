import { TriangleAlert } from 'lucide-react';
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
import {
  AGGREGATION_LABEL,
  AGGREGATION_PHRASE,
  AGGREGATIONS,
  SELECTABLE_TYPES,
  TYPE_LABEL,
  describeFormat,
} from '../labels';
import { isMappingComplete, needsMeasure, type Aggregation } from '../types';
import { useColumnMapping } from '../use-column-mapping';

/** Por encima de esto, un gráfico de barras deja de leerse. */
const MAX_READABLE_CATEGORIES = 50;

interface ColumnMapperProps {
  dataset: ParsedDataset;
}

/**
 * Paso intermedio entre la vista previa y el gráfico: el usuario confirma los
 * tipos inferidos y elige qué se mide y cómo se agrupa.
 */
export function ColumnMapper({ dataset }: ColumnMapperProps) {
  const {
    columns,
    dimensions,
    measures,
    mapping,
    setColumnType,
    setDimension,
    setMeasure,
    setAggregation,
  } = useColumnMapping(dataset);

  const dimension = columns.find((column) => column.name === mapping.dimension);
  const showMeasure = needsMeasure(mapping.aggregation);

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

        <CardContent>
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
                  <TableRow key={column.name}>
                    <TableCell className="font-mono text-xs whitespace-nowrap">
                      {column.name}
                    </TableCell>

                    <TableCell>
                      <Select
                        value={column.type}
                        // Base UI admite deseleccionar; aquí siempre hay un tipo.
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

                    <TableCell className="text-xs whitespace-nowrap">
                      <ColumnStats column={column} />
                    </TableCell>

                    <TableCell className="max-w-xs truncate font-mono text-xs text-muted-foreground">
                      {column.samples.join(' · ') || '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

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
            complete={isMappingComplete(mapping)}
            hasDimensions={dimensions.length > 0}
            hasMeasures={measures.length > 0}
          />
        </CardContent>
      </Card>
    </div>
  );
}

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

function ColumnStats({ column }: { column: ColumnProfile }) {
  const format = describeFormat(column.format);

  return (
    <div className="space-y-0.5">
      <p className="text-muted-foreground">
        {column.distinctCount.toLocaleString('es-ES')}
        {column.distinctCountExact ? '' : '+'} distintos
        {column.nullCount > 0 && ` · ${column.nullCount.toLocaleString('es-ES')} vacíos`}
      </p>
      {column.invalidCount > 0 && (
        <p className="text-destructive">
          {column.invalidCount.toLocaleString('es-ES')} no convertibles
        </p>
      )}
      {format && <p className="text-muted-foreground">{format}</p>}
    </div>
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
            en un gráfico. Considera agrupar por una columna de menor cardinalidad.
          </AlertDescription>
        </Alert>
      )}

      <p className="text-xs text-muted-foreground">
        La visualización se añadirá en el siguiente paso.
      </p>
    </div>
  );
}
