import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWizard } from '../use-wizard';

/**
 * Progreso del asistente, en dos formas.
 *
 * En una barra superior fija el espacio horizontal es el recurso escaso: por
 * debajo de `sm` los círculos y sus rótulos no caben junto a la marca y el
 * conmutador de tema, así que se sustituyen por «2/4 · Rótulo» más un segmento
 * por paso. Es la misma información, contada con una décima parte del ancho.
 *
 * La secuencia no es fija —depende de la herramienta elegida—, así que tanto
 * el número como los segmentos salen de la lista vigente y no de una constante.
 */
export function StepIndicator() {
  return (
    <>
      <CompactIndicator />
      <FullIndicator />
    </>
  );
}

function CompactIndicator() {
  const { step, steps, stepLabels } = useWizard();
  const position = steps.indexOf(step) + 1;

  return (
    <div className="flex min-w-0 items-center gap-2 sm:hidden">
      <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground" aria-hidden="true">
        {position}/{steps.length}
      </span>
      <span className="truncate text-xs font-medium" aria-hidden="true">{stepLabels[step]}</span>
      <span className="flex shrink-0 gap-1" aria-hidden="true">
        {steps.map((id, index) => (
          <span
            key={id}
            className={cn(
              'h-1 w-4 rounded-full transition-colors',
              index < position ? 'bg-primary' : 'bg-muted-foreground/25',
            )}
          />
        ))}
      </span>
      {/* El lector de pantalla recibe la frase entera, no los trozos sueltos. */}
      <span className="sr-only">
        Paso {position} de {steps.length}: {stepLabels[step]}
      </span>
    </div>
  );
}

function FullIndicator() {
  const { step, steps, stepLabels, goToStep, canGoToStep, toolId } = useWizard();
  const currentIndex = steps.indexOf(step);

  return (
    <nav aria-label="Progreso del asistente" className="hidden sm:block">
      <ol className="flex items-center">
        {steps.map((id, index) => {
          const isCompleted = index < currentIndex || (id === 'herramienta' && toolId !== null);
          const isCurrent = index === currentIndex;
          const isAccessible = canGoToStep(id);
          const isClickable =
            isAccessible && (!isCurrent || (id === 'herramienta' && toolId !== null));

          return (
            <li key={id} className="flex items-center">
              <button
                type="button"
                disabled={!isClickable}
                onClick={() => goToStep(id)}
                aria-current={isCurrent ? 'step' : undefined}
                title={
                  isCurrent && id === 'herramienta' && toolId !== null
                    ? 'Volver a la selección de herramientas'
                    : `Paso ${index + 1}: ${stepLabels[id]}`
                }
                className={cn(
                  'group flex items-center gap-2 rounded-full px-2 py-1 transition-all duration-200',
                  'focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
                  isClickable
                    ? 'cursor-pointer hover:bg-muted/60'
                    : isCurrent
                      ? 'cursor-default'
                      : 'cursor-not-allowed opacity-50',
                )}
              >
                <span
                  className={cn(
                    'flex size-6 shrink-0 items-center justify-center rounded-full border-2 text-[0.7rem] font-semibold transition-all duration-200',
                    isCompleted && 'border-primary bg-primary text-primary-foreground',
                    isCurrent &&
                      !isCompleted &&
                      'border-primary bg-primary/10 text-primary ring-2 ring-primary/20',
                    !isCompleted &&
                      !isCurrent &&
                      isAccessible &&
                      'border-primary/60 text-foreground group-hover:border-primary group-hover:bg-primary/10',
                    !isCompleted &&
                      !isCurrent &&
                      !isAccessible &&
                      'border-muted-foreground/30 text-muted-foreground',
                  )}
                >
                  {isCompleted ? <Check className="size-3.5" /> : index + 1}
                </span>
                <span
                  className={cn(
                    'hidden max-w-40 truncate text-xs font-medium whitespace-nowrap lg:block transition-colors',
                    isCurrent && 'text-foreground font-semibold',
                    isCompleted && !isCurrent && 'text-muted-foreground group-hover:text-foreground',
                    !isCompleted &&
                      !isCurrent &&
                      isAccessible &&
                      'text-muted-foreground group-hover:text-foreground',
                    !isCompleted && !isCurrent && !isAccessible && 'text-muted-foreground/40',
                  )}
                >
                  {stepLabels[id]}
                </span>
              </button>

              {index < steps.length - 1 && (
                <div
                  className={cn(
                    'mx-2 h-0.5 w-6 rounded-full transition-colors duration-200 lg:w-8',
                    index < currentIndex ? 'bg-primary' : 'bg-muted-foreground/20',
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
