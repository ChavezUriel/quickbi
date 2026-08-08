import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { CastFailure } from '../lib/cast-report';

interface CastFailureDetailProps {
  failures: CastFailure[];
  columnName: string;
}

export function CastFailureDetail({ failures, columnName }: CastFailureDetailProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showAll, setShowAll] = useState(false);

  if (failures.length === 0) return null;

  const visibleFailures = showAll ? failures : failures.slice(0, 10);
  const hasMore = failures.length > visibleFailures.length;

  return (
    <div className="mt-1 space-y-2">
      <Button
        variant="link"
        size="xs"
        onClick={() => setIsExpanded((prev) => !prev)}
        className="h-auto p-0 text-xs text-destructive hover:text-destructive/80 font-medium inline-flex items-center gap-1"
        aria-expanded={isExpanded}
        aria-label={`Ver detalles de errores de conversión para ${columnName}`}
      >
        <span>{failures.length} {failures.length === 1 ? 'valor no convertible' : 'valores no convertibles'}</span>
        {isExpanded ? (
          <ChevronUp className="size-3 shrink-0" />
        ) : (
          <ChevronDown className="size-3 shrink-0" />
        )}
      </Button>

      {isExpanded && (
        <div className="space-y-2 rounded-md border bg-muted/20 p-2 text-xs">
          <div className="max-h-60 overflow-y-auto rounded border bg-background">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="h-7 px-2 text-xs font-semibold">Archivo</TableHead>
                  <TableHead className="h-7 px-2 text-xs font-semibold">Fila</TableHead>
                  <TableHead className="h-7 px-2 text-xs font-semibold">Valor original</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleFailures.map((failure, index) => (
                  <TableRow key={`${failure.sourceFile}-${failure.rowNumber}-${index}`}>
                    <TableCell className="px-2 py-1 font-mono text-xs text-muted-foreground whitespace-nowrap">
                      {failure.sourceFile}
                    </TableCell>
                    <TableCell className="px-2 py-1 font-mono text-xs text-muted-foreground whitespace-nowrap">
                      {failure.rowNumber}
                    </TableCell>
                    <TableCell className="px-2 py-1 font-mono text-xs text-destructive whitespace-nowrap max-w-[200px] truncate">
                      {failure.originalValue || <span className="italic text-muted-foreground">(vacío)</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {hasMore && (
            <div className="pt-1 text-center">
              <Button
                variant="link"
                size="xs"
                onClick={() => setShowAll(true)}
                className="h-auto p-0 text-xs font-normal"
              >
                Mostrar más ({failures.length - visibleFailures.length} restantes)
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
