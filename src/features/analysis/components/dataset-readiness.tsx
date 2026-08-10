import { CalendarDays, CheckCircle2, CircleAlert, Hash, Tags } from 'lucide-react';
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
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Preparación del análisis</CardTitle>
        <CardDescription>
          Así se han leído las columnas. En el siguiente paso puedes corregir cualquier
          tipo que no encaje.
        </CardDescription>
      </CardHeader>

      <CardContent className="grid gap-3 sm:grid-cols-3">
        <Check
          icon={<CalendarDays className="size-4" aria-hidden />}
          label="Eje temporal"
          columns={dates}
          ok={dates.length > 0}
          missing="Sin fechas: no habrá evolución ni comparación de períodos."
        />
        <Check
          icon={<Hash className="size-4" aria-hidden />}
          label="Métricas"
          columns={numbers}
          ok={numbers.length > 0}
          missing="Sin columnas numéricas: solo se podrán contar filas."
        />
        <Check
          icon={<Tags className="size-4" aria-hidden />}
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
    <div className="space-y-1.5 rounded-md border p-3">
      <div className="flex items-center gap-1.5 text-sm font-medium">
        {icon}
        {label}
        {ok ? (
          <CheckCircle2 className="size-3.5 text-emerald-600" aria-hidden />
        ) : (
          <CircleAlert className="size-3.5 text-muted-foreground" aria-hidden />
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        {ok
          ? columns
              .slice(0, 4)
              .map((column) => column.name)
              .join(', ') + (columns.length > 4 ? ` y ${columns.length - 4} más` : '')
          : missing}
      </p>
    </div>
  );
}
