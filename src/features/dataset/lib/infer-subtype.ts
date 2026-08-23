import type { ColumnFormat, ColumnSubtype, ColumnType } from './column-types';

/** Normaliza texto quitando acentos, caracteres especiales y espacios. */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

/** Divide un texto en palabras/tokens normalizados. */
export function tokenize(text: string): string[] {
  return normalize(text)
    .split(/[\s_\-./\\,;:()\[\]{}|<>]+/)
    .filter(Boolean);
}

export function matchesAny(target: string, keywords: readonly string[]): boolean {
  const norm = normalize(target);
  const words = tokenize(target);

  return keywords.some((kw) => {
    const normKw = normalize(kw);
    // Coincidencia exacta completa
    if (norm === normKw) return true;
    // Si la palabra clave contiene espacios o guiones bajos, buscar como frase continua
    if (normKw.includes(' ') || normKw.includes('_')) {
      const phrase = normKw.replace(/_/g, ' ');
      const normPhrase = norm.replace(/_/g, ' ');
      if (normPhrase === phrase || normPhrase.includes(phrase)) return true;
    }
    // Coincidencia por palabra exacta (token completo, evitando falsos positivos de subcadenas)
    if (words.includes(normKw)) return true;
    return false;
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
  'estado_civil', 'estado_cuenta', 'estado_pago', 'estado_factura',
  'estado_solicitud', 'estado_transaccion', 'estado_ticket', 'estado_proceso',
  'estado_financiero', 'estado_animo', 'marital_status', 'order_state',
  'payment_state', 'account_state', 'workflow_state', 'task_state',
] as const;

/** Palabras clave explícitas que indican inequívocamente una dimensión geográfica apta para mapa. */
const GEO_EXPLICIT_KEYWORDS = [
  'pais', 'country', 'nacion', 'nation', 'pais_destino', 'pais_origen',
  'pais_cliente', 'pais_facturacion', 'pais_envio', 'billing_country',
  'shipping_country', 'country_name', 'country_code', 'iso_country', 'iso2', 'iso3',
  'region', 'provincia', 'province', 'comunidad_autonoma', 'comunidad', 'ccaa',
  'departamento_geo', 'territorio', 'territory', 'region_geografica', 'geographic_region',
  'ciudad', 'city', 'municipio', 'localidad', 'poblacion_ciudad', 'distrito_municipal',
  'alcaldia', 'poblado', 'codigo_postal', 'postal_code', 'zip_code', 'cod_postal',
  'continente', 'continent', 'estado_provincia', 'state_province', 'us_state',
  'mx_state', 'estado_federativo', 'entidad_federativa', 'zona_geografica',
  'zona_territorial', 'zona_ventas', 'geographic_zone',
] as const;

/**
 * Palabras clave que NO deben clasificarse como geografía de mapa (direcciones callejeras,
 * estados de proceso/cuenta, zonas horarias o administrativas, direcciones IP/email).
 */
const GEO_DISQUALIFY_KEYWORDS = [
  'estado_civil', 'estado_cuenta', 'estado_pago', 'estado_factura', 'estado_solicitud',
  'estado_pedido', 'estado_transaccion', 'estado_ticket', 'estado_proceso',
  'estado_financiero', 'estado_animo', 'estado_actual', 'estado_registro',
  'order_state', 'payment_state', 'marital_status', 'account_state', 'workflow_state',
  'calle', 'avenida', 'street', 'address', 'domicilio', 'direccion_envio',
  'direccion_fiscal', 'shipping_address', 'billing_address', 'address_line',
  'street_address', 'ip_address', 'ip', 'mac_address', 'email_address', 'url_address',
  'web_address', 'direccion_general', 'direccion_obra', 'direccion_medica',
  'direccion_financiera', 'direccion_tecnica', 'direccion_area', 'management',
  'zona_horaria', 'time_zone', 'timezone', 'zona_embarque', 'zona_carga',
  'zona_descarga', 'zona_peligro', 'zona_industrial', 'zona_trabajo', 'zona_segura',
  'buffer_zone', 'cuota_mercado', 'estudio_mercado', 'segmento_mercado',
  'tipo_mercado', 'valor_mercado', 'market_share', 'cuenta_origen', 'cuenta_destino',
  'banco_origen', 'banco_destino', 'almacen_origen', 'almacen_destino', 'usuario_origen',
  'usuario_destino', 'ip_origen', 'ip_destino', 'canal_origen', 'fuente_origen',
  'sistema_origen', 'id_sucursal', 'codigo_tienda', 'tienda_virtual', 'tipo_tienda',
  'id_tienda', 'tipo_sucursal', 'tienda_id',
] as const;

/** Códigos de país ISO de 2 y 3 letras (requieren coincidencia exacta del valor de la muestra). */
const GEO_ISO_CODES = new Set([
  'es', 'esp', 'mx', 'mex', 'us', 'usa', 'co', 'col', 'ar', 'arg',
  'cl', 'chl', 'pe', 'per', 'br', 'bra', 'fr', 'fra', 'de', 'deu',
  'it', 'ita', 'pt', 'prt', 'uk', 'gb', 'gbr', 'ca', 'can', 'nl',
  'nld', 'be', 'bel', 'ch', 'che', 'at', 'aut', 'se', 'swe', 'no',
  'nor', 'dk', 'dnk', 'fi', 'fin', 'ie', 'irl', 'pl', 'pol', 'gr',
  'grc', 'cz', 'cze', 'cn', 'chn', 'jp', 'jpn', 'in', 'ind', 'au',
  'aus', 'nz', 'nzl', 'kr', 'kor', 'sg', 'sgp', 'za', 'zaf', 'ae',
  'are', 'sa', 'sau', 'il', 'isr', 'ma', 'mar', 'ec', 'ecu', 've',
  'ven', 'uy', 'ury', 'py', 'pry', 'bo', 'bol', 'pa', 'pan', 'cr',
  'cri', 'gt', 'gtm', 'hn', 'hnd', 'sv', 'slv', 'ni', 'nic', 'do',
  'dom', 'pr', 'pri', 'cu', 'cub',
]);

/** Entidades territoriales reconocidas (países, regiones, estados y principales ciudades). */
const GEO_ENTITY_NAMES = new Set([
  // Países
  'espana', 'spain', 'mexico', 'colombia', 'argentina', 'chile', 'peru',
  'estados unidos', 'united states', 'brasil', 'brazil', 'italia', 'italy',
  'alemania', 'germany', 'deutschland', 'francia', 'france', 'portugal',
  'reino unido', 'united kingdom', 'canada', 'paises bajos', 'netherlands',
  'holanda', 'belgica', 'belgium', 'suiza', 'switzerland', 'austria',
  'suecia', 'sweden', 'noruega', 'norway', 'dinamarca', 'denmark',
  'finlandia', 'finland', 'irlanda', 'ireland', 'polonia', 'poland',
  'grecia', 'greece', 'republica checa', 'czechia', 'china', 'japon',
  'japan', 'india', 'australia', 'nueva zelanda', 'new zealand',
  'corea del sur', 'south korea', 'singapur', 'singapore', 'sudafrica',
  'south africa', 'emiratos arabes unidos', 'arabia saudita', 'israel',
  'marruecos', 'morocco', 'ecuador', 'venezuela', 'uruguay', 'paraguay',
  'bolivia', 'panama', 'costa rica', 'guatemala', 'honduras', 'el salvador',
  'nicaragua', 'republica dominicana', 'puerto rico', 'cuba',
  // Regiones y ciudades España
  'madrid', 'barcelona', 'comunidad de madrid', 'cataluna', 'catalunya',
  'andalucia', 'sevilla', 'malaga', 'granada', 'cordoba', 'valencia',
  'comunidad valenciana', 'alicante', 'castellon', 'galicia', 'a coruna',
  'pontevedra', 'vigo', 'lugo', 'ourense', 'pais vasco', 'euskadi', 'bilbao',
  'bizkaia', 'gipuzkoa', 'san sebastian', 'alava', 'vitoria', 'castilla y leon',
  'valladolid', 'burgos', 'salamanca', 'leon', 'castilla la mancha',
  'castilla-la mancha', 'toledo', 'albacete', 'canarias', 'las palmas',
  'tenerife', 'santa cruz de tenerife', 'baleares', 'illes balears',
  'islas baleares', 'mallorca', 'palma', 'aragon', 'zaragoza', 'murcia',
  'region de murcia', 'asturias', 'oviedo', 'gijon', 'navarra', 'pamplona',
  'extremadura', 'badajoz', 'caceres', 'cantabria', 'santander', 'la rioja',
  'logrono', 'ceuta', 'melilla',
  // Ciudades y estados LatAm y Norteamérica
  'cdmx', 'ciudad de mexico', 'jalisco', 'guadalajara', 'nuevo leon',
  'monterrey', 'puebla', 'bogota', 'medellin', 'antioquia', 'cali',
  'buenos aires', 'rosario', 'santiago', 'valparaiso', 'lima', 'arequipa',
  'sao paulo', 'rio de janeiro', 'quito', 'guayaquil', 'caracas',
  'montevideo', 'asuncion', 'la paz', 'santa cruz', 'california',
  'texas', 'florida', 'new york', 'nueva york', 'london', 'londres',
  'paris', 'berlin', 'roma', 'rome', 'milan', 'lisboa', 'lisbon',
  'amsterdam', 'tokyo', 'tokio',
]);

const STATUS_SAMPLE_VALUES = new Set([
  'activo', 'inactivo', 'pendiente', 'pagado', 'cancelado', 'soltero',
  'casado', 'divorciado', 'aprobado', 'rechazado', 'completado', 'cerrado',
  'abierto', 'en proceso', 'finalizado', 'borrador', 'draft', 'done',
  'pending', 'paid', 'active', 'inactive', 'approved', 'rejected',
  'open', 'closed', 'new', 'in progress', 'success', 'failed', 'error',
  'true', 'false', 'si', 'no', 'soltera', 'casada', 'viudo', 'viuda',
]);

/** Comprueba si las muestras de datos corresponden a entidades territoriales reales. */
export function sampleMatchesGeoEntities(samples: readonly string[]): boolean {
  if (!samples || samples.length === 0) return false;

  let geoMatchCount = 0;

  for (const sample of samples) {
    if (!sample) continue;
    const norm = normalize(sample);
    if (!norm) continue;

    // Descalificar si parece email, URL, IP o número de tarjeta/ID
    if (
      norm.includes('@') ||
      norm.includes('http') ||
      norm.includes('www.') ||
      /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(norm)
    ) {
      return false;
    }

    // Descalificar si es un valor de estado común
    if (STATUS_SAMPLE_VALUES.has(norm)) {
      return false;
    }

    // 1. Coincidencia exacta con código ISO de país (ej. "ES", "MX", "US")
    if (GEO_ISO_CODES.has(norm)) {
      geoMatchCount++;
      continue;
    }

    // 2. Coincidencia exacta con nombre de entidad territorial (ej. "España", "Madrid", "Jalisco", "Estados Unidos")
    if (GEO_ENTITY_NAMES.has(norm)) {
      geoMatchCount++;
      continue;
    }

    // 3. Coincidencia de pares territoriales limpios (ej. "Madrid, España", "Santiago, Chile", "Monterrey (MX)")
    const tokens = tokenize(sample);
    if (tokens.length >= 2 && tokens.length <= 3) {
      const allTokensAreGeo = tokens.every(
        (t) => GEO_ENTITY_NAMES.has(t) || GEO_ISO_CODES.has(t) || t === 'de' || t === 'y' || t === 'la' || t === 'el',
      );
      const hasRealGeoToken = tokens.some((t) => GEO_ENTITY_NAMES.has(t) || GEO_ISO_CODES.has(t));
      if (allTokensAreGeo && hasRealGeoToken) {
        geoMatchCount++;
        continue;
      }
    }

    // 4. Formato de código postal (ej. "28001", "08001", "90210")
    if (/^\d{5}$/.test(norm)) {
      geoMatchCount++;
      continue;
    }
  }

  return geoMatchCount > 0;
}

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
  'ip', 'ip_address', 'mac_address',
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
        samples.some((s) => CURRENCY_SYMBOLS.some((sym) => s.toLowerCase().includes(sym)))
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
      // 1. Comprobar explícitamente si el campo está descalificado para geografía (ej. estado civil, dirección callejera, IP)
      const isDisqualifiedFromGeo = matchesAny(name, GEO_DISQUALIFY_KEYWORDS);

      // 2. Estados y Embudo (evaluados antes para evitar que 'estado_pedido' o 'estado_civil' se confundan con geografía)
      if (matchesAny(name, FUNNEL_KEYWORDS)) {
        // Solo clasificar como geo si no está descalificado y además las muestras son explícitamente geográficas
        if (!isDisqualifiedFromGeo && sampleMatchesGeoEntities(samples)) {
          return 'geo';
        }
        return 'funnel_stage';
      }

      // 3. Geografía inteligente (columnas territoriales aptas para mapa)
      if (!isDisqualifiedFromGeo) {
        if (matchesAny(name, GEO_EXPLICIT_KEYWORDS)) {
          return 'geo';
        }
        // Columnas con nombres ambiguos (ej. 'ubicacion', 'sede', 'lugar', 'destino') verificadas con muestras
        if (matchesAny(name, ['ubicacion', 'location', 'sede', 'lugar', 'zona', 'zone', 'destino', 'origen'])) {
          if (sampleMatchesGeoEntities(samples)) {
            return 'geo';
          }
        } else if (sampleMatchesGeoEntities(samples)) {
          return 'geo';
        }
      }

      // 4. Identificadores / Claves
      if (
        matchesAny(name, IDENTIFIER_KEYWORDS) ||
        (distinctCount >= 5 && matchesAny(name, ['id', 'key', 'code', 'sku', 'folio']))
      ) {
        return 'identifier';
      }

      // 5. Cliente / Persona
      if (matchesAny(name, CUSTOMER_KEYWORDS)) {
        return 'customer';
      }

      // 6. Producto / Inventario
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

