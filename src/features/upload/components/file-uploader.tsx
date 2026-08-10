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
    <div className="w-full space-y-4">
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
          'border-2 border-dashed transition-colors',
          isParsing ? 'cursor-progress' : 'cursor-pointer',
          isDragging
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/25 hover:border-primary/50',
        )}
      >
        <CardContent
          className={cn(
            'flex flex-col items-center justify-center gap-3 text-center',
            compact ? 'py-6 sm:py-8' : 'py-10 sm:py-16',
          )}
        >
          {isParsing ? (
            <>
              <Loader2
                className={cn('animate-spin text-primary', compact ? 'size-7' : 'size-10')}
              />
              <p className="text-sm text-muted-foreground">
                Procesando {parsingCount} archivo(s)…
              </p>
            </>
          ) : (
            <>
              <UploadCloud
                className={cn('text-muted-foreground', compact ? 'size-7' : 'size-10')}
              />
              <div className="space-y-1">
                <p className={cn('font-medium', compact ? 'text-sm' : 'text-sm sm:text-base')}>
                  {compact
                    ? 'Añadir más archivos'
                    : 'Arrastra tus archivos aquí o haz clic para seleccionarlos'}
                </p>
                <p className="text-xs text-muted-foreground sm:text-sm">
                  Formatos soportados: {ACCEPTED_EXTENSIONS.join(' · ')}
                </p>
                {!compact && (
                  <p className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                    <Lock className="size-3" />
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
