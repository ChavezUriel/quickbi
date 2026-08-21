import { OptionSelect } from '../../components/option-select';
import { SetupCard, SetupField, SetupGrid } from '../../components/setup-card';
import { SlotPicker } from '../../components/slot-picker';
import { BASKET_SLOTS, type BasketConfigState } from '../use-basket-config';

const SUPPORT_OPTIONS = [
  { value: '0.005', label: '0,5 % de las cestas' },
  { value: '0.01', label: '1 % de las cestas (Recomendado)' },
  { value: '0.02', label: '2 % de las cestas' },
  { value: '0.05', label: '5 % de las cestas' },
];

const CONFIDENCE_OPTIONS = [
  { value: '0.05', label: '5 % de probabilidad' },
  { value: '0.10', label: '10 % de probabilidad (Recomendado)' },
  { value: '0.20', label: '20 % de probabilidad' },
  { value: '0.40', label: '40 % de probabilidad' },
];

const LIFT_OPTIONS = [
  { value: '0.5', label: 'Cualquier relación (Lift > 0.5)' },
  { value: '1.0', label: 'Asociación positiva (Lift > 1.0)' },
  { value: '1.2', label: 'Buena afinidad (Lift > 1.2)' },
  { value: '1.5', label: 'Alta afinidad (Lift > 1.5)' },
];

export function BasketSetup({ state }: { state: BasketConfigState }) {
  const { slots, settings, update } = state;

  return (
    <SetupCard
      title="Cesta de la compra y Venta Cruzada"
      description="Descubre qué productos se compran habitualmente juntos mediante reglas de asociación (Soporte, Confianza y Lift)."
    >
      <SlotPicker slots={BASKET_SLOTS} state={slots} />

      <SetupGrid>
        <SetupField
          label="Soporte mínimo"
          hint="En qué porcentaje de tickets debe aparecer la combinación para considerarla relevante."
        >
          <OptionSelect
            value={String(settings.minSupport)}
            options={SUPPORT_OPTIONS}
            ariaLabel="Soporte mínimo"
            onChange={(value) => update({ minSupport: Number(value) })}
          />
        </SetupField>

        <SetupField
          label="Confianza mínima"
          hint="Probabilidad de que compren el producto B habiendo comprado el producto A."
        >
          <OptionSelect
            value={String(settings.minConfidence)}
            options={CONFIDENCE_OPTIONS}
            ariaLabel="Confianza mínima"
            onChange={(value) => update({ minConfidence: Number(value) })}
          />
        </SetupField>

        <SetupField
          label="Lift mínimo"
          hint="Cuántas veces más probable es la compra conjunta frente al azar (> 1.0 = afinidad real)."
        >
          <OptionSelect
            value={String(settings.minLift)}
            options={LIFT_OPTIONS}
            ariaLabel="Lift mínimo"
            onChange={(value) => update({ minLift: Number(value) })}
          />
        </SetupField>
      </SetupGrid>

      <SetupGrid>
        <p className="col-span-full text-xs text-pretty text-muted-foreground">
          <b>Lift &gt; 1:</b> Comprar el producto A incrementa significativamente la probabilidad de
          adquirir el producto B. Ideal para recomendaciones en el checkout, packs promocionales y
          distribución en tienda.
        </p>
      </SetupGrid>
    </SetupCard>
  );
}
