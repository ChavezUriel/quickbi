import { addDays, daysBetween, fromIso } from '@/features/analysis/lib/dates';

export interface SeasonalityOptions {
  dateCol: string;
  measureCol: string;
  agg?: 'sum' | 'avg';
  movingAvgWindow?: number;
}

export interface DayOfWeekStat {
  dayIndex: number; // 0 = Domingo, 1 = Lunes, ..., 6 = Sábado
  isoDay: number; // 1 = Lunes, ..., 7 = Domingo
  name: string;
  shortName: string;
  total: number;
  occurrences: number;
  average: number;
  share: number;
  seasonalityIndex: number; // base 100
}

export interface MonthOfYearStat {
  monthIndex: number; // 0 = Enero, ..., 11 = Diciembre
  monthNumber: number; // 1 = Enero, ..., 12 = Diciembre
  name: string;
  shortName: string;
  total: number;
  occurrences: number;
  average: number;
  share: number;
  seasonalityIndex: number; // base 100
}

export interface QuarterStat {
  quarter: number; // 1, 2, 3, 4
  name: string;
  total: number;
  occurrences: number;
  average: number;
  share: number;
  seasonalityIndex: number;
}

export interface DailyPoint {
  date: string;
  value: number;
  movingAvg: number | null;
}

export interface SeasonalitySummary {
  totalRecords: number;
  validRecords: number;
  ignoredRows: number;
  startDate: string | null;
  endDate: string | null;
  totalDaysSpan: number;
  totalVolume: number;
  globalDailyAverage: number;
  daysOfWeek: DayOfWeekStat[];
  monthsOfYear: MonthOfYearStat[];
  quarters: QuarterStat[];
  timeline: DailyPoint[];
  calendarData: [string, number][];
  calendarYears: number[];
  peakDayOfWeek: DayOfWeekStat | null;
  troughDayOfWeek: DayOfWeekStat | null;
  peakMonth: MonthOfYearStat | null;
  troughMonth: MonthOfYearStat | null;
  weekdayVsWeekendRatio: number; // weekdayAvg / weekendAvg
  seasonalAmplitude: number; // (peak - trough) / mean * 100
  insights: string[];
}

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const DAY_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];
const MONTH_SHORT = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
];

