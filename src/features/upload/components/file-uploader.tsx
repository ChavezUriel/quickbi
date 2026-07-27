import { useCallback, useRef, useState } from 'react';
import { Loader2, Lock, UploadCloud } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { FileParseError, parseFile } from '../lib/parse-file';
import type { ParsedDataset } from '../types';

const ACCEPTED_EXTENSIONS = ['.csv', '.xlsx', '.xls'];

interface FileUploaderProps {
  /** Callback con el dataset ya parseado en memoria (columnas + filas). */
  onDatasetParsed: (dataset: ParsedDataset) => void;
}

export function FileUploader({ onDatasetParsed }: FileUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      setError(null);
      setIsParsing(true);
      try {
        const dataset = await parseFile(file);
        onDatasetParsed(dataset);
      } catch (err) {
        setError(
          err instanceof FileParseError
            ? err.message
            : 'Error inesperado al procesar el archivo.',
        );
      } finally {
        setIsParsing(false);
      }
    },
    [onDatasetParsed],
  );

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      setIsDragging(false);
      void handleFile(event.dataTransfer.files[0]);
    },
    [handleFile],
  );

  return (
    <div className="w-full space-y-4">
      <Card
        role="button"
        tabIndex={0}
        aria-label="Zona de carga de archivos"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') inputRef.current?.click();
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={cn(
          'cursor-pointer border-2 border-dashed transition-colors',
          isDragging
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/25 hover:border-primary/50',
        )}
      >
        <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
          {isParsing ? (
            <>
              <Loader2 className="size-10 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                Procesando archivo en tu navegador…
              </p>
            </>
          ) : (
            <>
              <UploadCloud className="size-10 text-muted-foreground" />
              <div className="space-y-1">
                <p className="font-medium">
                  Arrastra tu archivo aquí o haz clic para seleccionarlo
                </p>
                <p className="text-sm text-muted-foreground">
                  Formatos soportados: {ACCEPTED_EXTENSIONS.join(' · ')}
                </p>
                <p className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                  <Lock className="size-3" />
                  Los datos se procesan en memoria y nunca salen de tu navegador
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_EXTENSIONS.join(',')}
        className="hidden"
        onChange={(event) => {
          void handleFile(event.target.files?.[0]);
          event.target.value = ''; // permite volver a cargar el mismo archivo
        }}
      />

      {error && (
        <Alert variant="destructive">
          <AlertTitle>No se pudo procesar el archivo</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
