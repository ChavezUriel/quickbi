import { useResolvedTheme } from '@/lib/use-resolved-theme';
import { cn } from '@/lib/utils';
import { formatDelta } from '../lib/format';

type Rgb = [number, number, number];

const GREEN: Rgb = [17, 122, 78];
const RED: Rgb = [192, 72, 61];
const NEUTRAL_LIGHT: Rgb = [238, 241, 246];
const NEUTRAL_DARK: Rgb = [42, 47, 55];

/**
 * La saturación crece más despacio que la magnitud (exponente > 1) para que el
 * color intenso quede reservado a las variaciones extremas: si un +8 % ya se
 * pinta de verde fuerte, el +300 % de al lado no tiene forma de destacar.
 */
const SATURATION_CURVE = 1.4;

interface DeltaPillProps {
  value: number | null;
  /** Mayor variación absoluta visible en el widget: fija el 100 % de color. */
  scale: number;
  className?: string;
}

/**
 * Insignia de variación porcentual con escala divergente: verde arriba, rojo
 * abajo, y neutro en el centro. La intensidad es relativa a lo que se está
 * viendo, no absoluta, así que la lectura no depende de la escala del dataset.
 */
export function DeltaPill({ value, scale, className }: DeltaPillProps) {
  const theme = useResolvedTheme();
  const neutral = theme === 'dark' ? NEUTRAL_DARK : NEUTRAL_LIGHT;

  if (value === null || !Number.isFinite(value)) {
    return (
      <span
        className={cn(
          'inline-flex h-5 items-center rounded-full px-2 text-xs font-medium text-muted-foreground',
          'bg-muted',
          className,
        )}
        title="Sin valor en el período de comparación"
      >
        n/d
      </span>
    );
  }

  const magnitude = scale <= 0 ? 0 : Math.min(Math.abs(value) / scale, 1);
  const background = mix(neutral, value >= 0 ? GREEN : RED, magnitude ** SATURATION_CURVE);

  return (
    <span
      className={cn(
        'inline-flex h-5 items-center rounded-full px-2 text-xs font-medium tabular-nums',
        className,
      )}
      style={{ backgroundColor: rgb(background), color: textColor(background) }}
    >
      {formatDelta(value)}
    </span>
  );
}

function mix(from: Rgb, to: Rgb, amount: number): Rgb {
  return [
    Math.round(from[0] + (to[0] - from[0]) * amount),
    Math.round(from[1] + (to[1] - from[1]) * amount),
    Math.round(from[2] + (to[2] - from[2]) * amount),
  ];
}

function rgb([red, green, blue]: Rgb): string {
  return `rgb(${red} ${green} ${blue})`;
}

/**
 * El texto se decide por la luminancia del fondo, no por el tema: la pastilla
 * pasa de casi blanca a verde oscuro dentro de la misma tabla.
 */
function textColor(background: Rgb): string {
  return relativeLuminance(background) > 0.4 ? 'rgb(23 23 23)' : 'rgb(250 250 250)';
}

function relativeLuminance([red, green, blue]: Rgb): number {
  const [r, g, b] = [red, green, blue].map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  }) as Rgb;

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
