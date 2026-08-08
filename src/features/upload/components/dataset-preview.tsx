import { TriangleAlert } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { CellValue, ParsedDataset } from '@/features/dataset/types';

const PREVIEW_ROW_COUNT = 5;

interface DatasetPreviewProps {
  dataset: ParsedDataset;
  sourceFileCount?: number;
}

/**
 * Vista previa del dataset: nombre de columnas + primeras 5 filas.
 * Es la última validación visual del usuario antes de entrar al mapeo de columnas.
 */
export function DatasetPreview({ dataset, sourceFileCount }: DatasetPreviewProps) {
  const previewRows = dataset.rows.slice(0, PREVIEW_ROW_COUNT);
  const showMultipleFilesTitle = sourceFileCount && sourceFileCount > 1;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
          <span className="break-all">
            {showMultipleFilesTitle
              ? `${sourceFileCount} archivos combinados`
              : dataset.fileName}
          </span>
          {!showMultipleFilesTitle && (
            <Badge variant="secondary">{dataset.fileType.toUpperCase()}</Badge>
          )}
          <Badge variant="outline">{dataset.rowCount.toLocaleString('es-ES')} filas</Badge>
        </CardTitle>
        <CardDescription>
          {dataset.columns.length} columnas detectadas — vista previa de las primeras{' '}
          {Math.min(PREVIEW_ROW_COUNT, dataset.rowCount)} filas
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Avisos no fatales: hojas ignoradas, filas truncadas… */}
        {dataset.warnings.length > 0 && (
          <Alert role="status">
            <TriangleAlert className="size-4" />
            <AlertTitle>Revisa la importación</AlertTitle>
            <AlertDescription>
              <ul className="list-inside list-disc space-y-1">
                {dataset.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* Nombres de columna */}
        <div className="flex flex-wrap gap-1.5">
          {dataset.columns.map((column) => (
            <Badge key={column.name} variant="outline" className="font-mono text-xs">
              {column.name}
            </Badge>
          ))}
        </div>

        {/* Tabla responsive con scroll horizontal */}
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableCaption className="sr-only">
              Vista previa de {dataset.fileName}: primeras{' '}
              {Math.min(PREVIEW_ROW_COUNT, dataset.rowCount)} de {dataset.rowCount} filas.
            </TableCaption>
            <TableHeader>
              <TableRow>
                {dataset.columns.map((column) => (
                  <TableHead
                    key={column.name}
                    scope="col"
                    className="font-mono text-xs whitespace-nowrap"
                  >
                    {column.name}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {previewRows.map((row, rowIndex) => (
                // eslint-disable-next-line react/no-array-index-key -- la vista previa es de solo lectura y no se reordena
                <TableRow key={rowIndex}>
                  {dataset.columns.map((column) => (
                    <TableCell key={column.name} className="text-sm whitespace-nowrap">
                      {formatCell(row[column.name])}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function formatCell(value: CellValue | undefined): string {
  if (value === null || value === undefined) return '—';
  if (value instanceof Date) return value.toLocaleDateString('es-ES');
  if (typeof value === 'number') return value.toLocaleString('es-ES');
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  return value;
}
