import { useEffect } from 'react';
import { ChevronLeft, ChevronRight, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useWizard } from '../use-wizard';
import type { WizardStepId } from '../wizard-context';

/**
 * Isla de navegación flotante (Action Dock), centrada en la zona de foco del usuario.
 *
 * En lugar de una barra plana pegada al borde de la pantalla que se pierde en
 * monitores anchos, esta isla flota elevada en el eje central de visión.
 * Proporciona retroalimentación visual del estado del paso («Listo para continuar»
 * o pista de lo que falta), botón de avance primario de alto contraste y
 * soporte para atajo de teclado (`Enter` / `Cmd+Enter`).
 */
export function StepNavigation() {
  const { step, steps, stepLabels, goNext, goBack, canAdvance } = useWizard();

  const index = steps.indexOf(step);
  const nextStep = steps[index + 1] ?? null;
  const hint = hintFor(step, canAdvance);

  // Atajo de teclado: Enter o Cmd/Ctrl+Enter avanza de paso cuando canAdvance es true
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.isComposing || !canAdvance || nextStep === null) return;

      const isModifier = event.metaKey || event.ctrlKey;
      const isEnter = event.key === 'Enter';

      if (isEnter) {
        const activeEl = document.activeElement;
        const tagName = activeEl?.tagName.toLowerCase();

        // Evitar disparo accidental si el usuario está redactando en un input de texto o textarea
        if (tagName === 'textarea' && !isModifier) return;
        if (tagName === 'input') {
          const inputType = (activeEl as HTMLInputElement).type;
          if (
            ['text', 'search', 'password', 'number', 'email'].includes(inputType) &&
            !isModifier
          ) {
            return;
          }
        }

        event.preventDefault();
        goNext();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canAdvance, nextStep, goNext]);

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4 sm:bottom-6"
      style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom, 0px))' }}
    >
      <nav
        aria-label="Navegación del asistente"
        className={cn(
          'pointer-events-auto flex w-full max-w-lg sm:w-auto items-center justify-between sm:justify-start gap-2 sm:gap-3 rounded-2xl sm:rounded-full border p-1.5 sm:p-2',
          'bg-background/90 backdrop-blur-xl dark:bg-card/90',
          'shadow-[0_8px_32px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.45)]',
          'transition-all duration-300 ease-out',
          canAdvance
            ? 'border-primary/40 ring-2 ring-primary/15 shadow-primary/10'
            : 'border-border/80 shadow-black/5',
        )}
      >
        {index > 0 ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={goBack}
            className="h-9 rounded-xl px-3 sm:rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors"
            aria-label="Volver al paso anterior"
          >
            <ChevronLeft className="size-4 mr-0.5" />
            <span className="text-xs font-medium">Atrás</span>
          </Button>
        ) : null}

        {canAdvance ? (
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 text-xs font-medium text-muted-foreground">
            <span className="relative flex size-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
            </span>
            <span className="text-foreground/85 font-medium">Listo para continuar</span>
          </div>
        ) : hint !== null ? (
          <div className="flex min-w-0 flex-1 sm:flex-initial items-center gap-1.5 px-2.5 sm:px-3 py-1 text-xs text-muted-foreground">
            <Info className="size-3.5 shrink-0 text-muted-foreground/70" aria-hidden />
            <span className="max-w-[200px] sm:max-w-xs truncate text-[0.75rem]">{hint}</span>
          </div>
        ) : null}

        {nextStep !== null ? (
          <Button
            size="default"
            onClick={goNext}
            disabled={!canAdvance}
            className={cn(
              'group ml-auto sm:ml-0 h-9 sm:h-10 rounded-xl sm:rounded-full px-4 sm:px-5 font-medium transition-all duration-200',
              canAdvance
                ? 'bg-primary text-primary-foreground shadow-md hover:bg-primary/90 hover:scale-[1.02] active:scale-[0.98] cursor-pointer'
                : 'opacity-45 cursor-not-allowed bg-muted text-muted-foreground',
            )}
          >
            <span className="truncate text-xs sm:text-sm">
              Siguiente<span className="hidden md:inline">: {stepLabels[nextStep]}</span>
            </span>
            <ChevronRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            {canAdvance && (
              <kbd className="hidden sm:inline-flex items-center rounded border border-primary-foreground/30 bg-primary-foreground/15 px-1.5 py-0.5 font-mono text-[0.65rem] font-semibold text-primary-foreground leading-none">
                ↵ Enter
              </kbd>
            )}
          </Button>
        ) : null}
      </nav>
    </div>
  );
}

function hintFor(step: WizardStepId, canAdvance: boolean): string | null {
  if (step === 'carga' && !canAdvance) {
    return 'Carga un archivo CSV o Excel para continuar.';
  }
  if (step === 'herramienta' && !canAdvance) {
    return 'Haz clic en una herramienta para iniciar el análisis.';
  }
  if (step === 'configuracion' && !canAdvance) {
    return 'Falta asignar alguna columna obligatoria.';
  }
  return null;
}
