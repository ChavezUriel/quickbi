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
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { CellValue, ParsedDataset } from '../types';

const PREVIEW_ROW_COUNT = 5;

interface DatasetPreviewProps {
  dataset: ParsedDataset;
}

/**
 * Vista previa del dataset: nombre de columnas + primeras 5 filas.
 * Es la última validación visual del usuario antes de entrar al mapeo de columnas.
 */
export function DatasetPreview({ dataset }: DatasetPreviewProps) {
  const previewRows = dataset.rows.slice(0, PREVIEW_ROW_COUNT);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
          <span className="break-all">{dataset.fileName}</span>
          <Badge variant="secondary">{dataset.fileType.toUpperCase()}</Badge>
          <Badge variant="outline">{dataset.rowCount.toLocaleString()} filas</Badge>
        </CardTitle>
        <CardDescription>
          {dataset.columns.length} columnas detectadas — vista previa de las primeras{' '}
          {PREVIEW_ROW_COUNT} filas
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Nombres de columna */}
        <div className="flex flex-wrap gap-1.5">
          {dataset.columns.map((column) => (
            <Badge key={column} variant="outline" className="font-mono text-xs">
              {column}
            </Badge>
          ))}
        </div>

        {/* Tabla responsive con scroll horizontal */}
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                {dataset.columns.map((column) => (
                  <TableHead key={column} className="font-mono text-xs whitespace-nowrap">
                    {column}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {previewRows.map((row, rowIndex) => (
                <TableRow key={rowIndex}>
                  {dataset.columns.map((column) => (
                    <TableCell key={column} className="text-sm whitespace-nowrap">
                      {formatCell(row[column])}
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

function formatCell(value: CellValue): string {
  if (value === null || value === undefined) return '—';
  if (value instanceof Date) return value.toLocaleDateString('es-ES');
  return String(value);
}
