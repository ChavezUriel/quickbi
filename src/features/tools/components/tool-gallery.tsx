import { Check, CircleAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatCount } from '@/features/analysis/lib/format';
import { TOOLS, availabilityOf } from '../registry';
import {
  TOOL_CATEGORY_LABEL,
  type DatasetCapabilities,
  type ToolCategory,
  type ToolDefinition,
} from '../types';

const ORDER: ToolCategory[] = ['general', 'temporal', 'clientes', 'situacional'];

/**
 * La galería de herramientas: el paso que decide qué se hace con los datos.
 *
 * Va después de confirmar los tipos y antes de elegir ejes y métricas porque
 * cada herramienta pide cosas distintas: preguntar por el eje temporal antes
 * de saber si el usuario quiere una tabla dinámica o una matriz RFM era
 * preguntar por algo que la mitad de las veces no hacía falta.
 *
 * Las que el dataset no soporta se enseñan igual, apagadas y con el motivo:
 * saber que existe un análisis RFM y que le falta una columna de cliente es
 * más útil que no saber que existe.
 */
export function ToolGallery({
  capabilities,
  selected,
  onSelect,
}: {
  capabilities: DatasetCapabilities;
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const byCategory = ORDER.map((category) => ({
    category,
    tools: TOOLS.filter((tool) => tool.category === category),
  })).filter((group) => group.tools.length > 0);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-medium">¿Qué quieres hacer con estos datos?</h2>
        <p className="text-sm text-pretty text-muted-foreground">
          {formatCount(capabilities.rowCount)} filas y{' '}
          {formatCount(capabilities.columnCount)} columnas, de las cuales{' '}
          {describe(capabilities)}. Elige una herramienta; en el siguiente paso le dirás
          qué columna es cada cosa.
        </p>
      </div>

      {byCategory.map((group) => (
        <section key={group.category} className="space-y-2">
          <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {TOOL_CATEGORY_LABEL[group.category]}
          </h3>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {group.tools.map((tool) => (
              <ToolCard
                key={tool.id}
                tool={tool}
                capabilities={capabilities}
                selected={tool.id === selected}
                onSelect={onSelect}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function ToolCard({
  tool,
  capabilities,
  selected,
  onSelect,
}: {
  tool: ToolDefinition;
  capabilities: DatasetCapabilities;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const availability = availabilityOf(tool, capabilities);
  const Icon = tool.icon;

  return (
    <button
      type="button"
      disabled={!availability.available}
      aria-pressed={selected}
      onClick={() => onSelect(tool.id)}
      className={cn(
        'group flex h-full flex-col gap-2 rounded-xl p-4 text-left ring-1 transition-all',
        'focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
        availability.available
          ? 'cursor-pointer bg-card ring-foreground/10 hover:ring-foreground/25'
          : 'cursor-not-allowed bg-muted/30 ring-transparent',
        selected && 'bg-primary/5 ring-2 ring-primary',
      )}
    >
      <div className="flex items-start gap-2">
        <span
          className={cn(
            'flex size-8 shrink-0 items-center justify-center rounded-lg',
            selected ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground',
            !availability.available && 'text-muted-foreground',
          )}
        >
          {selected ? (
            <Check className="size-4" aria-hidden />
          ) : (
            <Icon className="size-4" aria-hidden />
          )}
        </span>

        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">{tool.label}</span>
          <span className="block text-xs text-pretty text-muted-foreground">
            {tool.tagline}
          </span>
        </span>
      </div>

      <p
        className={cn(
          'text-xs text-pretty',
          availability.available ? 'text-muted-foreground' : 'text-muted-foreground/70',
        )}
      >
        {tool.description}
      </p>

      <div className="mt-auto flex flex-wrap gap-1 pt-1">
        {availability.available ? (
          tool.needs.map((need) => (
            <Badge key={need} variant="outline" className="text-[0.7rem]">
              {need}
            </Badge>
          ))
        ) : (
          <Badge variant="secondary" className="max-w-full">
            <CircleAlert aria-hidden />
            <span className="truncate">{availability.reason}</span>
          </Badge>
        )}
      </div>
    </button>
  );
}

/** Qué tiene el dataset, en una frase y sin repetir «columnas» cuatro veces. */
function describe(capabilities: DatasetCapabilities): string {
  const parts: string[] = [];
  if (capabilities.dates > 0) parts.push(`${capabilities.dates} de fecha`);
  if (capabilities.measures > 0) parts.push(`${capabilities.measures} numéricas`);
  if (capabilities.dimensions > 0) parts.push(`${capabilities.dimensions} de categorías`);

  if (parts.length === 0) return 'ninguna se ha podido tipar';
  if (parts.length === 1) return parts[0] ?? '';
  return `${parts.slice(0, -1).join(', ')} y ${parts[parts.length - 1]}`;
}
