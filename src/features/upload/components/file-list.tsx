import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Columns3, FileSpreadsheet, FileText, Rows3, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { ParsedDataset } from '@/features/dataset/types';
import type { SchemaGroup } from '@/features/wizard/wizard-context';

interface FileListProps {
  datasets: ParsedDataset[];
  schemaGroups: SchemaGroup[];
  selectedFingerprint: string | null;
  onSelectFingerprint: (fingerprint: string) => void;
  onRemoveDataset: (id: string) => void;
}

export function FileList({
  datasets,
  schemaGroups,
  selectedFingerprint,
  onSelectFingerprint,
  onRemoveDataset,
}: FileListProps) {
  if (datasets.length === 0) {
    return null;
  }

  const isMultiGroup = schemaGroups.length > 1;

  if (!isMultiGroup) {
    return (
      <Card className="w-full h-full flex flex-col justify-between">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">
              Archivos cargados
            </CardTitle>
            <Badge variant="secondary" className="text-xs font-normal">
              {datasets.length} {datasets.length === 1 ? 'archivo' : 'archivos'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="my-auto">
          <PaginatedFileGrid
            datasets={datasets}
            onRemoveDataset={onRemoveDataset}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full h-full flex flex-col justify-between">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">
          Estructuras de datos detectadas
        </CardTitle>
        <CardDescription>
          Los archivos subidos tienen diferentes columnas. Selecciona el grupo de archivos
          que deseas analizar:
        </CardDescription>
      </CardHeader>

      <CardContent
        className="space-y-4 my-auto"
        role="radiogroup"
        aria-label="Grupo de archivos a analizar"
      >
        {schemaGroups.map((group, index) => {
          const isSelected = selectedFingerprint === group.fingerprint;
          const groupDatasets = group.datasetIds
            .map((id) => datasets.find((d) => d.id === id))
            .filter((d): d is ParsedDataset => d !== undefined);

          return (
            <Card
              key={group.fingerprint}
              role="radio"
              aria-checked={isSelected}
              tabIndex={0}
              className={cn(
                'cursor-pointer border-2 transition-all',
                'focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
                isSelected
                  ? 'border-primary bg-primary/5 shadow-xs'
                  : 'border-border/60 opacity-70 hover:border-muted-foreground/40 hover:opacity-100',
              )}
              onClick={() => onSelectFingerprint(group.fingerprint)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onSelectFingerprint(group.fingerprint);
                }
              }}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        'size-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5',
                        isSelected
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-muted-foreground/40',
                      )}
                    >
                      {isSelected && (
                        <div className="size-2 rounded-full bg-primary-foreground" />
                      )}
                    </div>
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <span>Grupo {index + 1}</span>
                      <Badge variant="outline" className="text-xs font-normal">
                        {groupDatasets.length}{' '}
                        {groupDatasets.length === 1 ? 'archivo' : 'archivos'}
                      </Badge>
                    </CardTitle>
                  </div>
                  {!isSelected && <Badge variant="secondary">Omitido</Badge>}
                </div>

                <div className="flex flex-wrap gap-1 mt-2">
                  {group.columnNames.map((col) => (
                    <Badge
                      key={col}
                      variant="outline"
                      className="font-mono text-xs bg-background/50"
                    >
                      {col}
                    </Badge>
                  ))}
                </div>
              </CardHeader>

              <CardContent className="pt-0">
                <PaginatedFileGrid
                  datasets={groupDatasets}
                  isOmitted={!isSelected}
                  onRemoveDataset={onRemoveDataset}
                />
              </CardContent>
            </Card>
          );
        })}
      </CardContent>
    </Card>
  );
}

interface PaginatedFileGridProps {
  datasets: ParsedDataset[];
  isOmitted?: boolean;
  onRemoveDataset: (id: string) => void;
}

