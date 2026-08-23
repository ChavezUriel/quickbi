import type { ComponentType, SVGProps } from 'react';
import { cn } from '@/lib/utils';
import type { ColumnSubtype, ColumnType } from '@/features/dataset/lib/column-types';

export interface IconProps extends SVGProps<SVGSVGElement> {
  size?: number | string;
  className?: string;
}

// ---------------------------------------------------------------------------
// 1. Iconos Cuantitativos y Métricas (Measures)
// ---------------------------------------------------------------------------

/** Moneda / Dinero ($ / €) */
export function CurrencyIcon({ className, size, ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('size-4 shrink-0', className)}
      width={size}
      height={size}
      aria-hidden="true"
      {...props}
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M14.5 9.5a2.5 2.5 0 0 0-5 0c0 3 5 2 5 5a2.5 2.5 0 0 1-5 0" />
      <path d="M12 6.5v11" />
    </svg>
  );
}

/** Porcentaje / Ratio (%) */
export function PercentageIcon({ className, size, ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('size-4 shrink-0', className)}
      width={size}
      height={size}
      aria-hidden="true"
      {...props}
    >
      <line x1="19" y1="5" x2="5" y2="19" />
      <circle cx="7" cy="7" r="2.5" />
      <circle cx="17" cy="17" r="2.5" />
    </svg>
  );
}

/** Entero / Conteo (# / 123) */
export function IntegerIcon({ className, size, ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('size-4 shrink-0', className)}
      width={size}
      height={size}
      aria-hidden="true"
      {...props}
    >
      <line x1="4" y1="9" x2="20" y2="9" />
      <line x1="4" y1="15" x2="20" y2="15" />
      <line x1="10" y1="3" x2="8" y2="21" />
      <line x1="16" y1="3" x2="14" y2="21" />
    </svg>
  );
}

/** Decimal / Continuo (0.0) */
export function DecimalIcon({ className, size, ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('size-4 shrink-0', className)}
      width={size}
      height={size}
      aria-hidden="true"
      {...props}
    >
      <rect width="6" height="10" x="4" y="7" rx="3" />
      <circle cx="12" cy="16" r="1" fill="currentColor" />
      <rect width="6" height="10" x="14" y="7" rx="3" />
    </svg>
  );
}

/** Duración / Intervalo de tiempo */
export function DurationIcon({ className, size, ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('size-4 shrink-0', className)}
      width={size}
      height={size}
      aria-hidden="true"
      {...props}
    >
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2.5 2" />
      <path d="M10 2h4" />
      <path d="M12 2v3" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// 2. Iconos Temporales (Time-Series)
// ---------------------------------------------------------------------------

/** Fecha Calendario (YYYY-MM-DD) */
export function CalendarDateIcon({ className, size, ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('size-4 shrink-0', className)}
      width={size}
      height={size}
      aria-hidden="true"
      {...props}
    >
      <rect width="18" height="17" x="3" y="4" rx="2.5" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="9.5" x2="21" y2="9.5" />
      <path d="M7.5 13.5h.01M12 13.5h.01M16.5 13.5h.01M7.5 17h.01M12 17h.01" />
    </svg>
  );
}

/** Fecha y Hora (Timestamp) */
export function DateTimeIcon({ className, size, ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('size-4 shrink-0', className)}
      width={size}
      height={size}
      aria-hidden="true"
      {...props}
    >
      <path d="M11.5 21H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="9.5" x2="21" y2="9.5" />
      <circle cx="17.5" cy="17.5" r="4.5" />
      <path d="M17.5 15.5v2l1.2 1" />
    </svg>
  );
}

/** Período / Cuatrimestre / Semana */
export function PeriodIcon({ className, size, ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('size-4 shrink-0', className)}
      width={size}
      height={size}
      aria-hidden="true"
      {...props}
    >
      <rect width="18" height="18" x="3" y="3" rx="2.5" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="9" y1="21" x2="9" y2="9" />
      <path d="m13.5 14 2 2 2.5-2.5" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// 3. Iconos Categóricos y Semánticos (Dimensions)
// ---------------------------------------------------------------------------

/** Identificador / Clave Primaria (ID, UUID, Folio) */
export function IdentifierIcon({ className, size, ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('size-4 shrink-0', className)}
      width={size}
      height={size}
      aria-hidden="true"
      {...props}
    >
      <circle cx="8" cy="15" r="4" />
      <path d="m11 12 7.5-7.5H21v2.5l-1.5 1.5v2L18 12" />
    </svg>
  );
}

