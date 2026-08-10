import { cn } from '@/lib/utils';
import { TOTAL_DIM } from '../types';

interface DimensionSelectorProps {
  dimensions: readonly string[];
  value: string;
  onChange: (dim: string) => void;
}

/**
 * Eje de agrupación activo. «Total» no agrupa: muestra el dataset entero como
 * una sola categoría, que es el punto de partida natural antes de abrir.
 */
export function DimensionSelector({ dimensions, value, onChange }: DimensionSelectorProps) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5">
      <span className="text-sm font-medium">Analizar por</span>
      <div role="group" aria-label="Dimensión de análisis" className="flex flex-wrap gap-1.5">
        <Pill active={value === TOTAL_DIM} onClick={() => onChange(TOTAL_DIM)}>
          Total
        </Pill>
        {dimensions.map((dimension) => (
          <Pill
            key={dimension}
            active={value === dimension}
            onClick={() => onChange(dimension)}
          >
            {dimension}
          </Pill>
        ))}
      </div>
      {dimensions.length === 0 && (
        <span className="text-xs text-muted-foreground">
          Sin dimensiones: elige columnas para agrupar en el paso anterior.
        </span>
      )}
    </div>
  );
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        // 32 px en táctil, 28 en puntero fino: la fila de dimensiones es el
        // control que más se pulsa del cuadro de mando.
        'h-8 max-w-full truncate rounded-full border px-3 text-xs font-medium transition-colors sm:h-7',
        'focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-input text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}
