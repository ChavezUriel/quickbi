/**
 * Error de dominio para fallos de parsing: permite distinguir un mensaje apto
 * para el usuario ("el archivo supera los 100 MB") de un fallo inesperado.
 *
 * Vive en su propio módulo para que el hilo principal pueda importarlo sin
 * arrastrar `parse-file.ts` —y con él SheetJS— al bundle inicial.
 */
export class FileParseError extends Error {}
