import type { ColumnFormat, ColumnSubtype, ColumnType } from './column-types';

/** Normaliza texto quitando acentos, caracteres especiales y espacios. */
function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

function matchesAny(target: string, keywords: readonly string[]): boolean {
  const norm = normalize(target);
  const words = norm.split(/[\s_\-./\\]+/);

  return keywords.some((kw) => {
    const normKw = normalize(kw);
    // Coincidencia exacta completa
    if (norm === normKw) return true;
    // Si la palabra clave contiene espacios o guiones bajos, buscar como subcadena continua
    if (normKw.includes(' ') || normKw.includes('_')) {
      const phrase = normKw.replace(/_/g, ' ');
      const normPhrase = norm.replace(/_/g, ' ');
      if (normPhrase.includes(phrase)) return true;
    }
    // Coincidencia por palabra exacta
    if (words.includes(normKw)) return true;
    return false;
  });
}

function sampleMatchesAny(samples: readonly string[], keywords: readonly string[]): boolean {
  if (!samples || samples.length === 0) return false;
  return samples.some((sample) => {
    if (!sample) return false;
    const norm = normalize(sample);
    return keywords.some((kw) => {
      const normKw = normalize(kw);
      return norm === normKw || norm.startsWith(normKw) || norm.includes(normKw);
    });
  });
}

// ---------------------------------------------------------------------------
// Diccionarios Semánticos Específicos
// ---------------------------------------------------------------------------

const CURRENCY_KEYWORDS = [
  'precio', 'price', 'cost', 'coste', 'costo', 'importe', 'amount',
  'revenue', 'ingreso', 'ingresos', 'monto', 'fee', 'tarifa', 'pvp',
  'saldo', 'balance', 'debito', 'credito', 'clv', 'arpu', 'ventas', 'sales',
  'spend', 'gasto', 'subtotal', 'neto', 'bruto', 'tax', 'impuesto', 'iva',
  'precio_unitario', 'unit_price', 'ticket_medio', 'unit_cost', 'total_ventas',
  'total_ingresos', 'total_amount',
] as const;

const CURRENCY_SYMBOLS = ['$', '€', '£', '¥', 'usd', 'eur', 'mxn', 'cop', 'ars', 'clp', 'pen'] as const;

const PERCENTAGE_KEYWORDS = [
  'pct', 'percent', 'porcentaje', 'ratio', 'tasa', 'rate', 'share',
  'descuento', 'discount', 'margen', 'margin', 'conversion', 'growth',
  'crecimiento', 'share_pct', 'delta_pct', 'probabilidad', 'probability',
  'tasa_rebote', 'bounce_rate', 'roi', 'roas', 'conversion_rate',
] as const;

const DURATION_KEYWORDS = [
  'duracion', 'duration', 'dsi', 'dias', 'days', 'horas', 'hours',
  'segundos', 'seconds', 'minutos', 'minutes', 'latencia', 'latency',
  'tenure', 'antiguedad', 'time_spent', 'tiempo', 'dias_entrega',
  'duracion_segundos', 'tenure_months',
] as const;

const INTEGER_COUNT_KEYWORDS = [
  'cantidad', 'qty', 'quantity', 'unidades', 'units', 'conteo', 'count',
  'piezas', 'items', 'pedidos', 'orders', 'visitas', 'visits', 'votos',
  'votes', 'rank', 'posicion', 'ranking', 'numero_items', 'num_items',
  'stock', 'existencias', 'cantidad_articulos', 'unidades_vendidas',
] as const;

const PERIOD_KEYWORDS = [
  'trimestre', 'quarter', 'periodo', 'period', 'semana', 'week', 'mes',
  'month', 'ano', 'year', 'semestre', 'ciclo', 'trimestre_fiscal', 'mes_ano',
] as const;

const FUNNEL_KEYWORDS = [
  'estado_pedido', 'lead_status', 'journey_step', 'deal_stage',
  'etapa_embudo', 'fase_embudo', 'funnel_stage', 'pipeline_stage',
  'etapa', 'fase', 'stage', 'step', 'funnel', 'pipeline', 'embudo', 'status',
] as const;

const GEO_KEYWORDS = [
  'codigo_postal', 'postal_code', 'zip_code', 'pais_destino', 'pais_origen',
  'pais', 'country', 'nacion', 'region', 'provincia', 'province', 'ciudad',
  'city', 'estado', 'state', 'municipio', 'cp', 'zip', 'postal', 'ubicacion',
  'location', 'zona', 'zone', 'lat', 'lon', 'latitude', 'longitude', 'sucursal',
  'tienda', 'store', 'direccion', 'address', 'sede', 'localidad', 'distrito',
  'comunidad', 'ccaa', 'continente', 'continent',
] as const;