/** Geografía / Región / Ubicación */
export function GeoIcon({ className, size, ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('size-4 shrink-0', className)}
      width={size}
      height={size}
      aria-hidden="true"
      {...props}
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M3.6 9h16.8M3.6 15h16.8" />
      <path d="M12 3a14.5 14.5 0 0 0 0 18M12 3a14.5 14.5 0 0 1 0 18" />
    </svg>
  );
}

/** Cliente / Usuario / Persona */
export function CustomerIcon({ className, size, ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('size-4 shrink-0', className)}
      width={size}
      height={size}
      aria-hidden="true"
      {...props}
    >
      <circle cx="12" cy="7" r="4" />
      <path d="M5 20.5a7 7 0 0 1 14 0" />
    </svg>
  );
}

/** Producto / SKU / Inventario */
export function ProductIcon({ className, size, ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('size-4 shrink-0', className)}
      width={size}
      height={size}
      aria-hidden="true"
      {...props}
    >
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <path d="m3.3 7 8.7 5 8.7-5" />
      <path d="M12 22V12" />
    </svg>
  );
}

/** Etapa de Embudo / Estado de Proceso */
export function FunnelStageIcon({ className, size, ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('size-4 shrink-0', className)}
      width={size}
      height={size}
      aria-hidden="true"
      {...props}
    >
      <path d="M3 4h18l-6.5 8v6l-5 2v-8L3 4Z" />
    </svg>
  );
}

/** Texto General / Etiqueta Categórica (Aa) */
export function TextIcon({ className, size, ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('size-4 shrink-0', className)}
      width={size}
      height={size}
      aria-hidden="true"
      {...props}
    >
      <path d="M4 7V4h16v3" />
      <path d="M9 20h6" />
      <path d="M12 4v16" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// 4. Iconos Lógicos y Estructurales
// ---------------------------------------------------------------------------

/** Booleano / Interruptor (Sí/No) */
export function BooleanIcon({ className, size, ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('size-4 shrink-0', className)}
      width={size}
      height={size}
      aria-hidden="true"
      {...props}
    >
      <rect width="18" height="12" x="3" y="6" rx="6" />
      <circle cx="15" cy="12" r="3" fill="currentColor" />
    </svg>
  );
}

