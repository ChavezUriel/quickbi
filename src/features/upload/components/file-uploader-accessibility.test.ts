import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FileUploader } from './file-uploader';

describe('FileUploader accessibility', () => {
  it('renders dropzone card with role button, tabIndex 0, aria-label, and focus-visible styles', () => {
    const html = renderToString(
      createElement(FileUploader, {
        onDatasetParsed: () => undefined,
      }),
    );

    expect(html).toContain('role="button"');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('aria-label="Zona de carga de archivos"');
    expect(html).toContain('focus-visible:ring-3');
    expect(html).toContain('focus-visible:ring-ring/50');
  });
});
