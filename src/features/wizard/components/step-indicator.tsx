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
    <div className="flex min-w-0 items-center gap-2 sm:hidden" aria-hidden>
      <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
        {position}/{steps.length}
      </span>
      <span className="truncate text-xs font-medium">{stepLabels[step]}</span>
      <span className="flex shrink-0 gap-1">
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
  const { step, steps, stepLabels, goToStep } = useWizard();
  const currentIndex = steps.indexOf(step);

  return (
    <nav aria-label="Progreso del asistente" className="hidden sm:block">
      <ol className="flex items-center">
        {steps.map((id, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;
          const isFuture = index > currentIndex;

          return (
            <li key={id} className="flex items-center">
              <button
                type="button"
                disabled={isFuture}
                onClick={() => goToStep(id)}
                aria-current={isCurrent ? 'step' : undefined}
                className={cn(
                  'group flex items-center gap-2 rounded-full px-1 py-1 transition-colors',
                  'focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
                  isFuture ? 'cursor-default' : 'cursor-pointer',
                )}
              >
                <span
                  className={cn(
                    'flex size-6 shrink-0 items-center justify-center rounded-full border-2 text-[0.7rem] font-semibold transition-all duration-200',
                    isCompleted && 'border-primary bg-primary text-primary-foreground',
                    isCurrent &&
                      'border-primary bg-primary/10 text-primary ring-2 ring-primary/20',
                    isFuture && 'border-muted-foreground/30 text-muted-foreground',
                  )}
                >
                  {isCompleted ? <Check className="size-3.5" /> : index + 1}
                </span>
                <span
                  className={cn(
                    'hidden max-w-40 truncate text-xs font-medium whitespace-nowrap lg:block',
                    isCurrent && 'text-foreground',
                    isCompleted && 'text-muted-foreground group-hover:text-foreground',
                    isFuture && 'text-muted-foreground/50',
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
