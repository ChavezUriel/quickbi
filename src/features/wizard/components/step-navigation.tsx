import { useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useWizard } from '../use-wizard';

/**
 * Isla de navegación flotante (Action Dock), centrada en la zona de foco del usuario.
 *
 * Flota elevada en el eje central de visión para facilitar el avance y retroceso
 * en cualquier resolución de pantalla, con soporte para atajo de teclado (`Enter`).
 */
export function StepNavigation() {
  const { step, steps, goNext, goBack, canAdvance } = useWizard();

  const index = steps.indexOf(step);
  const nextStep = steps[index + 1] ?? null;

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
          'pointer-events-auto flex items-center gap-2 rounded-full border p-1.5',
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
            className="h-9 rounded-full px-3.5 text-xs font-medium text-muted-foreground hover:bg-muted/70 hover:text-foreground transition-colors"
            aria-label="Volver al paso anterior"
          >
            <ChevronLeft className="mr-0.5 size-4" />
            <span>Atrás</span>
          </Button>
        ) : null}

        {nextStep !== null ? (
          <Button
            size="sm"
            onClick={goNext}
            disabled={!canAdvance}
            className={cn(
              'group h-9 rounded-full px-4 text-xs sm:text-sm font-medium transition-all duration-200',
              canAdvance
                ? 'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:scale-[1.02] active:scale-[0.98] cursor-pointer'
                : 'opacity-45 cursor-not-allowed bg-muted text-muted-foreground',
            )}
          >
            <span>Siguiente</span>
            <ChevronRight className="ml-0.5 size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
          </Button>
        ) : null}
      </nav>
    </div>
  );
}
