import { useEffect } from 'react';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useWizard } from '../use-wizard';

/**
 * Botón flotante circular en la esquina inferior derecha para avanzar al siguiente paso.
 *
 * Muestra una flecha verde hacia la derecha y permite avanzar de paso
 * mediante clic o atajo de teclado (`Enter`).
 */
export function StepNavigation() {
  const { step, steps, stepLabels, goNext, canAdvance } = useWizard();

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

  if (nextStep === null) return null;

  return (
    <div
      className="fixed bottom-6 right-6 z-40 sm:bottom-8 sm:right-8"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        paddingRight: 'env(safe-area-inset-right, 0px)',
      }}
    >
      <Button
        type="button"
        size="icon"
        onClick={goNext}
        disabled={!canAdvance}
        aria-keyshortcuts={canAdvance ? 'Enter' : undefined}
        aria-label={nextStep ? `Avanzar a ${stepLabels[nextStep]}` : 'Siguiente paso'}
        aria-keyshortcuts="Enter"
        title={
          canAdvance
            ? `${nextStep ? `Siguiente: ${stepLabels[nextStep]}` : 'Siguiente paso'} (Enter)`
            : 'Completa este paso para continuar'
        }
        className={cn(
          'group relative size-12 sm:size-14 rounded-full border p-0 transition-all duration-300 ease-out',
          'bg-background/95 backdrop-blur-xl dark:bg-card/95',
          'shadow-[0_8px_30px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.45)]',
          canAdvance
            ? 'cursor-pointer border-emerald-500/40 dark:border-emerald-500/50 ring-2 ring-emerald-500/20 shadow-emerald-500/20 hover:scale-110 hover:border-emerald-500 hover:shadow-[0_12px_36px_rgba(16,185,129,0.35)] active:scale-95'
            : 'cursor-not-allowed border-border/80 opacity-40 shadow-black/5',
        )}
      >
        <ArrowRight
          className={cn(
            'size-5 sm:size-6 transition-all duration-200',
            canAdvance
              ? 'text-emerald-600 dark:text-emerald-400 group-hover:translate-x-0.5 group-hover:text-emerald-500 dark:group-hover:text-emerald-300'
              : 'text-emerald-600/50 dark:text-emerald-400/50',
          )}
        />
        {canAdvance && (
          <kbd
            aria-hidden="true"
            className="absolute -top-1 -right-1 hidden select-none items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500 text-emerald-950 size-5 font-mono text-[10px] font-bold shadow-xs sm:flex dark:bg-emerald-400 dark:text-emerald-950"
          >
            ↵
          </kbd>
        )}
      </Button>
    </div>
  );
}
