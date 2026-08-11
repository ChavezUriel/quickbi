import type { DateWindow, Granularity } from '../types';

/**
 * Aritmética de calendario sobre días ISO (`YYYY-MM-DD`).
 *
 * El día ISO es la representación canónica en todo el análisis: es comparable
 * con `<` y `>` sin convertir nada, sobrevive a `JSON` y no arrastra la hora,
 * que aquí solo podría introducir errores de zona horaria. Las fechas del
 * dataset se construyen en hora local (ver `parseDate`), así que los `getters`
 * locales son los coherentes.
 */

export function toIso(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function fromIso(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1);
}

export function addDays(iso: string, amount: number): string {
  const date = fromIso(iso);
  date.setDate(date.getDate() + amount);
  return toIso(date);
}

/**
 * Suma meses conservando el día cuando existe. `new Date(2026, 0, 31)` más un
 * mes desbordaría al 3 de marzo; aquí el 31 de enero + 1 mes es el 28 de febrero.
 */
export function addMonths(iso: string, amount: number): string {
  const date = fromIso(iso);
  const day = date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() + amount);
  date.setDate(Math.min(day, daysInMonth(date.getFullYear(), date.getMonth())));
  return toIso(date);
}

export function addUnits(iso: string, amount: number, unit: Granularity): string {
  switch (unit) {
    case 'dia':
      return addDays(iso, amount);
    case 'semana':
      return addDays(iso, amount * 7);
    case 'mes':
      return addMonths(iso, amount);
    case 'trimestre':
      return addMonths(iso, amount * 3);
    case 'anio':
      return addMonths(iso, amount * 12);
  }
}

/** Primer día del período que contiene a `iso` (lunes para las semanas). */
export function startOfUnit(iso: string, unit: Granularity): string {
  const date = fromIso(iso);
  const year = date.getFullYear();
  const month = date.getMonth();

  switch (unit) {
    case 'dia':
      return iso;
    case 'semana': {
      // `getDay()` es 0 el domingo: (día + 6) % 7 son los días transcurridos
      // desde el lunes.
      const offset = (date.getDay() + 6) % 7;
      return addDays(iso, -offset);
    }
    case 'mes':
      return toIso(new Date(year, month, 1));
    case 'trimestre':
      return toIso(new Date(year, Math.floor(month / 3) * 3, 1));
    case 'anio':
      return toIso(new Date(year, 0, 1));
  }
}

/** Clave de cubo: identidad del período, no su etiqueta. */
export function bucketOf(iso: string, grano: Granularity): string {
  const date = fromIso(iso);
  const year = date.getFullYear();

  switch (grano) {
    case 'dia':
      return iso;
    case 'semana':
      return startOfUnit(iso, 'semana');
    case 'mes':
      return `${year}-${pad2(date.getMonth() + 1)}`;
    case 'trimestre':
      return `${year}-T${Math.floor(date.getMonth() / 3) + 1}`;
    case 'anio':
      return String(year);
  }
}

const MONTH_LABEL = new Intl.DateTimeFormat('es-MX', { month: 'short', year: '2-digit' });
const DAY_LABEL = new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short' });
const COMPACT_DATE_LABEL = new Intl.DateTimeFormat('es-MX', {
  day: 'numeric',
  month: 'short',
  year: '2-digit',
});

export function bucketLabel(bucket: string, grano: Granularity): string {
  switch (grano) {
    case 'dia':
      return DAY_LABEL.format(fromIso(bucket));
    case 'semana':
      return `Sem. ${DAY_LABEL.format(fromIso(bucket))}`;
    case 'mes':
      return MONTH_LABEL.format(fromIso(`${bucket}-01`));
    case 'trimestre':
    case 'anio':
      return bucket;
  }
}

/** Todos los cubos entre dos fechas, incluidos los vacíos: una serie con huecos miente. */
export function generateBuckets(window: DateWindow, grano: Granularity): string[] {
  const buckets: string[] = [];
  let cursor = startOfUnit(window.desde, grano);

  // Tope defensivo: con un rango absurdo (fechas del año 1900 por día) es
  // preferible una serie truncada a bloquear la pestaña.
  while (cursor <= window.hasta && buckets.length < 2000) {
    buckets.push(bucketOf(cursor, grano));
    cursor = addUnits(cursor, 1, grano);
  }

  return buckets;
}

export function daysBetween(from: string, to: string): number {
  const ms = fromIso(to).getTime() - fromIso(from).getTime();
  return Math.round(ms / 86_400_000);
}

/**
 * Granularidad por defecto de la evolución. Los umbrales buscan que la serie
 * quepa en pantalla sin dejar de contar su historia: ~2 meses por día, ~13
 * meses por semana, y de ahí en adelante por mes.
 */
export function autoGranularity(window: DateWindow): Granularity {
  const span = daysBetween(window.desde, window.hasta) + 1;
  if (span <= 62) return 'dia';
  if (span <= 400) return 'semana';
  if (span <= 1500) return 'mes';
  return 'trimestre';
}

/**
 * Ventana de comparación desplazada hacia atrás.
 *
 * Cuando la ventana viene de un preset («últimos 3 meses») el desplazamiento
 * es en esas mismas unidades y se recorta al día equivalente: comparar tres
 * meses completos contra tres meses de los cuales el último va por la mitad
 * inventaría una caída que no existe. Sin preset se desplaza por duración exacta.
 */
export function shiftWindow(
  window: DateWindow,
  amount: number,
  unit: Granularity,
): DateWindow {
  return {
    desde: addUnits(window.desde, -amount, unit),
    // Se desplaza el día siguiente al final y se retrocede uno: así el
    // 7 de agosto sobre «últimos 3 meses» compara contra el 7 de mayo.
    hasta: addDays(addUnits(addDays(window.hasta, 1), -amount, unit), -1),
  };
}

export function shiftByDuration(window: DateWindow): DateWindow {
  const span = daysBetween(window.desde, window.hasta) + 1;
  return {
    desde: addDays(window.desde, -span),
    hasta: addDays(window.desde, -1),
  };
}

export function formatDay(iso: string): string {
  return fromIso(iso).toLocaleDateString('es-MX');
}

export function formatWindow(window: DateWindow): string {
  return `${formatDay(window.desde)} — ${formatDay(window.hasta)}`;
}

export function formatCompactWindow(window: DateWindow): string {
  const formatDate = (iso: string) =>
    COMPACT_DATE_LABEL.format(fromIso(iso)).replace(/\s+/gu, '/');

  return `${formatDate(window.desde)} — ${formatDate(window.hasta)}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}