const GEO_SAMPLES = [
  'espana', 'spain', 'mexico', 'colombia', 'argentina', 'chile', 'peru',
  'usa', 'eeuu', 'united states', 'brasil', 'brazil', 'italia', 'italy',
  'alemania', 'germany', 'francia', 'france', 'madrid', 'barcelona', 'cdmx',
  'bogota', 'buenos aires', 'santiago', 'lima',
] as const;

const CUSTOMER_KEYWORDS = [
  'nombre_cliente', 'email_usuario', 'id_cliente', 'id_customer',
  'cliente', 'customer', 'usuario', 'user', 'comprador', 'buyer', 'socio',
  'member', 'suscriptor', 'subscriber', 'paciente', 'alumno', 'contacto',
  'contact', 'email', 'correo', 'lead', 'prospect', 'titular', 'account', 'cuenta',
] as const;

const PRODUCT_KEYWORDS = [
  'categoria_producto', 'marca_vehiculo', 'item_name', 'product_name',
  'producto', 'product', 'item', 'articulo', 'modelo', 'model', 'categoria',
  'category', 'catalogo', 'marca', 'brand', 'linea', 'familia', 'departamento',
  'servicio', 'service', 'concepto',
] as const;

const IDENTIFIER_KEYWORDS = [
  'id', 'uuid', 'codigo', 'code', 'sku', 'ref', 'referencia', 'folio',
  'hash', 'token', 'order_id', 'ticket_id', 'id_pedido',
  'id_transaccion', 'transaction_id', 'cart_id', 'cart', 'cve', 'guid',
  'nif', 'cif', 'dni', 'rut', 'key', 'clave', 'sku_producto', 'order_uuid',
] as const;

export interface InferSubtypeOptions {
  name: string;
  type: ColumnType;
  samples?: readonly string[];
  format?: ColumnFormat;
  distinctCount?: number;
}

/**
 * Deduce el subtipo semántico de una columna a partir de su tipo base, su nombre
 * y el patrón de sus datos de muestra.
 */
export function inferColumnSubtype({
  name,
  type,
  samples = [],
  distinctCount = 0,
}: InferSubtypeOptions): ColumnSubtype {
  switch (type) {
    case 'number': {
      // 1. Moneda / Dinero
      if (
        matchesAny(name, CURRENCY_KEYWORDS) ||
        sampleMatchesAny(samples, CURRENCY_SYMBOLS)
      ) {
        return 'currency';
      }

      // 2. Porcentajes / Ratios
      if (
        matchesAny(name, PERCENTAGE_KEYWORDS) ||
        samples.some((s) => s.includes('%'))
      ) {
        return 'percentage';
      }

      // 3. Duración / Tiempo
      if (matchesAny(name, DURATION_KEYWORDS)) {
        return 'duration';
      }

      // 4. Entero / Conteo
      if (
        matchesAny(name, INTEGER_COUNT_KEYWORDS) ||
        (samples.length > 0 &&
          samples.every((s) => {
            const clean = s.replace(/[,.]0+$/, '').trim();
            const num = Number(clean);
            return !Number.isNaN(num) && Number.isInteger(num);
          }))
      ) {
        return 'integer';
      }

      return 'decimal';
    }

    case 'date': {
      // 1. Fecha y hora (Timestamp)
      const hasTimeInSamples = samples.some(
        (s) => s.includes('T') || s.includes(':') || /\d{2}:\d{2}/.test(s),
      );
      if (
        hasTimeInSamples ||
        matchesAny(name, ['time', 'hora', 'timestamp', 'created_at', 'updated_at'])
      ) {
        return 'datetime';
      }

      // 2. Períodos agregados
      if (matchesAny(name, PERIOD_KEYWORDS)) {
        return 'period';
      }

      return 'date';
    }

    case 'text': {
      // 1. Estados y Embudo (evaluados antes de geografía para evitar colisión con 'estado')
      if (matchesAny(name, FUNNEL_KEYWORDS)) {
        return 'funnel_stage';
      }

      // 2. Geografía (evaluados antes de claves para que 'codigo_postal' sea geo y no id)
      if (matchesAny(name, GEO_KEYWORDS) || sampleMatchesAny(samples, GEO_SAMPLES)) {
        return 'geo';
      }

      // 3. Identificadores / Claves
      if (
        matchesAny(name, IDENTIFIER_KEYWORDS) ||
        (distinctCount >= 5 && matchesAny(name, ['id', 'key', 'code', 'sku', 'folio']))
      ) {
        return 'identifier';
      }

      // 4. Cliente / Persona
      if (matchesAny(name, CUSTOMER_KEYWORDS)) {
        return 'customer';
      }

      // 5. Producto / Inventario
      if (matchesAny(name, PRODUCT_KEYWORDS)) {
        return 'product';
      }

      return 'text';
    }

    case 'boolean':
      return 'boolean';

    case 'empty':
      return 'empty';
  }
}
