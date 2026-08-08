import { FileSpreadsheet, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
      <Card className="w-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">
            Archivos cargados ({datasets.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {datasets.map((dataset) => (
            <FileCard
              key={dataset.id}
              dataset={dataset}
              onRemove={() => onRemoveDataset(dataset.id)}
            />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="w-full space-y-4">
      <div className="space-y-1">
        <h3 className="text-base font-semibold">Estructuras de datos detectadas</h3>
        <p className="text-sm text-muted-foreground">
          Los archivos subidos tienen diferentes columnas. Selecciona el grupo de archivos que
          deseas analizar:
        </p>
      </div>

      <div className="space-y-3">
        {schemaGroups.map((group, index) => {
          const isSelected = selectedFingerprint === group.fingerprint;
          const groupDatasets = group.datasetIds
            .map((id) => datasets.find((d) => d.id === id))
            .filter((d): d is ParsedDataset => d !== undefined);

          return (
            <Card
              key={group.fingerprint}
              className={cn(
                'transition-all cursor-pointer border-2',
                isSelected
                  ? 'border-primary bg-primary/5 shadow-xs'
                  : 'border-border/60 hover:border-muted-foreground/40 opacity-70',
              )}
              onClick={() => onSelectFingerprint(group.fingerprint)}
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

              <CardContent className="space-y-2 pt-0">
                {groupDatasets.map((dataset) => (
                  <FileCard
                    key={dataset.id}
                    dataset={dataset}
                    isOmitted={!isSelected}
                    onRemove={(e) => {
                      e.stopPropagation();
                      onRemoveDataset(dataset.id);
                    }}
                  />
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

interface FileCardProps {
  dataset: ParsedDataset;
  isOmitted?: boolean;
  onRemove: (e: React.MouseEvent) => void;
}

function FileCard({ dataset, isOmitted = false, onRemove }: FileCardProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 p-3 rounded-lg border bg-card text-card-foreground transition-opacity',
        isOmitted ? 'opacity-50' : 'opacity-100',
      )}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <FileSpreadsheet className="size-5 text-muted-foreground shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-sm break-all">{dataset.fileName}</span>
            <Badge variant="secondary" className="text-[10px] uppercase">
              {dataset.fileType}
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              {dataset.rowCount.toLocaleString('es-ES')} filas
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              {dataset.columns.length} columnas
            </Badge>
            {isOmitted && (
              <Badge variant="secondary" className="text-[10px]">
                Omitido
              </Badge>
            )}
          </div>
        </div>
      </div>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
        onClick={onRemove}
        aria-label={`Eliminar ${dataset.fileName}`}
      >
        <X className="size-4" />
      </Button>
    </div>
  );
}
