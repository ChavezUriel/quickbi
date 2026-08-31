import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { WizardProvider } from '../wizard-provider';
import { StepIndicator } from './step-indicator';

describe('StepIndicator Accessibility', () => {
  it('renders compact step indicator with accessible sr-only announcement outside aria-hidden', () => {
    const html = renderToString(
      <WizardProvider>
        <StepIndicator />
      </WizardProvider>,
    );

    // Verify sr-only container is present with the full step description
    expect(html).toContain('class="sr-only"');
    // Remove React's SSR comment markers <!-- --> for cleaner string matching
    const cleanHtml = html.replace(/<!-- -->/g, '');
    expect(cleanHtml).toContain('Paso 1 de 3: Carga de archivos');

    // Verify aria-hidden="true" is on the visual elements sub-wrapper, not on the outer container
    expect(html).toContain('<div class="flex min-w-0 items-center gap-2 sm:hidden"><span class="sr-only">');
    expect(html).toContain('aria-hidden="true"');
  });
});
