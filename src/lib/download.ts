/**
 * Descargas 100 % locales: se genera el fichero en memoria y se dispara con
 * un enlace temporal. Nada sale del navegador (la CSP lo garantiza).
 */

export function downloadTextFile(fileName: string, content: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  triggerDownload(fileName, url);
  // Revocar en el mismo tick puede cancelar la descarga antes de que empiece.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function downloadDataUrl(fileName: string, dataUrl: string): void {
  triggerDownload(fileName, dataUrl);
}

function triggerDownload(fileName: string, href: string): void {
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = fileName;
  anchor.click();
}