function PaginatedFileGrid({
  datasets,
  isOmitted = false,
  onRemoveDataset,
}: PaginatedFileGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pageSize, setPageSize] = useState(3);
  const [currentPage, setCurrentPage] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updatePageSize = () => {
      const width = el.clientWidth;
      if (width <= 0) return;
      // Ancho mínimo por tarjeta (~170px) + gap de separación (12px)
      const minCardWidth = 170;
      const gap = 12;
      const count = Math.max(1, Math.floor((width + gap) / (minCardWidth + gap)));
      setPageSize(count);
    };

    updatePageSize();

    const observer = new ResizeObserver(() => {
      updatePageSize();
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const totalPages = Math.ceil(datasets.length / pageSize);
  const validPage = Math.min(currentPage, Math.max(0, totalPages - 1));

  const startIndex = validPage * pageSize;
  const pageDatasets = datasets.slice(startIndex, startIndex + pageSize);

  return (
    <div className="space-y-3">
      <div
        ref={containerRef}
        className="grid gap-3"
        style={{
          gridTemplateColumns: `repeat(${pageSize}, minmax(0, 1fr))`,
        }}
      >
        {pageDatasets.map((dataset) => (
          <FileCard
            key={dataset.id}
            dataset={dataset}
            isOmitted={isOmitted}
            onRemove={(e) => {
              e.stopPropagation();
              onRemoveDataset(dataset.id);
            }}
          />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-border/40 pt-2.5 text-xs text-muted-foreground">
          <span className="font-medium">
            Archivos {startIndex + 1}-{Math.min(startIndex + pageSize, datasets.length)} de{' '}
            {datasets.length}
          </span>

          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-7"
              disabled={validPage === 0}
              onClick={(e) => {
                e.stopPropagation();
                setCurrentPage((p) => Math.max(0, p - 1));
              }}
              aria-label="Página anterior"
              title="Página anterior"
            >
              <ChevronLeft className="size-3.5" />
            </Button>

            <span className="px-1 text-xs font-mono font-medium text-foreground">
              {validPage + 1} / {totalPages}
            </span>

            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-7"
              disabled={validPage >= totalPages - 1}
              onClick={(e) => {
                e.stopPropagation();
                setCurrentPage((p) => Math.min(totalPages - 1, p + 1));
              }}
              aria-label="Página siguiente"
              title="Página siguiente"
            >
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

interface FileCardProps {
  dataset: ParsedDataset;
  isOmitted?: boolean;
  onRemove: (e: React.MouseEvent) => void;
}

function FileCard({ dataset, isOmitted = false, onRemove }: FileCardProps) {
  const isCsv = dataset.fileType.toLowerCase() === 'csv';

  return (
    <div
      className={cn(
        'group relative flex flex-col justify-between rounded-xl border bg-card p-3 text-card-foreground shadow-xs transition-all duration-200 hover:border-primary/40 hover:shadow-md w-full',
        isOmitted ? 'border-dashed opacity-50 grayscale-[30%] hover:opacity-80' : 'opacity-100',
      )}
    >
      {/* Visual Header */}
      <div className="flex items-start justify-between gap-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <div
            className={cn(
              'flex size-7 shrink-0 items-center justify-center rounded-md border transition-colors',
              isCsv
                ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : 'border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400',
            )}
          >
            {isCsv ? <FileText className="size-3.5" /> : <FileSpreadsheet className="size-3.5" />}
          </div>
          <Badge
            variant="secondary"
            className="font-mono text-[9px] px-1 py-0 font-semibold uppercase tracking-wider"
          >
            .{dataset.fileType}
          </Badge>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-6 shrink-0 rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          onClick={onRemove}
          aria-label={`Eliminar ${dataset.fileName}`}
          title="Eliminar archivo"
        >
          <X className="size-3" />
        </Button>
      </div>

      {/* File Name */}
      <div className="my-2.5 min-w-0">
        <h4
          className="line-clamp-2 font-medium text-xs text-foreground leading-snug break-words"
          title={dataset.fileName}
        >
          {dataset.fileName}
        </h4>
      </div>

      {/* Footer Stats */}
      <div className="mt-auto flex items-center justify-between border-t border-border/50 pt-2 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <Rows3 className="size-3 text-muted-foreground/70" />
          <span>
            <strong className="font-medium text-foreground">
              {dataset.rowCount.toLocaleString('es-ES')}
            </strong>{' '}
            filas
          </span>
        </span>
        <span className="flex items-center gap-1">
          <Columns3 className="size-3 text-muted-foreground/70" />
          <span>
            <strong className="font-medium text-foreground">{dataset.columns.length}</strong> cols
          </span>
        </span>
      </div>

      {isOmitted && (
        <div className="mt-1.5 text-center">
          <Badge variant="outline" className="w-full justify-center text-[9px] text-muted-foreground py-0">
            Omitido
          </Badge>
        </div>
      )}
    </div>
  );
}

