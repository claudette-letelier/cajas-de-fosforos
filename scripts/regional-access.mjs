// Auto-split from update-catalog — regional transit (no Santiago Metro)
function decodeHtml(text) {
  return String(text || '')
    .replace(/&#8211;/g, '–')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Conectividad fuera de la RM (sin Metro de Santiago).
 * score 1–5 ≈ qué tan fácil moverse en bus/tren/carretera hacia la ciudad y el resto del país.
 * Estimación por comuna (no es distancia GPS exacta al paradero).
 */
const COMUNA_REGIONAL_ACCESS = {
  // Metrotren Valparaíso
  Valparaíso: {
    kind: 'metrotren',
    label: 'Metrotren · Valparaíso / Puerto',
    detail: 'Red Metrotren + micros locales · terminales Barón / Rodoviario',
    score: 4,
  },
  'Viña del Mar': {
    kind: 'metrotren',
    label: 'Metrotren · Viña del Mar',
    detail: 'Estaciones Metrotren + micros · buen acceso costa',
    score: 5,
  },
  Quilpué: {
    kind: 'metrotren',
    label: 'Metrotren · Quilpué',
    detail: 'Estación Metrotren en la comuna',
    score: 5,
  },
  Quilpue: {
    kind: 'metrotren',
    label: 'Metrotren · Quilpué',
    detail: 'Estación Metrotren en la comuna',
    score: 5,
  },
  'Villa Alemana': {
    kind: 'metrotren',
    label: 'Metrotren · Villa Alemana',
    detail: 'Estación Metrotren en la comuna',
    score: 5,
  },
  Limache: {
    kind: 'metrotren',
    label: 'Metrotren · Limache',
    detail: 'Terminal de la línea Metrotren',
    score: 4,
  },
  Concón: {
    kind: 'buses',
    label: 'Buses costa · cerca Ruta 64 / acceso 5 Norte',
    detail: 'Micros a Viña/Valpo · sin Metrotren en la comuna',
    score: 3,
  },
  Concon: {
    kind: 'buses',
    label: 'Buses costa · cerca Ruta 64 / acceso 5 Norte',
    detail: 'Micros a Viña/Valpo · sin Metrotren en la comuna',
    score: 3,
  },
  Curauma: {
    kind: 'ruta',
    label: 'Buses · Ruta 68 hacia Valparaíso',
    detail: 'Acceso por Ruta 68 · paraderos locales (aprox. comuna)',
    score: 3,
  },
  Placilla: {
    kind: 'ruta',
    label: 'Buses · Placilla de Peñuelas / Ruta 68',
    detail: 'Cerca de Curauma · buses a Valparaíso',
    score: 3,
  },
  Quillota: {
    kind: 'ruta5',
    label: 'Ruta 5 Norte · terminal Quillota',
    detail: 'Buses interurbanos por Ruta 5 · terminal comunal',
    score: 4,
  },
  'La Calera': {
    kind: 'ruta5',
    label: 'Ruta 5 Norte · La Calera',
    detail: 'Corredor Ruta 5 · buses a Valparaíso/Santiago',
    score: 4,
  },
  'San Felipe': {
    kind: 'buses',
    label: 'Terminal San Felipe · acceso Ruta 60',
    detail: 'Buses a Los Andes / Valparaíso / Santiago',
    score: 3,
  },
  'Los Andes': {
    kind: 'buses',
    label: 'Terminal Los Andes · Ruta 57/60',
    detail: 'Buses interurbanos · sin tren de pasajeros cercano',
    score: 3,
  },
  Casablanca: {
    kind: 'ruta',
    label: 'Ruta 68 · buses Casablanca',
    detail: 'Entre Santiago y Valparaíso por Ruta 68',
    score: 3,
  },
  // O'Higgins / Maule / Ñuble — Ruta 5 Sur
  Rancagua: {
    kind: 'ruta5',
    label: 'Ruta 5 Sur · terminal Rancagua',
    detail: 'Corredor 5 Sur + buses urbanos · ~1 h a Santiago',
    score: 4,
  },
  Machalí: {
    kind: 'ruta5',
    label: 'Buses a Rancagua · cerca Ruta 5 Sur',
    detail: 'Micros a Rancagua · acceso 5 Sur por la capital regional',
    score: 3,
  },
  'San Fernando': {
    kind: 'ruta5',
    label: 'Ruta 5 Sur · terminal San Fernando',
    detail: 'Parada frecuente de buses en corredor 5 Sur',
    score: 4,
  },
  Rengo: {
    kind: 'ruta5',
    label: 'Ruta 5 Sur · Rengo',
    detail: 'Comuna sobre el corredor 5 Sur',
    score: 3,
  },
  Requínoa: {
    kind: 'ruta5',
    label: 'Cerca Ruta 5 Sur · Requínoa',
    detail: 'Acceso 5 Sur vía Rancagua / Rengo',
    score: 3,
  },
  Requinoa: {
    kind: 'ruta5',
    label: 'Cerca Ruta 5 Sur · Requínoa',
    detail: 'Acceso 5 Sur vía Rancagua / Rengo',
    score: 3,
  },
  Chimbarongo: {
    kind: 'ruta5',
    label: 'Ruta 5 Sur · Chimbarongo',
    detail: 'Corredor 5 Sur · buses interurbanos',
    score: 3,
  },
  Talca: {
    kind: 'ruta5',
    label: 'Ruta 5 Sur · terminal Talca',
    detail: 'Capital regional · terminal de buses + 5 Sur',
    score: 4,
  },
  Curicó: {
    kind: 'ruta5',
    label: 'Ruta 5 Sur · terminal Curicó',
    detail: 'Corredor 5 Sur · buses a Santiago/sur',
    score: 4,
  },
  Molina: {
    kind: 'ruta5',
    label: 'Cerca Ruta 5 Sur · Molina',
    detail: 'Acceso 5 Sur vía Curicó',
    score: 3,
  },
  Linares: {
    kind: 'ruta5',
    label: 'Ruta 5 Sur · terminal Linares',
    detail: 'Corredor 5 Sur · buses interurbanos',
    score: 3,
  },
  'San Javier': {
    kind: 'ruta5',
    label: 'Cerca Ruta 5 Sur · San Javier',
    detail: 'Acceso 5 Sur / Talca',
    score: 3,
  },
  Constitución: {
    kind: 'buses',
    label: 'Terminal Constitución · costa Maule',
    detail: 'Buses a Talca · lejos del eje 5 Sur',
    score: 2,
  },
  Parral: {
    kind: 'ruta5',
    label: 'Ruta 5 Sur · Parral',
    detail: 'Corredor 5 Sur',
    score: 3,
  },
  Chillán: {
    kind: 'ruta5',
    label: 'Ruta 5 Sur · terminal Chillán',
    detail: 'Capital Ñuble · terminal + 5 Sur',
    score: 4,
  },
  'San Carlos': {
    kind: 'ruta5',
    label: 'Ruta 5 Sur · San Carlos',
    detail: 'Corredor 5 Sur · Ñuble',
    score: 3,
  },
  // Biobío — Biotrén + 5 Sur
  Concepción: {
    kind: 'biotren',
    label: 'Biotrén · Concepción',
    detail: 'Red Biotrén + micros · terminal Collao',
    score: 5,
  },
  Concepcion: {
    kind: 'biotren',
    label: 'Biotrén · Concepción',
    detail: 'Red Biotrén + micros · terminal Collao',
    score: 5,
  },
  Talcahuano: {
    kind: 'biotren',
    label: 'Biotrén · Talcahuano',
    detail: 'Estaciones Biotrén en la comuna',
    score: 4,
  },
  'San Pedro de la Paz': {
    kind: 'biotren',
    label: 'Biotrén · San Pedro de la Paz',
    detail: 'Estaciones Biotrén / acceso Concepción',
    score: 4,
  },
  'San Pedro de La Paz': {
    kind: 'biotren',
    label: 'Biotrén · San Pedro de la Paz',
    detail: 'Estaciones Biotrén / acceso Concepción',
    score: 4,
  },
  Chiguayante: {
    kind: 'biotren',
    label: 'Biotrén · Chiguayante',
    detail: 'Estación Biotrén en la comuna',
    score: 4,
  },
  Hualpén: {
    kind: 'biotren',
    label: 'Biotrén / buses · Hualpén',
    detail: 'Acceso a red Biotrén y Concepción',
    score: 4,
  },
  Penco: {
    kind: 'biotren',
    label: 'Biotrén · Penco',
    detail: 'Estación Biotrén · costa Biobío',
    score: 4,
  },
  Coronel: {
    kind: 'biotren',
    label: 'Biotrén · Coronel',
    detail: 'Estación Biotrén · sur del Gran Concepción',
    score: 3,
  },
  'Los Ángeles': {
    kind: 'ruta5',
    label: 'Ruta 5 Sur · terminal Los Ángeles',
    detail: 'Corredor 5 Sur · capital provincial',
    score: 4,
  },
  'Los Angeles': {
    kind: 'ruta5',
    label: 'Ruta 5 Sur · terminal Los Ángeles',
    detail: 'Corredor 5 Sur · capital provincial',
    score: 4,
  },
  Curanilahue: {
    kind: 'buses',
    label: 'Buses · Curanilahue',
    detail: 'Fuera del eje 5 Sur · buses a Concepción/Lebu',
    score: 2,
  },
  // Araucanía / Lagos / Ríos
  Temuco: {
    kind: 'ruta5',
    label: 'Ruta 5 Sur · terminal Temuco',
    detail: 'Capital regional · terminal Rodoviario + 5 Sur',
    score: 4,
  },
  Villarrica: {
    kind: 'buses',
    label: 'Terminal Villarrica · buses lacustres',
    detail: 'Buses a Temuco · fuera del eje 5 Sur',
    score: 2,
  },
  villarrica: {
    kind: 'buses',
    label: 'Terminal Villarrica · buses lacustres',
    detail: 'Buses a Temuco · fuera del eje 5 Sur',
    score: 2,
  },
  Vilcún: {
    kind: 'buses',
    label: 'Buses · Vilcún / acceso Temuco',
    detail: 'Cercano a Temuco · sin estación férrea de pasajeros',
    score: 2,
  },
  Valdivia: {
    kind: 'buses',
    label: 'Terminal Valdivia · acceso Ruta 5',
    detail: 'Capital regional · buses; tren de pasajeros limitado',
    score: 3,
  },
  Osorno: {
    kind: 'ruta5',
    label: 'Ruta 5 Sur · terminal Osorno',
    detail: 'Corredor 5 Sur · terminal de buses',
    score: 4,
  },
  'Puerto Montt': {
    kind: 'ruta5',
    label: 'Ruta 5 Sur · terminal Puerto Montt',
    detail: 'Fin del 5 Sur continental · terminal + micros',
    score: 4,
  },
  'Puerto Varas': {
    kind: 'buses',
    label: 'Buses · Puerto Varas / acceso Puerto Montt',
    detail: 'Micros y buses · cerca del eje 5 Sur',
    score: 3,
  },
  // Norte — Ruta 5 Norte
  'La Serena': {
    kind: 'ruta5',
    label: 'Ruta 5 Norte · terminal La Serena',
    detail: 'Corredor 5 Norte · terminal Elqui',
    score: 4,
  },
  Coquimbo: {
    kind: 'ruta5',
    label: 'Ruta 5 Norte · Coquimbo',
    detail: 'Conurbación con La Serena · buses y 5 Norte',
    score: 4,
  },
  Ovalle: {
    kind: 'ruta5',
    label: 'Ruta 5 Norte · terminal Ovalle',
    detail: 'Corredor 5 Norte · buses a Serena/Santiago',
    score: 3,
  },
  Copiapó: {
    kind: 'ruta5',
    label: 'Ruta 5 Norte · terminal Copiapó',
    detail: 'Corredor 5 Norte · Atacama',
    score: 3,
  },
  Copiapo: {
    kind: 'ruta5',
    label: 'Ruta 5 Norte · terminal Copiapó',
    detail: 'Corredor 5 Norte · Atacama',
    score: 3,
  },
  Vallenar: {
    kind: 'ruta5',
    label: 'Ruta 5 Norte · Vallenar',
    detail: 'Corredor 5 Norte',
    score: 3,
  },
  Antofagasta: {
    kind: 'buses',
    label: 'Terminal Antofagasta · Ruta 1 / 5 Norte',
    detail: 'Capital regional · terminal de buses',
    score: 3,
  },
  Mejillones: {
    kind: 'buses',
    label: 'Buses · Mejillones / acceso Antofagasta',
    detail: 'Micros y buses costeros',
    score: 2,
  },
  'Alto Hospicio': {
    kind: 'buses',
    label: 'Buses · Alto Hospicio / Iquique',
    detail: 'Conurbación con Iquique · micros locales',
    score: 3,
  },
  Arica: {
    kind: 'buses',
    label: 'Terminal Arica · Ruta 5 Norte',
    detail: 'Capital regional · terminal internacional/nacional',
    score: 3,
  },
  // Extremos
  Coyhaique: {
    kind: 'buses',
    label: 'Terminal Coyhaique',
    detail: 'Sin Ruta 5 continua · buses regionales',
    score: 2,
  },
  'Punta Arenas': {
    kind: 'buses',
    label: 'Terminal Punta Arenas',
    detail: 'Capital Magallanes · buses locales / austral',
    score: 2,
  },
}

function regionalAccessFor(comuna, region) {
  if (region === 'Metropolitana') return null
  const hit =
    COMUNA_REGIONAL_ACCESS[comuna] ||
    COMUNA_REGIONAL_ACCESS[decodeHtml(comuna)]
  if (hit) {
    return {
      accessKind: 'regional',
      accessLabel: hit.label,
      accessDetail: hit.detail,
      accessMode: hit.kind,
      connectivityScore: hit.score,
      metroStation: null,
      metroLine: null,
      metroWalkMin: null,
      metroEstimated: true,
    }
  }
  // Fallback por región
  const regionFallback = {
    Valparaíso: {
      kind: 'buses',
      label: 'Buses regionales · Valparaíso',
      detail: 'Sin ficha de Metrotren/Ruta 5 para esta comuna · estimado regional',
      score: 2,
    },
    "O'Higgins": {
      kind: 'ruta5',
      label: 'Acceso estimado · Ruta 5 Sur',
      detail: 'Comuna sin ficha detallada · corredor típico 5 Sur',
      score: 2,
    },
    Maule: {
      kind: 'ruta5',
      label: 'Acceso estimado · Ruta 5 Sur',
      detail: 'Comuna sin ficha detallada · corredor típico 5 Sur',
      score: 2,
    },
    Ñuble: {
      kind: 'ruta5',
      label: 'Acceso estimado · Ruta 5 Sur',
      detail: 'Comuna sin ficha detallada · corredor típico 5 Sur',
      score: 2,
    },
    Biobío: {
      kind: 'buses',
      label: 'Buses / Biotrén (estimado Biobío)',
      detail: 'Confirma estación Biotrén o terminal en la comuna',
      score: 2,
    },
    'La Araucanía': {
      kind: 'ruta5',
      label: 'Acceso estimado · Ruta 5 Sur',
      detail: 'Comuna sin ficha detallada',
      score: 2,
    },
    'Los Ríos': {
      kind: 'buses',
      label: 'Buses regionales · Los Ríos',
      detail: 'Acceso estimado por buses',
      score: 2,
    },
    'Los Lagos': {
      kind: 'ruta5',
      label: 'Acceso estimado · Ruta 5 Sur',
      detail: 'Comuna sin ficha detallada',
      score: 2,
    },
    Coquimbo: {
      kind: 'ruta5',
      label: 'Acceso estimado · Ruta 5 Norte',
      detail: 'Comuna sin ficha detallada',
      score: 2,
    },
    Atacama: {
      kind: 'ruta5',
      label: 'Acceso estimado · Ruta 5 Norte',
      detail: 'Comuna sin ficha detallada',
      score: 2,
    },
    Antofagasta: {
      kind: 'buses',
      label: 'Buses regionales · Antofagasta',
      detail: 'Comuna sin ficha detallada',
      score: 2,
    },
    Tarapacá: {
      kind: 'buses',
      label: 'Buses regionales · Tarapacá',
      detail: 'Comuna sin ficha detallada',
      score: 2,
    },
    'Arica y Parinacota': {
      kind: 'buses',
      label: 'Buses regionales · Arica',
      detail: 'Comuna sin ficha detallada',
      score: 2,
    },
    Magallanes: {
      kind: 'buses',
      label: 'Buses · Magallanes',
      detail: 'Sin Ruta 5 · transporte local',
      score: 1,
    },
    Aysén: {
      kind: 'buses',
      label: 'Buses · Aysén',
      detail: 'Sin Ruta 5 continua · transporte local',
      score: 1,
    },
  }
  const fb = regionFallback[region]
  if (!fb) {
    return {
      accessKind: 'regional',
      accessLabel: 'Sin Metro de Santiago · acceso por buses (estimado)',
      accessDetail: 'En regiones no usamos ranking de Metro Santiago',
      accessMode: 'buses',
      connectivityScore: 2,
      metroStation: null,
      metroLine: null,
      metroWalkMin: null,
      metroEstimated: true,
    }
  }
  return {
    accessKind: 'regional',
    accessLabel: fb.label,
    accessDetail: fb.detail,
    accessMode: fb.kind,
    connectivityScore: fb.score,
    metroStation: null,
    metroLine: null,
    metroWalkMin: null,
    metroEstimated: true,
  }
}


export { COMUNA_REGIONAL_ACCESS, regionalAccessFor }
