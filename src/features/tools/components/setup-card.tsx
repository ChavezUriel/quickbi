import type { ReactNode } from 'react';
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
}: {
  title: string;
  description: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="mx-auto w-full max-w-5xl">
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription className="text-pretty">{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">{children}</CardContent>
    </Card>
  );
}

/** Un control con su rótulo y su explicación de una línea. */
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
    <div className={cn('space-y-1.5', className)}>
      <div>
        <h3 className="text-sm font-medium">{label}</h3>
        {hint !== undefined && (
          <p className="text-xs text-pretty text-muted-foreground">{hint}</p>
        )}
      </div>
      {children}
    </div>
  );
}

/** Grupo de controles que se reparten el ancho en pantallas grandes. */
export function SetupGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>;
}
