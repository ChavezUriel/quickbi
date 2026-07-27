import { FileParseError } from './parse-error';
import type { ParseRequest, ParseResponse } from './parse-file.worker';
import type { ParsedDataset } from '@/features/dataset/types';

/**
 * API de parsing para el hilo principal.
 *
 * El trabajo se delega a un Web Worker porque `XLSX.read` es síncrono y Papa
 * en modo string también: un fichero grande congelaría la pestaña entera,
 * incluido el spinner que dice «procesando». El worker mantiene la UI viva.
 *
 * Si el navegador no soporta workers de módulo, se cae al hilo principal:
 * peor experiencia, pero funcional, en lugar de un fallo duro.
 */
export function parseFileWithWorker(file: File): Promise<ParsedDataset> {
  let worker: Worker;

  try {
    worker = new Worker(new URL('./parse-file.worker.ts', import.meta.url), {
      type: 'module',
    });
  } catch {
    return parseOnMainThread(file);
  }

  return new Promise<ParsedDataset>((resolve, reject) => {
    worker.addEventListener('message', (event: MessageEvent<ParseResponse>) => {
      const response = event.data;
      if (response.ok) {
        resolve(response.dataset);
      } else {
        reject(
          response.expected
            ? new FileParseError(response.message)
            : new Error(response.message),
        );
      }
    });

    // Un fallo al arrancar el worker (CSP, chunk no descargable) llega aquí.
    worker.addEventListener('error', (event) => {
      reject(new Error(event.message || 'El worker de parsing falló al arrancar.'));
    });

    worker.postMessage({ file } satisfies ParseRequest);
  }).finally(() => worker.terminate());
}

async function parseOnMainThread(file: File): Promise<ParsedDataset> {
  const { parseFile } = await import('./parse-file');
  return parseFile(file);
}
