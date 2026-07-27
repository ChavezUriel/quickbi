import { parseFile } from './parse-file';
import { FileParseError } from './parse-error';
import type { ParsedDataset } from '@/features/dataset/types';

export interface ParseRequest {
  file: File;
}

export type ParseResponse =
  | { ok: true; dataset: ParsedDataset }
  | { ok: false; message: string; /** `true` si es un `FileParseError` (mensaje apto para el usuario). */ expected: boolean };

/**
 * `lib.dom` no declara `DedicatedWorkerGlobalScope` (solo lo menciona en
 * comentarios), y bajo `lib: DOM` el tipo de `self` es `Window`, cuyo
 * `postMessage` exige un `targetOrigin`. Declaramos la porción del scope real
 * del worker que usamos, en lugar de añadir `lib: WebWorker` al proyecto
 * entero —eso duplicaría declaraciones globales y rompería el resto del código.
 */
interface WorkerScope {
  addEventListener(
    type: 'message',
    listener: (event: MessageEvent<ParseRequest>) => void,
  ): void;
  postMessage(message: ParseResponse): void;
}

const ctx = self as unknown as WorkerScope;

ctx.addEventListener('message', (event: MessageEvent<ParseRequest>) => {
  void (async () => {
    try {
      const dataset = await parseFile(event.data.file);
      ctx.postMessage({ ok: true, dataset } satisfies ParseResponse);
    } catch (error) {
      ctx.postMessage({
        ok: false,
        expected: error instanceof FileParseError,
        message:
          error instanceof Error ? error.message : 'Error inesperado al procesar el archivo.',
      } satisfies ParseResponse);
    }
  })();
});
