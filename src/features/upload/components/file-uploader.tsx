import { useCallback, useRef, useState } from 'react';
import { Loader2, Lock, UploadCloud } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { FileParseError } from '../lib/parse-error';
import { parseFileWithWorker } from '../lib/parse-client';
import type { ParsedDataset } from '@/features/dataset/types';

const ACCEPTED_EXTENSIONS = ['.csv', '.xlsx', '.xls'];

interface FileUploaderProps {
  /** Callback invocado una vez por cada archivo parseado con éxito en memoria. */
  onDatasetParsed: (dataset: ParsedDataset) => void;
  /**
   * Versión reducida, para cuando ya hay archivos cargados: la zona de carga
   * deja de ser el objetivo de la pantalla y no merece media ventana.
   */
  compact?: boolean;
}

export function FileUploader({ onDatasetParsed, compact = false }: FileUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [parsingCount, setParsingCount] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);

  const handleFiles = useCallback(
    async (fileList: FileList | File[] | null | undefined) => {
      if (!fileList) return;
      const files = Array.from(fileList);
      if (files.length === 0) return;

      setErrors([]);
      setIsParsing(true);
      setParsingCount(files.length);

      try {
        const results = await Promise.allSettled(
          files.map(async (file) => {
            const dataset = await parseFileWithWorker(file);
            onDatasetParsed(dataset);
            return dataset;
          }),
        );

        const newErrors: string[] = [];
        results.forEach((result, index) => {
          if (result.status === 'rejected') {
            const file = files[index];
            const fileName = file?.name ?? 'archivo';
            const err = result.reason;
            const message =
              err instanceof FileParseError
                ? err.message
                : err instanceof Error
                  ? err.message
                  : 'Error inesperado al procesar el archivo.';
            newErrors.push(`No se pudo procesar '${fileName}': ${message}`);
          }
        });

        if (newErrors.length > 0) {
          setErrors(newErrors);
        }
      } finally {
        setIsParsing(false);
        setParsingCount(0);
      }
    },
    [onDatasetParsed],
  );

  const openFilePicker = useCallback(() => {
    if (isParsing) return;
    inputRef.current?.click();
  }, [isParsing]);

  const resetDragState = useCallback(() => {
    dragDepth.current = 0;
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      resetDragState();
      if (isParsing) return;
      void handleFiles(event.dataTransfer.files);
    },
    [handleFiles, isParsing, resetDragState],
  );

  return (
    <div className="flex h-full w-full flex-col space-y-3">
      <Card
        role="button"
        tabIndex={0}
        aria-label="Zona de carga de archivos"
        aria-busy={isParsing}
        aria-disabled={isParsing}
        onClick={openFilePicker}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openFilePicker();
          }
        }}
        onDragEnter={(event) => {
          event.preventDefault();
          dragDepth.current += 1;
          setIsDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => {
          dragDepth.current -= 1;
          if (dragDepth.current <= 0) resetDragState();
        }}
        onDrop={handleDrop}
        className={cn(
          'group flex h-full min-h-[150px] flex-col justify-center rounded-xl border-2 border-dashed transition-all duration-200 shadow-2xs focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
          isParsing ? 'cursor-progress' : 'cursor-pointer',
          isDragging
            ? 'border-primary bg-primary/5 shadow-md scale-[0.99]'
            : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/20',
        )}
      >
        <CardContent
          className={cn(
            'my-auto flex flex-col items-center justify-center text-center transition-all',
            compact ? 'gap-2 p-4 sm:p-5' : 'gap-4 py-8 px-6 sm:py-10',
          )}
        >
          {isParsing ? (
            <>
              <Loader2
                className={cn('animate-spin text-primary', compact ? 'size-6' : 'size-9')}
              />
              <p className="text-xs font-medium text-muted-foreground">
                Procesando {parsingCount} archivo(s)…
              </p>
            </>
          ) : (
            <>
              <div
                className={cn(
                  'flex items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform group-hover:scale-105',
                  compact ? 'size-9' : 'size-12',
                )}
              >
                <UploadCloud
                  className={cn('text-primary', compact ? 'size-5' : 'size-6')}
                />
              </div>
              <div className="space-y-1">
                <p className={cn('font-semibold text-foreground tracking-tight', compact ? 'text-xs sm:text-sm' : 'text-sm sm:text-base')}>
                  {compact
                    ? 'Añadir más archivos'
                    : 'Arrastra tus archivos aquí o haz clic para seleccionarlos'}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Formatos: {ACCEPTED_EXTENSIONS.join(' · ')}
                </p>
                {!compact && (
                  <p className="mt-2.5 flex items-center justify-center gap-1.5 text-xs text-muted-foreground/80">
                    <Lock className="size-3 text-muted-foreground/70" />
                    Los datos se procesan en memoria y nunca salen de tu navegador
                  </p>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPTED_EXTENSIONS.join(',')}
        className="hidden"
        tabIndex={-1}
        onChange={(event) => {
          void handleFiles(event.target.files);
          event.target.value = '';
        }}
      />

      {errors.length > 0 && (
        <Alert variant="destructive" role="alert">
          <AlertTitle>Error al procesar archivos</AlertTitle>
          <AlertDescription>
            {errors.length === 1 ? (
              <p>{errors[0]}</p>
            ) : (
              <ul className="list-inside list-disc space-y-1">
                {errors.map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
              </ul>
            )}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
