import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { AggregateResult } from '../lib/aggregate';

const number = new Intl.NumberFormat('es-ES');

interface ChartTableProps {
  result: AggregateResult;
  dimensionHeader: string;
  valueHeader: string;
}

/**
 * Los mismos datos del gráfico en forma de tabla: respaldo accesible para
 * lectores de pantalla y forma de verificar las cifras exactas.
 */
export function ChartTable({ result, dimensionHeader, valueHeader }: ChartTableProps) {
  return (
    <div className="max-h-72 overflow-auto rounded-md border">
      <Table>
        <TableCaption className="sr-only">
          Datos agregados del gráfico: {valueHeader} por {dimensionHeader}.
        </TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead scope="col">{dimensionHeader}</TableHead>
            <TableHead scope="col" className="text-right">
              {valueHeader}
            </TableHead>
            <TableHead scope="col" className="text-right">
              Filas
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {result.rows.map((row) => (
            <TableRow key={row.label} className={row.isOthers ? 'text-muted-foreground' : ''}>
              <TableCell className="font-medium">{row.label}</TableCell>
              <TableCell className="text-right tabular-nums">
                {number.format(row.value)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {number.format(row.rowCount)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