/** Columna Vacía / Nula */
export function EmptyIcon({ className, size, ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('size-4 shrink-0', className)}
      width={size}
      height={size}
      aria-hidden="true"
      {...props}
    >
      <rect width="18" height="18" x="3" y="3" rx="2" strokeDasharray="3 3" />
      <line x1="3" y1="3" x2="21" y2="21" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// 5. Diccionarios y Mapeos Unificados
// ---------------------------------------------------------------------------

export const SUBTYPE_LABEL: Record<ColumnSubtype, string> = {
  currency: 'Moneda',
  percentage: 'Porcentaje',
  integer: 'Entero / Conteo',
  decimal: 'Decimal',
  duration: 'Duración',
  date: 'Fecha',
  datetime: 'Fecha y Hora',
  period: 'Período',
  identifier: 'Identificador / ID',
  geo: 'Geografía',
  customer: 'Cliente / Entidad',
  product: 'Producto / SKU',
  funnel_stage: 'Etapa de Embudo',
  text: 'Texto',
  boolean: 'Booleano',
  empty: 'Vacía',
};

export type IconComponent = ComponentType<IconProps>;

export const BASE_TYPE_ICON: Record<ColumnType, IconComponent> = {
  number: IntegerIcon,
  date: CalendarDateIcon,
  boolean: BooleanIcon,
  text: TextIcon,
  empty: EmptyIcon,
};

export const SUBTYPE_ICON: Record<ColumnSubtype, IconComponent> = {
  currency: CurrencyIcon,
  percentage: PercentageIcon,
  integer: IntegerIcon,
  decimal: DecimalIcon,
  duration: DurationIcon,
  date: CalendarDateIcon,
  datetime: DateTimeIcon,
  period: PeriodIcon,
  identifier: IdentifierIcon,
  geo: GeoIcon,
  customer: CustomerIcon,
  product: ProductIcon,
  funnel_stage: FunnelStageIcon,
  text: TextIcon,
  boolean: BooleanIcon,
  empty: EmptyIcon,
};

/**
 * Retorna las clases Tailwind de color temático según el tipo o subtipo semántico.
 */
export function getDataTypeColorClasses(type?: ColumnType, subtype?: ColumnSubtype): {
  icon: string;
  badge: string;
  dot: string;
} {
  const effective = subtype ?? (type === 'number' ? 'decimal' : (type as ColumnSubtype) ?? 'text');

  switch (effective) {
    case 'currency':
      return {
        icon: 'text-emerald-600 dark:text-emerald-400',
        badge: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
        dot: 'bg-emerald-500',
      };
    case 'percentage':
      return {
        icon: 'text-indigo-600 dark:text-indigo-400',
        badge: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/20',
        dot: 'bg-indigo-500',
      };
    case 'integer':
    case 'decimal':
      return {
        icon: 'text-blue-600 dark:text-blue-400',
        badge: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20',
        dot: 'bg-blue-500',
      };
    case 'duration':
      return {
        icon: 'text-cyan-600 dark:text-cyan-400',
        badge: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/20',
        dot: 'bg-cyan-500',
      };
    case 'date':
    case 'datetime':
    case 'period':
      return {
        icon: 'text-amber-600 dark:text-amber-400',
        badge: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20',
        dot: 'bg-amber-500',
      };
    case 'geo':
      return {
        icon: 'text-teal-600 dark:text-teal-400',
        badge: 'bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/20',
        dot: 'bg-teal-500',
      };
    case 'customer':
      return {
        icon: 'text-sky-600 dark:text-sky-400',
        badge: 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20',
        dot: 'bg-sky-500',
      };
    case 'product':
      return {
        icon: 'text-amber-700 dark:text-amber-300',
        badge: 'bg-amber-600/10 text-amber-800 dark:text-amber-200 border-amber-600/20',
        dot: 'bg-amber-600',
      };
    case 'identifier':
      return {
        icon: 'text-slate-600 dark:text-slate-400',
        badge: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20',
        dot: 'bg-slate-500',
      };
    case 'funnel_stage':
      return {
        icon: 'text-rose-600 dark:text-rose-400',
        badge: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20',
        dot: 'bg-rose-500',
      };
    case 'boolean':
      return {
        icon: 'text-fuchsia-600 dark:text-fuchsia-400',
        badge: 'bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300 border-fuchsia-500/20',
        dot: 'bg-fuchsia-500',
      };
    case 'empty':
      return {
        icon: 'text-muted-foreground',
        badge: 'bg-muted text-muted-foreground border-border',
        dot: 'bg-muted-foreground',
      };
    case 'text':
    default:
      return {
        icon: 'text-purple-600 dark:text-purple-400',
        badge: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20',
        dot: 'bg-purple-500',
      };
  }
}

// ---------------------------------------------------------------------------
// 6. Componentes React de Alto Nivel
// ---------------------------------------------------------------------------

export interface DataTypeIconProps extends IconProps {
  type?: ColumnType;
  subtype?: ColumnSubtype;
  colored?: boolean;
}

/**
 * Componente unificado para renderizar el icono adecuado según el tipo o subtipo semántico.
 */
export function DataTypeIcon({
  type = 'text',
  subtype,
  colored = false,
  className,
  ...props
}: DataTypeIconProps) {
  const Icon = subtype ? SUBTYPE_ICON[subtype] ?? BASE_TYPE_ICON[type] : BASE_TYPE_ICON[type];
  const colors = colored ? getDataTypeColorClasses(type, subtype).icon : '';

  return <Icon className={cn(colors, className)} {...props} />;
}

export interface DataTypeBadgeProps {
  type: ColumnType;
  subtype?: ColumnSubtype;
  showSubtype?: boolean;
  className?: string;
  size?: 'xs' | 'sm' | 'md';
}

/**
 * Badge o pastilla visual con icono SVG y etiqueta descriptiva.
 */
export function DataTypeBadge({
  type,
  subtype,
  showSubtype = false,
  className,
  size = 'sm',
}: DataTypeBadgeProps) {
  const colors = getDataTypeColorClasses(type, subtype);
  const label = showSubtype && subtype ? SUBTYPE_LABEL[subtype] : TYPE_NAMES[type];

  const sizeClasses = {
    xs: 'px-1.5 py-0.5 text-[10px] gap-1',
    sm: 'px-2 py-0.5 text-xs gap-1.5',
    md: 'px-2.5 py-1 text-xs gap-1.5 font-medium',
  }[size];

  const iconSizes = {
    xs: 'size-3',
    sm: 'size-3.5',
    md: 'size-4',
  }[size];

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border font-medium transition-colors select-none',
        colors.badge,
        sizeClasses,
        className,
      )}
    >
      <DataTypeIcon type={type} subtype={subtype} className={cn(colors.icon, iconSizes)} />
      <span>{label}</span>
    </span>
  );
}

const TYPE_NAMES: Record<ColumnType, string> = {
  number: 'Número',
  date: 'Fecha',
  boolean: 'Booleano',
  text: 'Texto',
  empty: 'Vacía',
};
