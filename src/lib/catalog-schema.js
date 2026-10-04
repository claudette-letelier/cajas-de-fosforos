/**
 * Schema + integrity checks for scraped catalog rows.
 * Used by unit tests and `npm run validate:catalog`.
 */

const REGIONS = new Set([
  'Metropolitana',
  'Valparaíso',
  "O'Higgins",
  'Maule',
  'Ñuble',
  'Biobío',
  'La Araucanía',
  'Los Ríos',
  'Los Lagos',
  'Aysén',
  'Magallanes',
  'Coquimbo',
  'Atacama',
  'Antofagasta',
  'Tarapacá',
  'Arica y Parinacota',
])

const BIOBIO_COMUNAS = new Set([
  'Concepción',
  'San Pedro de la Paz',
  'Talcahuano',
  'Chiguayante',
  'Hualpén',
  'Penco',
  'Coronel',
  'Tomé',
  'Lota',
  'Los Ángeles',
  'Curanilahue',
])

function isNum(n) {
  return typeof n === 'number' && Number.isFinite(n)
}

function inChile(lat, lng) {
  return lat >= -56 && lat <= -17 && lng >= -76 && lng <= -66
}

/** @returns {{ ok: boolean, errors: string[] }} */
export function validateProject(p, { index } = {}) {
  const errors = []
  const tag = p?.id || p?.name || `idx:${index}`

  if (!p || typeof p !== 'object') {
    return { ok: false, errors: [`${tag}: no es un objeto`] }
  }
  if (!p.id || typeof p.id !== 'string') errors.push(`${tag}: id requerido`)
  if (!p.name || typeof p.name !== 'string') errors.push(`${tag}: name requerido`)
  if (!p.comuna || typeof p.comuna !== 'string')
    errors.push(`${tag}: comuna requerida`)
  if (!p.region || typeof p.region !== 'string')
    errors.push(`${tag}: region requerida`)
  else if (!REGIONS.has(p.region))
    errors.push(`${tag}: region desconocida "${p.region}"`)

  if (!isNum(p.priceFromUf) || p.priceFromUf < 500)
    errors.push(`${tag}: priceFromUf inválido (${p.priceFromUf})`)
  if (p.priceToUf != null && (!isNum(p.priceToUf) || p.priceToUf < p.priceFromUf))
    errors.push(`${tag}: priceToUf inconsistente`)

  if (!isNum(p.bedroomsMin) || !isNum(p.bedroomsMax) || p.bedroomsMin > p.bedroomsMax)
    errors.push(`${tag}: dormitorios inválidos`)

  if (!Array.isArray(p.sources) || !p.sources.length)
    errors.push(`${tag}: sources vacío`)
  else {
    for (const s of p.sources) {
      if (!s?.url || !/^https?:\/\//i.test(s.url))
        errors.push(`${tag}: source.url inválida`)
    }
  }

  if (p.lat != null || p.lng != null) {
    if (!isNum(p.lat) || !isNum(p.lng) || !inChile(p.lat, p.lng))
      errors.push(`${tag}: coords fuera de Chile (${p.lat},${p.lng})`)
  }

  if (p.dataGaps?.locationEstimated === false) {
    if (!isNum(p.lat) || !isNum(p.lng))
      errors.push(`${tag}: locationEstimated=false sin lat/lng`)
  }

  // Biobío comunas must not be labeled Metropolitana
  if (BIOBIO_COMUNAS.has(p.comuna) && p.region === 'Metropolitana') {
    errors.push(`${tag}: ${p.comuna} marcada como Metropolitana`)
  }

  // Outside RM: no Santiago metro station fields
  if (p.region !== 'Metropolitana') {
    if (p.metroStation)
      errors.push(`${tag}: metroStation fuera de RM (${p.metroStation})`)
    if (p.accessKind !== 'regional' && p.accessKind != null)
      errors.push(`${tag}: accessKind debería ser regional`)
  }

  if (
    p.connectivityScore != null &&
    (!isNum(p.connectivityScore) ||
      p.connectivityScore < 1 ||
      p.connectivityScore > 5)
  ) {
    errors.push(`${tag}: connectivityScore fuera de 1–5`)
  }

  if (p.contactWhatsapp) {
    if (!/^https:\/\/wa\.me\//i.test(p.contactWhatsapp))
      errors.push(`${tag}: contactWhatsapp no es wa.me`)
  }

  return { ok: errors.length === 0, errors }
}

/** @returns {{ ok: boolean, errors: string[], stats: object }} */
export function validateCatalog(catalog) {
  const errors = []
  if (!Array.isArray(catalog) || catalog.length < 1) {
    return {
      ok: false,
      errors: ['catálogo vacío'],
      stats: { total: 0 },
    }
  }

  const ids = new Set()
  let exact = 0
  let withAddress = 0
  for (let i = 0; i < catalog.length; i++) {
    const p = catalog[i]
    if (ids.has(p.id)) errors.push(`id duplicado: ${p.id}`)
    ids.add(p.id)
    const r = validateProject(p, { index: i })
    if (!r.ok) errors.push(...r.errors)
    if (p.dataGaps?.locationEstimated === false) exact++
    if (p.address) withAddress++
  }

  return {
    ok: errors.length === 0,
    errors,
    stats: {
      total: catalog.length,
      uniqueIds: ids.size,
      exactLocations: exact,
      withAddress,
    },
  }
}
