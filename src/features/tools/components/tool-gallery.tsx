import { useMemo, useState } from 'react';
import {
  ArrowRight,
  Check,
  CircleAlert,
  Search,
  Sparkles,
  X,
  Zap,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatCount } from '@/features/analysis/lib/format';
import { TOOLS, availabilityOf } from '../registry';
import {
  TOOL_CATEGORY_LABEL,
  type DatasetCapabilities,
  type ToolCategory,
  type ToolDefinition,
} from '../types';

const CATEGORY_ORDER: ToolCategory[] = ['general', 'temporal', 'clientes', 'situacional'];

/**
 * Galería de herramientas de análisis con selección directa (1-clic) y filtros rápidos.
 *
 * El usuario puede hacer clic en cualquier herramienta disponible para iniciar
 * de inmediato su configuración o cuadro de mando, eliminando la necesidad de
 * una confirmación adicional en el dock inferior.
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
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<ToolCategory | 'all'>('all');
  const [onlyCompatible, setOnlyCompatible] = useState(false);

  // Evaluar disponibilidad de todas las herramientas para los filtros y contadores
  const toolsWithAvailability = useMemo(() => {
    return TOOLS.map((tool) => ({
      tool,
      availability: availabilityOf(tool, capabilities),
    }));
  }, [capabilities]);

  const compatibleCount = useMemo(
    () => toolsWithAvailability.filter((t) => t.availability.available).length,
    [toolsWithAvailability],
  );

  // Filtrado reactivo por texto, categoría y compatibilidad
  const filteredTools = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return toolsWithAvailability.filter(({ tool, availability }) => {
      if (onlyCompatible && !availability.available) {
        return false;
      }

      if (activeCategory !== 'all' && tool.category !== activeCategory) {
        return false;
      }

      if (query.length > 0) {
        const matchesLabel = tool.label.toLowerCase().includes(query);
        const matchesTagline = tool.tagline.toLowerCase().includes(query);
        const matchesDescription = tool.description.toLowerCase().includes(query);
        const matchesNeeds = tool.needs.some((need) => need.toLowerCase().includes(query));
        const matchesCategory = TOOL_CATEGORY_LABEL[tool.category].toLowerCase().includes(query);

        return (
          matchesLabel ||
          matchesTagline ||
          matchesDescription ||
          matchesNeeds ||
          matchesCategory
        );
      }

      return true;
    });
  }, [toolsWithAvailability, searchQuery, activeCategory, onlyCompatible]);

  // Agrupación por categoría si no se está filtrando por categoría específica ni buscando
  const isBrowsingAll = activeCategory === 'all' && searchQuery.trim() === '';

  const groups = useMemo(() => {
    if (!isBrowsingAll) return [];

    return CATEGORY_ORDER.map((category) => {
      const items = filteredTools.filter((t) => t.tool.category === category);
      return {
        category,
        label: TOOL_CATEGORY_LABEL[category],
        items,
      };
    }).filter((group) => group.items.length > 0);
  }, [filteredTools, isBrowsingAll]);

  const clearFilters = () => {
    setSearchQuery('');
    setActiveCategory('all');
    setOnlyCompatible(false);
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      {/* Encabezado contextual con resumen del dataset */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between border-b pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold tracking-tight">
              Elige tu herramienta de análisis
            </h2>
            <Badge variant="secondary" className="text-xs font-normal">
              {compatibleCount} compatibles
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground text-pretty">
            {formatCount(capabilities.rowCount)} filas y{' '}
            {formatCount(capabilities.columnCount)} columnas ({describe(capabilities)}).
            Haz clic en una herramienta para comenzar directamente.
          </p>
        </div>
      </div>

      {/* Barra de búsqueda y filtros rápidos */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Buscador */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/70" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar herramienta (ej. RFM, clientes, tendencia, cohortes...)"
            className={cn(
              'w-full h-9 rounded-xl border border-input bg-background/80 pl-9 pr-8 text-sm',
              'placeholder:text-muted-foreground/60 transition-all shadow-xs',
              'focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:outline-none',
            )}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-foreground rounded-md transition-colors cursor-pointer"
              aria-label="Limpiar búsqueda"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        {/* Pestañas de categoría y botón de solo compatibles */}
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            variant={activeCategory === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveCategory('all')}
            className={cn(
              'h-8 rounded-lg text-xs font-medium cursor-pointer transition-all',
              activeCategory === 'all'
                ? 'shadow-xs'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            Todas ({toolsWithAvailability.length})
          </Button>

          {CATEGORY_ORDER.map((cat) => {
            const count = toolsWithAvailability.filter((t) => t.tool.category === cat).length;
            const isCurrent = activeCategory === cat;

            return (
              <Button
                key={cat}
                variant={isCurrent ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveCategory(cat)}
                className={cn(
                  'h-8 rounded-lg text-xs font-medium cursor-pointer transition-all',
                  isCurrent
                    ? 'shadow-xs'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {TOOL_CATEGORY_LABEL[cat]} ({count})
              </Button>
            );
          })}

          <Button
            variant={onlyCompatible ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setOnlyCompatible((prev) => !prev)}
            className={cn(
              'h-8 rounded-lg text-xs font-medium cursor-pointer ml-auto sm:ml-1 border transition-all',
              onlyCompatible
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                : 'border-dashed border-border text-muted-foreground hover:text-foreground',
            )}
          >
            <Sparkles className="size-3 mr-1 text-emerald-500" />
            Solo compatibles
          </Button>
        </div>
      </div>

      {/* Grid de herramientas o vista agrupada */}
      {filteredTools.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center border rounded-2xl bg-muted/20 border-dashed">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground mb-3">
            <Search className="size-6 opacity-60" />
          </div>
          <h3 className="text-sm font-semibold">No se encontraron herramientas</h3>
          <p className="text-xs text-muted-foreground max-w-sm mt-1 mb-4 text-pretty">
            No hay herramientas que coincidan con los criterios seleccionados. Prueba a cambiar el texto o restablecer los filtros.
          </p>
          <Button variant="outline" size="sm" onClick={clearFilters} className="rounded-xl cursor-pointer">
            Restablecer filtros
          </Button>
        </div>
      ) : isBrowsingAll ? (
        <div className="space-y-8">
          {groups.map((group) => (
            <section key={group.category} className="space-y-3">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  {group.label}
                </h3>
                <span className="text-xs text-muted-foreground/60 font-mono">
                  ({group.items.length})
                </span>
              </div>

              <div className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-3">
                {group.items.map(({ tool, availability }) => (
                  <ToolCard
                    key={tool.id}
                    tool={tool}
                    availability={availability}
                    selected={tool.id === selected}
                    onSelect={onSelect}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="text-xs text-muted-foreground font-medium">
            Mostrando {filteredTools.length} {filteredTools.length === 1 ? 'herramienta' : 'herramientas'}
          </div>
          <div className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-3">
            {filteredTools.map(({ tool, availability }) => (
              <ToolCard
                key={tool.id}
                tool={tool}
                availability={availability}
                selected={tool.id === selected}
                onSelect={onSelect}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ToolCard({
  tool,
  availability,
  selected,
  onSelect,
}: {
  tool: ToolDefinition;
  availability: ReturnType<typeof availabilityOf>;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const Icon = tool.icon;
  const isAvailable = availability.available;

  return (
    <button
      type="button"
      disabled={!isAvailable}
      aria-pressed={selected}
      aria-label={`${tool.label}: ${tool.tagline}. ${
        isAvailable ? 'Haz clic para comenzar el análisis' : availability.reason
      }`}
      onClick={() => onSelect(tool.id)}
      className={cn(
        'group relative flex h-full w-full min-w-0 flex-col gap-2.5 text-left rounded-2xl p-4 sm:p-4.5 transition-all duration-200 overflow-hidden',
        'focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
        isAvailable
          ? 'cursor-pointer bg-card border border-border/80 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5 active:scale-[0.99] active:translate-y-0'
          : 'cursor-not-allowed bg-muted/20 border border-border/40 opacity-65 grayscale-[30%]',
        selected &&
          'bg-primary/[0.04] border-primary ring-2 ring-primary/20 shadow-md shadow-primary/10 hover:border-primary',
      )}
    >
      {/* Cabecera: Icono, Título y Badges de estado */}
      <div className="flex items-center justify-between gap-2 w-full min-w-0">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <span
            className={cn(
              'flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors duration-200',
              selected
                ? 'bg-primary text-primary-foreground shadow-xs'
                : isAvailable
                  ? 'bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground'
                  : 'bg-muted text-muted-foreground',
            )}
          >
            {selected ? (
              <Check className="size-4" aria-hidden />
            ) : (
              <Icon className="size-4" aria-hidden />
            )}
          </span>

          <h4
            className={cn(
              'text-sm font-semibold tracking-tight truncate',
              selected ? 'text-primary' : 'text-foreground group-hover:text-primary transition-colors',
            )}
          >
            {tool.label}
          </h4>
        </div>

        {/* Badges de estado alineados a la derecha */}
        <div className="flex shrink-0 items-center gap-1">
          {selected && (
            <Badge variant="default" className="text-[0.65rem] px-1.5 py-0 font-semibold shadow-xs">
              En uso
            </Badge>
          )}
          {!tool.hasSetup && isAvailable && !selected && (
            <Badge
              variant="outline"
              className="text-[0.65rem] px-1.5 py-0 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 font-medium"
            >
              <Zap className="size-2.5 mr-0.5 text-emerald-500" />
              Directo
            </Badge>
          )}
        </div>
      </div>

      {/* Tagline / Pregunta clave a ancho completo */}
      <p className="text-xs font-medium text-foreground/90 leading-snug text-pretty w-full min-w-0">
        {tool.tagline}
      </p>

      {/* Descripción a ancho completo */}
      <p className="text-xs text-muted-foreground text-pretty leading-relaxed line-clamp-3 w-full min-w-0">
        {tool.description}
      </p>

      {/* Requisitos de columnas (Needs) */}
      <div className="mt-auto space-y-2.5 pt-1.5 w-full min-w-0">
        <div className="flex flex-wrap items-center gap-1.5 w-full min-w-0">
          {isAvailable ? (
            tool.needs.map((need) => (
              <span
                key={need}
                className="inline-flex max-w-full items-center rounded-md border border-border/60 bg-muted/40 px-2 py-0.5 text-[0.68rem] text-muted-foreground font-normal leading-normal whitespace-normal break-words"
              >
                {need}
              </span>
            ))
          ) : (
            <div className="flex items-start gap-1.5 text-amber-600 dark:text-amber-400 text-xs py-0.5 max-w-full min-w-0">
              <CircleAlert className="size-3.5 shrink-0 mt-0.5" aria-hidden />
              <span className="text-[0.72rem] font-medium leading-tight">
                {availability.reason}
              </span>
            </div>
          )}
        </div>

        {/* Barra de acción directa inferior */}
        {isAvailable && (
          <div className="flex items-center justify-between gap-2 border-t border-border/50 pt-2 text-xs w-full min-w-0">
            <span
              className={cn(
                'truncate font-medium text-[0.75rem] transition-colors',
                selected
                  ? 'text-primary'
                  : 'text-muted-foreground group-hover:text-foreground',
              )}
            >
              {selected
                ? 'Continuar con esta herramienta'
                : tool.hasSetup
                  ? 'Configurar y ver análisis'
                  : 'Ver análisis directo'}
            </span>
            <span
              className={cn(
                'flex size-5.5 shrink-0 items-center justify-center rounded-full transition-all duration-200',
                selected
                  ? 'bg-primary/10 text-primary'
                  : 'bg-muted/70 text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground group-hover:translate-x-0.5',
              )}
            >
              <ArrowRight className="size-3" aria-hidden />
            </span>
          </div>
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

  if (parts.length === 0) return 'ninguna columna tipada';
  if (parts.length === 1) return parts[0] ?? '';
  return `${parts.slice(0, -1).join(', ')} y ${parts[parts.length - 1]}`;
}

