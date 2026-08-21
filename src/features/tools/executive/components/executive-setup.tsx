import { CURRENCIES, CURRENCY_LABEL, GRANULARITIES, GRANULARITY_LABEL } from '@/features/analysis/labels';
import type { Currency, Granularity, MetricFormat } from '@/features/analysis/types';
import { OptionSelect } from '../../components/option-select';
import { SetupCard, SetupField, SetupGrid } from '../../components/setup-card';
import { SlotPicker } from '../../components/slot-picker';
import { EXECUTIVE_SLOTS, type ExecutiveConfigState } from '../use-executive-config';

const FORMAT_OPTIONS = [
  { value: 'moneda', label: 'Moneda' },
  { value: 'numero', label: 'Número' },
  { value: 'porcentaje', label: 'Porcentaje' },
];

const AGG_OPTIONS = [
  { value: 'sum', label: 'Suma acumulada' },
  { value: 'avg', label: 'Promedio' },
  { value: 'count', label: 'Conteo de registros' },
];

export function ExecutiveSetup({ state }: { state: ExecutiveConfigState }) {
  const { slots, settings, update } = state;

  return (
    <SetupCard
      title="Resumen ejecutivo"
      description="Genera una síntesis narrativa automática en lenguaje natural con métricas clave, tendencias, concentración de Pareto y detección de anomalías."
    >
      <SlotPicker slots={EXECUTIVE_SLOTS} state={slots} />

      <div className="grid gap-4 border-t pt-4 sm:grid-cols-2 lg:grid-cols-4">
        <SetupField label="Tipo de formato" hint="Cómo se presentan las cifras.">
          <OptionSelect
            value={settings.format}
            options={FORMAT_OPTIONS}
            ariaLabel="Formato de métrica"
            onChange={(val) => update({ format: val as MetricFormat })}
          />
        </SetupField>

        {settings.format === 'moneda' && (
          <SetupField label="Moneda" hint="Divisa para valores económicos.">
            <OptionSelect
              value={settings.currency}
              options={CURRENCIES.map((cur) => ({
                value: cur,
                label: CURRENCY_LABEL[cur],
              }))}
              ariaLabel="Moneda"
              onChange={(val) => update({ currency: val as Currency })}
            />
          </SetupField>
        )}

        <SetupField label="Agregación temporal" hint="Agrupación para la evolución.">
          <OptionSelect
            value={settings.grain}
            options={[...GRANULARITIES, 'anio'].map((g) => ({
              value: g,
              label: GRANULARITY_LABEL[g as Granularity] ?? g,
            }))}
            ariaLabel="Granularidad temporal"
            onChange={(val) => update({ grain: val as Granularity })}
          />
        </SetupField>

        <SetupField label="Cálculo de métrica" hint="Modo de sumar o promediar los valores.">
          <OptionSelect
            value={settings.agg}
            options={AGG_OPTIONS}
            ariaLabel="Tipo de cálculo"
            onChange={(val) => update({ agg: val as 'sum' | 'avg' | 'count' })}
          />
        </SetupField>
      </div>

      <SetupGrid>
        <p className="col-span-full text-xs text-pretty text-muted-foreground">
          El informe cruzará automáticamente la serie histórica y el desglose categórico para redactar un informe ejecutivo listo para presentaciones de negocio.
        </p>
      </SetupGrid>
    </SetupCard>
  );
}
