import type { ReactNode } from 'react';
import { Info } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';

/**
 * Tarjeta de configuración de una herramienta. Todas las herramientas piden
 * cosas distintas, pero las piden igual: mismo ancho, mismo tono y mismos
 * rótulos, para que cambiar de herramienta no obligue a reaprender la pantalla.
 */
export function SetupCard({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn('mx-auto w-full max-w-5xl shadow-xs', className)}>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold tracking-tight">{title}</CardTitle>
        <CardDescription className="text-sm text-pretty text-muted-foreground">{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">{children}</CardContent>
    </Card>
  );
}

/** Un control con su rótulo accesible y su explicación de una línea. */
export function SetupField({
  label,
  hint,
  className,
  children,
}: {
  label: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn('flex flex-col justify-between gap-1.5', className)}>
      <div className="space-y-0.5 min-h-[2.25rem]">
        <label className="text-xs font-semibold text-foreground tracking-tight block">
          {label}
        </label>
        {hint !== undefined && (
          <p className="text-[11px] text-pretty text-muted-foreground leading-snug">
            {hint}
          </p>
        )}
      </div>
      <div className="w-full">{children}</div>
    </div>
  );
}

/** Grupo de controles que se reparten el ancho en pantallas grandes. */
export function SetupGrid({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('grid gap-4 sm:grid-cols-2 lg:grid-cols-3', className)}>
      {children}
    </div>
  );
}

/** Nota explicativa al pie de la configuración de una herramienta. */
export function SetupNote({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex items-start gap-2.5 rounded-lg border border-border/60 bg-muted/25 px-3.5 py-2.5 text-xs text-muted-foreground text-pretty leading-relaxed',
        className,
      )}
    >
      <Info className="size-4 shrink-0 text-muted-foreground/80 mt-0.5" aria-hidden="true" />
      <div className="flex-1">{children}</div>
    </div>
  );
}
