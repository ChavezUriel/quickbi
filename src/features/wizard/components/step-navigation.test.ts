import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { STEP_LABELS, WizardContext, type WizardStore } from '../wizard-context';
import { StepNavigation } from './step-navigation';

describe('StepNavigation accessibility and states', () => {
  it('renders step navigation with active step labels and shortcuts when canAdvance is true', () => {
    const store = {
      step: 'carga',
      steps: ['carga', 'tipos', 'herramienta'],
      stepLabels: STEP_LABELS,
      canAdvance: true,
      goNext: () => {},
    } as unknown as WizardStore;

    const html = renderToString(
      createElement(WizardContext.Provider, { value: store }, createElement(StepNavigation)),
    );

    expect(html).toContain('aria-keyshortcuts="Enter"');
    expect(html).toContain('aria-label="Avanzar a Tipos de campos"');
    expect(html).toContain('title="Siguiente: Tipos de campos (Enter)"');
  });

  it('renders disabled state label and omits keyshortcuts when canAdvance is false', () => {
    const store = {
      step: 'carga',
      steps: ['carga', 'tipos', 'herramienta'],
      stepLabels: STEP_LABELS,
      canAdvance: false,
      goNext: () => {},
    } as unknown as WizardStore;

    const html = renderToString(
      createElement(WizardContext.Provider, { value: store }, createElement(StepNavigation)),
    );

    expect(html).not.toContain('aria-keyshortcuts');
    expect(html).toContain('aria-label="No se puede avanzar: completa este paso para continuar"');
    expect(html).toContain('title="Completa este paso para continuar"');
    expect(html).toContain('disabled');
  });

  it('renders null when on the last step', () => {
    const store = {
      step: 'herramienta',
      steps: ['carga', 'tipos', 'herramienta'],
      stepLabels: STEP_LABELS,
      canAdvance: true,
      goNext: () => {},
    } as unknown as WizardStore;

    const html = renderToString(
      createElement(WizardContext.Provider, { value: store }, createElement(StepNavigation)),
    );

    expect(html).toBe('');
  });
});
