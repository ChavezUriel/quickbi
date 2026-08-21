import { CURRENCIES, CURRENCY_LABEL, GRANULARITY_LABEL } from '@/features/analysis/labels';
import type { Currency, Granularity } from '@/features/analysis/types';
import { OptionSelect } from '../../components/option-select';
import { SetupCard, SetupField, SetupGrid } from '../../components/setup-card';
import { SlotPicker } from '../../components/slot-picker';
import type { SplitMode } from '../lib/waterfall';
import { WATERFALL_SLOTS, type WaterfallConfigState } from '../use-waterfall-config';

const SPLIT_MODES: { value: SplitMode; label: string }[] = [
  { value: 'mitades', label: 'Dividir el dataset en dos mitades' },
  { value: 'ultimos_periodos', label: 'Último período vs anterior' },
  { value: 'personalizado', label: 'Fechas personalizadas' },
];

const PERIOD_UNITS: { value: Granularity; label: string }[] = [
  { value: 'mes', label: GRANULARITY_LABEL.mes },
  { value: 'trimestre', label: GRANULARITY_LABEL.trimestre },
  { value: 'anio', label: GRANULARITY_LABEL.anio },
];

const MAX_CATEGORIES_OPTIONS = [
  { value: '5', label: 'Top 5 categorías' },
  { value: '7', label: 'Top 7 categorías' },
  { value: '10', label: 'Top 10 categorías' },
  { value: '15', label: 'Top 15 categorías' },
  { value: '-1', label: 'Todas las categorías' },
];

export function WaterfallSetup({ state }: { state: WaterfallConfigState }) {
  const { slots, settings, update } = state;

  return (
    <SetupCard
      title="Puente de variación (Waterfall)"
      description="Explica la diferencia entre dos períodos descomponiendo qué categorías crecieron, cuáles cayeron, cuáles aparecieron de nuevas y cuáles se perdieron."
    >
      <SlotPicker slots={WATERFALL_SLOTS} state={slots} />

      <div className="grid gap-4 border-t pt-4 sm:grid-cols-2 lg:grid-cols-3">
        <SetupField
          label="Partición de períodos"
          hint="Cómo se definen los dos bloques de tiempo a comparar."
        >
          <OptionSelect
            value={settings.splitMode}
            options={SPLIT_MODES}
            ariaLabel="Partición de períodos"
            onChange={(value) => update({ splitMode: value as SplitMode })}
          />
        </SetupField>

        {settings.splitMode === 'ultimos_periodos' && (
          <SetupField
            label="Grano del período"
            hint="Compara el último mes/trimestre/año contra el anterior."
          >
            <OptionSelect
              value={settings.periodUnit}
              options={PERIOD_UNITS}
              ariaLabel="Grano del período"
              onChange={(value) => update({ periodUnit: value as Granularity })}
            />
          </SetupField>
        )}

        <SetupField
          label="Límite de categorías"
          hint="El resto se agrupará en una barra de «Resto» para mantener el puente legible."
        >
          <OptionSelect
            value={String(settings.maxCategories)}
            options={MAX_CATEGORIES_OPTIONS}
            ariaLabel="Límite de categorías"
            onChange={(value) => update({ maxCategories: Number(value) })}
          />
        </SetupField>

        <SetupField label="Moneda" hint="Formato de visualización de los importes.">
          <OptionSelect
            value={settings.currency}
            options={CURRENCIES.map((c) => ({ value: c, label: CURRENCY_LABEL[c] }))}
            ariaLabel="Moneda"
            onChange={(value) => update({ currency: value as Currency })}
          />
        </SetupField>
      </div>

      {settings.splitMode === 'personalizado' && (
        <div className="grid gap-4 rounded-lg border border-border/60 bg-muted/20 p-3 sm:grid-cols-2">
          <SetupField label="Período 1 (Base / Inicio)">
            <div className="flex gap-2">
              <input
                type="date"
                value={settings.customPeriod1.desde}
                onChange={(e) =>
                  update({
                    customPeriod1: { ...settings.customPeriod1, desde: e.target.value },
                  })
                }
                aria-label="Período 1 desde"
                className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
              />
              <span className="self-center text-xs text-muted-foreground">a</span>
              <input
                type="date"
                value={settings.customPeriod1.hasta}
                onChange={(e) =>
                  update({
                    customPeriod1: { ...settings.customPeriod1, hasta: e.target.value },
                  })
                }
                aria-label="Período 1 hasta"
                className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
              />
            </div>
          </SetupField>

          <SetupField label="Período 2 (Actual / Final)">
            <div className="flex gap-2">
              <input
                type="date"
                value={settings.customPeriod2.desde}
                onChange={(e) =>
                  update({
                    customPeriod2: { ...settings.customPeriod2, desde: e.target.value },
                  })
                }
                aria-label="Período 2 desde"
                className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
              />
              <span className="self-center text-xs text-muted-foreground">a</span>
              <input
                type="date"
                value={settings.customPeriod2.hasta}
                onChange={(e) =>
                  update({
                    customPeriod2: { ...settings.customPeriod2, hasta: e.target.value },
                  })
                }
                aria-label="Período 2 hasta"
                className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
              />
            </div>
          </SetupField>
        </div>
      )}

      <SetupGrid>
        <p className="col-span-full text-xs text-pretty text-muted-foreground">
          El gráfico de cascada ordena automáticamente los impactos de mayor a menor relevancia
          y clasifica los movimientos en nuevos, crecimiento, contracción o perdidos.
        </p>
      </SetupGrid>
    </SetupCard>
  );
}
