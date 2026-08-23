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
    <div className="mt-1.5 space-y-2">
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        className="inline-flex items-center gap-1.5 rounded-md border border-destructive/25 bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive hover:bg-destructive/15 transition-colors cursor-pointer"
        aria-expanded={isExpanded}
        aria-label={`Ver detalles de errores de conversión para ${columnName}`}
      >
        <span>{failures.length} {failures.length === 1 ? 'no convertible' : 'no convertibles'}</span>
        {isExpanded ? (
          <ChevronUp className="size-3 shrink-0" />
        ) : (
          <ChevronDown className="size-3 shrink-0" />
        )}
      </button>

      {isExpanded && (
        <div className="space-y-2 rounded-xl border border-destructive/20 bg-destructive/5 p-2.5 text-xs">
          <div className="max-h-52 overflow-y-auto rounded-lg border border-border/80 bg-background shadow-2xs">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="h-7 px-2.5 text-[11px] font-semibold">Archivo</TableHead>
                  <TableHead className="h-7 px-2.5 text-[11px] font-semibold">Fila</TableHead>
                  <TableHead className="h-7 px-2.5 text-[11px] font-semibold">Valor original</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleFailures.map((failure, index) => (
                  <TableRow key={`${failure.sourceFile}-${failure.rowNumber}-${index}`} className="hover:bg-muted/20">
                    <TableCell className="px-2.5 py-1 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                      {failure.sourceFile}
                    </TableCell>
                    <TableCell className="px-2.5 py-1 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                      {failure.rowNumber}
                    </TableCell>
                    <TableCell className="px-2.5 py-1 font-mono text-[11px] text-destructive whitespace-nowrap max-w-[180px] truncate">
                      {failure.originalValue || <span className="italic text-muted-foreground">(vacío)</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {hasMore && (
            <div className="pt-0.5 text-center">
              <Button
                variant="link"
                size="xs"
                onClick={() => setShowAll(true)}
                className="h-auto p-0 text-[11px] text-destructive font-medium"
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
