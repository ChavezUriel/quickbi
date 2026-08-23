import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { WizardProvider } from '../wizard-provider';
import { StepIndicator } from './step-indicator';

describe('StepIndicator Accessibility', () => {
  it('renders accessible screen reader text in CompactIndicator without aria-hidden on container', () => {
    const html = renderToString(
      <WizardProvider>
        <StepIndicator />
      </WizardProvider>,
    );

    // Verify sr-only text is present for screen readers with current step info
    expect(html).toContain('sr-only');
    expect(html).toContain('Paso ');
    expect(html).toContain('Carga de archivos');

    // Verify visual spans in compact indicator have aria-hidden="true"
    expect(html).toContain('aria-hidden="true"');

    // Verify compact indicator container div does not have aria-hidden (which would hide sr-only text)
    expect(html).not.toContain('class="flex min-w-0 items-center gap-2 sm:hidden" aria-hidden');
  });

  it('renders aria-current="step" on active step in FullIndicator', () => {
    const html = renderToString(
      <WizardProvider>
        <StepIndicator />
      </WizardProvider>,
    );

    // Verify navigation aria-label
    expect(html).toContain('aria-label="Progreso del asistente"');

    // Verify aria-current="step" is applied to active step
    expect(html).toContain('aria-current="step"');
  });
});
