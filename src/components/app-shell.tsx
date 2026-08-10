import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Ancho de trabajo de la aplicación.
 *
 * QuickBI es un cuadro de mando: la información quiere todo el ancho que haya.
 * El tope existe solo para que en un monitor ultrapanorámico las tablas no se
 * estiren hasta hacer ilegible la relación entre columnas.
 */
export const SHELL_CONTAINER = 'mx-auto w-full max-w-[120rem] px-4 sm:px-6 lg:px-8';

/** Altura de la barra superior fija; referencia para lo que se pega debajo. */
export const HEADER_HEIGHT = 'h-14';

/**
 * `fill` cambia el modelo de scroll: en vez de un documento que crece, la
 * aplicación se clava a la altura de la ventana y el scroll pasa a vivir dentro
 * de cada panel. Solo se activa a partir de `xl`, donde hay altura que repartir;
 * por debajo, un cuadro de mando encajado a la fuerza sería un montón de cajitas
 * de 80 px, y el documento largo es la respuesta correcta.
 */
export function AppShell({ children, fill = false }: { children: ReactNode; fill?: boolean }) {
  return (
    <div
      className={cn(
        'flex min-h-dvh flex-col bg-background',
        fill && 'xl:h-dvh xl:overflow-hidden',
      )}
    >
      {children}
    </div>
  );
}

/**
 * Barra fija, translúcida. Se usa arriba y abajo: misma pieza, distinto borde.
 */
export function StickyBar({
  side,
  className,
  children,
}: {
  side: 'top' | 'bottom';
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        'sticky z-30 bg-background/85 backdrop-blur-sm supports-[backdrop-filter]:bg-background/70',
        side === 'top' ? 'top-0 border-b border-border' : 'bottom-0 border-t border-border',
        className,
      )}
    >
      {children}
    </div>
  );
}
