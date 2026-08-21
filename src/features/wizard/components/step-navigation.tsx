import { ChevronLeft, ChevronRight } from 'lucide-react';
import { SHELL_CONTAINER, StickyBar } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useWizard } from '../use-wizard';
import type { WizardStepId } from '../wizard-context';

/**
 * Navegación entre pasos, pegada al fondo de la ventana.
 *
 * Antes vivía al final del documento, que en el paso de tipos con cincuenta
 * columnas quedaba a varias pantallas de distancia. Pegada, avanzar cuesta
 * siempre lo mismo. En móvil los botones ocupan la mitad del ancho cada uno:
 * son el gesto principal de la pantalla y merecen un objetivo táctil holgado.
 */
export function StepNavigation() {
  const { step, steps, stepLabels, goNext, goBack, canAdvance } = useWizard();

  const index = steps.indexOf(step);
  const nextStep = steps[index + 1] ?? null;
  const hint = hintFor(step, canAdvance);

  return (
    <StickyBar side="bottom">
      <div
        className={cn(
          SHELL_CONTAINER,
          'flex items-center gap-3 py-3',
          // Respeta la barra de gestos de los móviles sin muesca lateral.
          'pb-[max(0.75rem,env(safe-area-inset-bottom))]',
        )}
      >
        {index > 0 ? (
          <Button
            variant="outline"
            size="lg"
            onClick={goBack}
            className="h-10 flex-1 sm:h-9 sm:flex-none sm:min-w-28"
          >
            <ChevronLeft className="size-4" />
            Atrás
          </Button>
        ) : (
          <div className="hidden sm:block sm:min-w-28" />
        )}

        {hint !== null && (
          <p className="hidden flex-1 text-center text-xs text-muted-foreground md:block">
            {hint}
          </p>
        )}

        {nextStep !== null ? (
          <Button
            size="lg"
            onClick={goNext}
            disabled={!canAdvance}
            className="ml-auto h-10 flex-1 sm:h-9 sm:flex-none sm:min-w-28"
          >
            <span className="truncate">
              Siguiente<span className="hidden lg:inline">: {stepLabels[nextStep]}</span>
            </span>
            <ChevronRight className="size-4" />
          </Button>
        ) : (
          <div className="hidden sm:block sm:min-w-28" />
        )}
      </div>
    </StickyBar>
  );
}

function hintFor(step: WizardStepId, canAdvance: boolean): string | null {
  if (step === 'carga' && !canAdvance) {
    return 'Carga un archivo CSV o Excel para continuar.';
  }
  if (step === 'herramienta' && !canAdvance) {
    return 'Elige qué análisis quieres hacer con estos datos.';
  }
  if (step === 'configuracion' && !canAdvance) {
    return 'Falta asignar alguna columna obligatoria.';
  }
  return null;
}
