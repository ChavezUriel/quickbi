import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { STEP_LABELS, WizardContext, type WizardStore } from '../wizard-context';
import { StepIndicator } from './step-indicator';
import { StepNavigation } from './step-navigation';

const store = {
  step: 'carga',
  steps: ['carga', 'tipos', 'herramienta'],
  stepLabels: STEP_LABELS,
  canAdvance: true,
  canGoToStep: (step: string) => step === 'carga',
  toolId: null,
} as unknown as WizardStore;

describe('Wizard accessibility hints', () => {
  it('announces the Enter shortcut and explains current and locked steps', () => {
    const html = renderToString(
      createElement(
        WizardContext.Provider,
        { value: store },
        createElement(StepNavigation),
        createElement(StepIndicator),
      ),
    );

    expect(html).toContain('aria-keyshortcuts="Enter"');
    expect(html).toContain('title="Siguiente: Tipos de campos (Enter)"');
    expect(html).toContain('title="Paso 1: Carga de archivos (Paso actual)"');
    expect(html).toContain(
      'title="Paso 2: Tipos de campos (Completa los pasos anteriores para acceder)"',
    );
  });

  it('omits aria-keyshortcuts on StepNavigation when canAdvance is false', () => {
    const disabledStore = {
      ...store,
      canAdvance: false,
    };

    const html = renderToString(
      createElement(
        WizardContext.Provider,
        { value: disabledStore },
        createElement(StepNavigation),
      ),
    );

    expect(html).not.toContain('aria-keyshortcuts');
  });
});
