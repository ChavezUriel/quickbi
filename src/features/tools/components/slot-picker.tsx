import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CircleAlert } from 'lucide-react';
import type { SlotDef, ToolSlotsState } from '../use-tool-slots';
import { OptionSelect } from './option-select';
import { SetupField, SetupGrid } from './setup-card';

/** Valor del desplegable para «este hueco se queda vacío». */
const UNSET = '__sin_asignar__';

/**
 * Qué columna ocupa cada hueco con nombre de la herramienta.
 *
 * Llega con una propuesta hecha a partir del nombre de las columnas, así que
 * lo normal es no tocar nada; cuando la propuesta falla, cambiarla cuesta un
 * clic y queda recordada para la próxima carga del mismo esquema.
 */
export function SlotPicker({
  slots,
  state,
}: {
  slots: readonly SlotDef[];
  state: ToolSlotsState;
}) {
  return (
    <div className="space-y-4">
      <SetupGrid>
        {slots.map((slot) => {
          const candidates = state.candidatesFor(slot.id);
          const value = state.assignments[slot.id] ?? UNSET;
          const options = [
            ...candidates.map((column) => ({
              value: column.name,
              label: column.name,
            })),
            ...(slot.required ? [] : [{ value: UNSET, label: 'Sin asignar' }]),
          ];

          return (
            <SetupField
              key={slot.id}
              label={slot.required ? slot.label : `${slot.label} (opcional)`}
              hint={slot.description}
            >
              {candidates.length === 0 ? (
                <p className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
                  Ninguna columna del tipo que hace falta. Corrige los tipos en el paso
                  anterior.
                </p>
              ) : (
                <OptionSelect
                  value={value}
                  options={options}
                  ariaLabel={slot.label}
                  onChange={(next) =>
                    state.setSlot(slot.id, next === UNSET ? null : next)
                  }
                />
              )}
            </SetupField>
          );
        })}
      </SetupGrid>

      {state.missing.length > 0 && (
        <Alert role="status">
          <CircleAlert className="size-4" />
          <AlertTitle>Falta asignar columnas</AlertTitle>
          <AlertDescription>
            Sin {formatList(state.missing)} no se puede calcular el análisis.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

function formatList(items: readonly string[]): string {
  const lower = items.map((item) => item.toLocaleLowerCase('es'));
  if (lower.length <= 1) return lower[0] ?? '';
  return `${lower.slice(0, -1).join(', ')} y ${lower[lower.length - 1]}`;
}
