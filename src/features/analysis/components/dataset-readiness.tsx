import { CheckCircle2, CircleAlert } from 'lucide-react';
import { DataTypeIcon } from '@/components/icons/data-type-icons';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { ColumnProfile } from '@/features/dataset/lib/column-types';
import type { ParsedDataset } from '@/features/dataset/types';

interface DatasetReadinessProps {
  dataset: ParsedDataset;
}

/**
 * Qué puede hacer el cuadro de mando con este dataset, dicho antes de entrar
 * al mapeo: descubrir que no hay ninguna columna de fecha dos pasos más tarde
 * es descubrirlo tarde.
 */
export function DatasetReadiness({ dataset }: DatasetReadinessProps) {
  const dates = dataset.columns.filter((column) => column.type === 'date');
  const numbers = dataset.columns.filter((column) => column.type === 'number');
  const categories = dataset.columns.filter(
    (column) => column.type === 'text' || column.type === 'boolean',
  );

  return (
    <Card className="shadow-xs">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold tracking-tight">Preparación del análisis</CardTitle>
        <CardDescription className="text-xs sm:text-sm text-muted-foreground">
          Así se han interpretado las columnas. En el siguiente paso puedes corregir cualquier
          tipo que no encaje.
        </CardDescription>
      </CardHeader>

      <CardContent className="grid gap-3 sm:grid-cols-3">
        <Check
          icon={<DataTypeIcon type="date" colored className="size-4" aria-hidden />}
          label="Eje temporal"
          columns={dates}
          ok={dates.length > 0}
          missing="Sin fechas: no habrá evolución ni comparación de períodos."
        />
        <Check
          icon={<DataTypeIcon type="number" colored className="size-4" aria-hidden />}
          label="Métricas"
          columns={numbers}
          ok={numbers.length > 0}
          missing="Sin columnas numéricas: solo se podrán contar filas."
        />
        <Check
          icon={<DataTypeIcon type="text" colored className="size-4" aria-hidden />}
          label="Dimensiones"
          columns={categories}
          ok={categories.length > 0}
          missing="Sin categorías: el análisis se hará sobre el total."
        />
      </CardContent>
    </Card>
  );
}

function Check({
  icon,
  label,
  columns,
  ok,
  missing,
}: {
  icon: React.ReactNode;
  label: string;
  columns: readonly ColumnProfile[];
  ok: boolean;
  missing: string;
}) {
  return (
    <div className="flex flex-col justify-between gap-2 rounded-xl border border-border/80 bg-muted/15 p-3.5 shadow-2xs transition-all hover:border-primary/30">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-foreground tracking-tight">
          <div className="flex size-6 items-center justify-center rounded-md bg-primary/10">
            {icon}
          </div>
          <span>{label}</span>
        </div>
        {ok ? (
          <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
        ) : (
          <CircleAlert className="size-4 text-amber-500" aria-hidden />
        )}
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed">
        {ok ? (
          <span className="font-mono text-[11px] text-foreground/90">
            {columns
              .slice(0, 4)
              .map((column) => column.name)
              .join(', ') + (columns.length > 4 ? ` y ${columns.length - 4} más` : '')}
          </span>
        ) : (
          <span className="text-muted-foreground/80">{missing}</span>
        )}
      </p>
    </div>
  );
}