export function computeSeasonality(
  rows: readonly Record<string, unknown>[],
  options: SeasonalityOptions,
): SeasonalitySummary {
  const { dateCol, measureCol, agg = 'sum', movingAvgWindow = 7 } = options;

  let totalRecords = 0;
  let validRecords = 0;
  let ignoredRows = 0;

  // Mapa de fechas únicas YYYY-MM-DD -> array de valores
  const dailyValuesMap = new Map<string, number[]>();

  for (const row of rows) {
    totalRecords++;
    const rawDate = row[dateCol];
    const rawVal = row[measureCol];

    const val = typeof rawVal === 'number' && Number.isFinite(rawVal) ? rawVal : null;
    let isoDate: string | null = null;

    if (typeof rawDate === 'string' && rawDate.length >= 10) {
      const sub = rawDate.slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(sub)) {
        isoDate = sub;
      }
    }

    if (val === null || isoDate === null) {
      ignoredRows++;
      continue;
    }

    validRecords++;
    const list = dailyValuesMap.get(isoDate) ?? [];
    list.push(val);
    dailyValuesMap.set(isoDate, list);
  }

  if (dailyValuesMap.size === 0) {
    return createEmptySeasonality(totalRecords, ignoredRows);
  }

  const sortedDates = Array.from(dailyValuesMap.keys()).sort();
  const startDate = sortedDates[0]!;
  const endDate = sortedDates[sortedDates.length - 1]!;
  const totalDaysSpan = Math.max(1, daysBetween(startDate, endDate) + 1);

  // Timeline continuo y mapa de calor
  const timeline: DailyPoint[] = [];
  const calendarData: [string, number][] = [];
  const yearsSet = new Set<number>();
  let totalVolume = 0;

  let cur = startDate;
  const allDailyValues: number[] = [];

  // Acumuladores por Día de Semana y Mes
  // Day of week: 0..6
  const dowTotals = Array.from({ length: 7 }, () => ({ sum: 0, count: 0 }));
  // Month of year: 0..11
  const monthTotals = Array.from({ length: 12 }, () => ({ sum: 0, count: 0 }));
  // Quarters: 0..3
  const quarterTotals = Array.from({ length: 4 }, () => ({ sum: 0, count: 0 }));

  while (cur <= endDate && timeline.length < 5000) {
    const list = dailyValuesMap.get(cur);
    let dayVal = 0;
    if (list && list.length > 0) {
      const sum = list.reduce((a, b) => a + b, 0);
      dayVal = agg === 'avg' ? sum / list.length : sum;
    }

    totalVolume += dayVal;
    allDailyValues.push(dayVal);

    const d = fromIso(cur);
    const dayOfWeek = d.getDay(); // 0..6
    const month = d.getMonth(); // 0..11
    const quarter = Math.floor(month / 3); // 0..3
    const year = d.getFullYear();
    yearsSet.add(year);

    if (dayVal > 0 || (list && list.length > 0)) {
      dowTotals[dayOfWeek]!.sum += dayVal;
      dowTotals[dayOfWeek]!.count += 1;

      monthTotals[month]!.sum += dayVal;
      monthTotals[month]!.count += 1;

      quarterTotals[quarter]!.sum += dayVal;
      quarterTotals[quarter]!.count += 1;
    }

    calendarData.push([cur, Number(dayVal.toFixed(2))]);

    // Calcular media móvil
    const windowStart = Math.max(0, allDailyValues.length - movingAvgWindow);
    const windowSlice = allDailyValues.slice(windowStart);
    const ma = windowSlice.length > 0 ? windowSlice.reduce((a, b) => a + b, 0) / windowSlice.length : null;

    timeline.push({
      date: cur,
      value: dayVal,
      movingAvg: ma !== null ? Number(ma.toFixed(2)) : null,
    });

    cur = addDays(cur, 1);
  }

  const globalDailyAverage = totalDaysSpan > 0 ? totalVolume / totalDaysSpan : 0;

  // Estadísticas de Día de la Semana (ordenado Lunes a Domingo: 1, 2, 3, 4, 5, 6, 0)
  const dowOrder = [1, 2, 3, 4, 5, 6, 0];
  const dowGrandSum = dowTotals.reduce((a, b) => a + b.sum, 0);
  const dowActiveDays = dowTotals.reduce((a, b) => a + (b.count > 0 ? 1 : 0), 0);
  const dowAvgBaseline = dowActiveDays > 0 ? dowGrandSum / dowActiveDays : 1;

  const daysOfWeek: DayOfWeekStat[] = dowOrder.map((dayIndex) => {
    const data = dowTotals[dayIndex]!;
    const avg = data.count > 0 ? data.sum / data.count : 0;
    const share = dowGrandSum > 0 ? (data.sum / dowGrandSum) * 100 : 0;
    const seasonalityIndex = dowAvgBaseline > 0 ? (avg / (dowGrandSum / 7)) * 100 : 100;

    return {
      dayIndex,
      isoDay: dayIndex === 0 ? 7 : dayIndex,
      name: DAY_NAMES[dayIndex]!,
      shortName: DAY_SHORT[dayIndex]!,
      total: data.sum,
      occurrences: data.count,
      average: avg,
      share,
      seasonalityIndex: Number.isFinite(seasonalityIndex) ? seasonalityIndex : 100,
    };
  });

  // Estadísticas de Mes del Año (1 a 12)
  const monthGrandSum = monthTotals.reduce((a, b) => a + b.sum, 0);
  const monthsOfYear: MonthOfYearStat[] = monthTotals.map((data, monthIndex) => {
    const avg = data.count > 0 ? data.sum / data.count : 0;
    const share = monthGrandSum > 0 ? (data.sum / monthGrandSum) * 100 : 0;
    const seasonalityIndex = (monthGrandSum / 12) > 0 ? (avg / (monthGrandSum / 12)) * 100 : 100;

    return {
      monthIndex,
      monthNumber: monthIndex + 1,
      name: MONTH_NAMES[monthIndex]!,
      shortName: MONTH_SHORT[monthIndex]!,
      total: data.sum,
      occurrences: data.count,
      average: avg,
      share,
      seasonalityIndex: Number.isFinite(seasonalityIndex) ? seasonalityIndex : 100,
    };
  });

  // Estadísticas Trimestrales (T1 a T4)
  const quarterGrandSum = quarterTotals.reduce((a, b) => a + b.sum, 0);
  const quarters: QuarterStat[] = quarterTotals.map((data, qIndex) => {
    const avg = data.count > 0 ? data.sum / data.count : 0;
    const share = quarterGrandSum > 0 ? (data.sum / quarterGrandSum) * 100 : 0;
    const seasonalityIndex = (quarterGrandSum / 4) > 0 ? (avg / (quarterGrandSum / 4)) * 100 : 100;

    return {
      quarter: qIndex + 1,
      name: `T${qIndex + 1}`,
      total: data.sum,
      occurrences: data.count,
      average: avg,
      share,
      seasonalityIndex: Number.isFinite(seasonalityIndex) ? seasonalityIndex : 100,
    };
  });

  // Picos y Valles
  const sortedDowByAvg = [...daysOfWeek].sort((a, b) => b.average - a.average);
  const peakDayOfWeek = sortedDowByAvg[0] ?? null;
  const troughDayOfWeek = sortedDowByAvg[sortedDowByAvg.length - 1] ?? null;

  const sortedMonthsByAvg = [...monthsOfYear].sort((a, b) => b.average - a.average);
  const peakMonth = sortedMonthsByAvg[0] ?? null;
  const troughMonth = sortedMonthsByAvg[sortedMonthsByAvg.length - 1] ?? null;

  // Días Laborables (1..5) vs Fin de Semana (0, 6)
  const weekdaySums = daysOfWeek.filter((d) => d.dayIndex >= 1 && d.dayIndex <= 5);
  const weekendSums = daysOfWeek.filter((d) => d.dayIndex === 0 || d.dayIndex === 6);
  const weekdayAvg = weekdaySums.length > 0 ? weekdaySums.reduce((a, b) => a + b.average, 0) / weekdaySums.length : 0;
  const weekendAvg = weekendSums.length > 0 ? weekendSums.reduce((a, b) => a + b.average, 0) / weekendSums.length : 0;
  const weekdayVsWeekendRatio = weekendAvg > 0 ? weekdayAvg / weekendAvg : 1;

  // Amplitud estacional (% entre mes pico y valle respecto a la media mensual)
  const monthMean = monthGrandSum / 12;
  const seasonalAmplitude =
    monthMean > 0 && peakMonth && troughMonth
      ? ((peakMonth.average - troughMonth.average) / monthMean) * 100
      : 0;

  // Narrativa de insights
  const insights: string[] = [];
  if (peakDayOfWeek && troughDayOfWeek && peakDayOfWeek.name !== troughDayOfWeek.name) {
    insights.push(
      `El día de mayor actividad es el ${peakDayOfWeek.name} (índice estacional ${peakDayOfWeek.seasonalityIndex.toFixed(0)}%), mientras que el menor es el ${troughDayOfWeek.name} (${troughDayOfWeek.seasonalityIndex.toFixed(0)}%).`
    );
  }

  if (weekdayVsWeekendRatio > 1.25) {
    insights.push(
      `La actividad se concentra fuertemente en días laborables (+${((weekdayVsWeekendRatio - 1) * 100).toFixed(0)}% vs fines de semana).`
    );
  } else if (weekdayVsWeekendRatio < 0.8) {
    insights.push(
      `Fuerte sesgo de consumo en fines de semana (${(1 / weekdayVsWeekendRatio).toFixed(1)}x respecto a lunes a viernes).`
    );
  }

  if (peakMonth && troughMonth && peakMonth.name !== troughMonth.name) {
    insights.push(
      `A nivel anual, ${peakMonth.name} registra el pico máximo (${peakMonth.share.toFixed(1)}% del año) y ${troughMonth.name} el período más bajo.`
    );
  }

  if (seasonalAmplitude > 50) {
    insights.push(
      `Alta estacionalidad cíclica detectada (amplitud del ${seasonalAmplitude.toFixed(0)}% entre pico y valle anual).`
    );
  } else {
    insights.push('Distribución intra-anual relativamente homogénea y estable.');
  }

  return {
    totalRecords,
    validRecords,
    ignoredRows,
    startDate,
    endDate,
    totalDaysSpan,
    totalVolume,
    globalDailyAverage,
    daysOfWeek,
    monthsOfYear,
    quarters,
    timeline,
    calendarData,
    calendarYears: Array.from(yearsSet).sort(),
    peakDayOfWeek,
    troughDayOfWeek,
    peakMonth,
    troughMonth,
    weekdayVsWeekendRatio,
    seasonalAmplitude,
    insights,
  };
}

function createEmptySeasonality(totalRecords: number, ignoredRows: number): SeasonalitySummary {
  return {
    totalRecords,
    validRecords: 0,
    ignoredRows,
    startDate: null,
    endDate: null,
    totalDaysSpan: 0,
    totalVolume: 0,
    globalDailyAverage: 0,
    daysOfWeek: [],
    monthsOfYear: [],
    quarters: [],
    timeline: [],
    calendarData: [],
    calendarYears: [],
    peakDayOfWeek: null,
    troughDayOfWeek: null,
    peakMonth: null,
    troughMonth: null,
    weekdayVsWeekendRatio: 1,
    seasonalAmplitude: 0,
    insights: ['No hay registros con fecha y métrica válidas para evaluar estacionalidad.'],
  };
}
