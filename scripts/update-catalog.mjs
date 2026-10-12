#!/usr/bin/env node
/**
 * Actualiza el catálogo Cajas de Fósforos desde el máximo de fuentes públicas scrapeables.
 *
 * Fuentes:
 * - mindicador.cl (UF)
 * - Subsidios.cl
 * - UsaTuSubsidio.cl
 * - Enlace Inmobiliarios BCI
 * - Los Silos
 * - Ingevec
 * - Ciclos / Gran Avenida
 * - Euro Inmobiliaria
 * - Ecomac (API)
 * - Socovesa
 * - Paz (API)
 * - Aitue
 * - Bricsa
 * - Galilea
 * - Santolaya
 * - Fundamenta
 * - Deisa
 * - PY
 * - Besalco Inmobiliaria
 *
 * Uso: node scripts/update-catalog.mjs
 */
import { writeFileSync, existsSync, readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import path from 'node:path'
import { regionalAccessFor } from './regional-access.mjs'
import {
  extractAddress,
  extractCoords,
  sanitizeAddress,
} from './lib/html-location.mjs'
import { haversineKm, lookupStreetPin, streetPinIsExact } from './lib/street-pin.mjs'
import {
  extractTipoSubsidio,
  inferHousingSubsidies,
  mergeSubsidies,
  parseSubsidyHint,
  uniqueSubsidies,
} from './lib/subsidies.mjs'

const ROOT = path.resolve(import.meta.dirname, '..')
const CATALOG_PATH = path.join(ROOT, 'src/data/catalog.js')
const META_PATH = path.join(ROOT, 'src/data/update-meta.json')
const COMUNA_COORDS_PATH = path.join(ROOT, 'src/data/comuna-coords.json')
const LOCALITY_COORDS_PATH = path.join(ROOT, 'src/data/locality-coords.json')
const STREET_COORDS_PATH = path.join(ROOT, 'src/data/street-coords.json')
let COMUNA_COORDS = null
let LOCALITY_COORDS = null
let STREET_COORDS = null
function loadComunaCoords() {
  if (COMUNA_COORDS) return COMUNA_COORDS
  if (!existsSync(COMUNA_COORDS_PATH)) {
    COMUNA_COORDS = {}
    return COMUNA_COORDS
  }
  try {
    COMUNA_COORDS = JSON.parse(readFileSync(COMUNA_COORDS_PATH, 'utf8'))
  } catch {
    COMUNA_COORDS = {}
  }
  return COMUNA_COORDS
}
function loadLocalityCoords() {
  if (LOCALITY_COORDS) return LOCALITY_COORDS
  if (!existsSync(LOCALITY_COORDS_PATH)) {
    LOCALITY_COORDS = {}
    return LOCALITY_COORDS
  }
  try {
    LOCALITY_COORDS = JSON.parse(readFileSync(LOCALITY_COORDS_PATH, 'utf8'))
  } catch {
    LOCALITY_COORDS = {}
  }
  return LOCALITY_COORDS
}
function loadStreetCoords() {
  if (STREET_COORDS) return STREET_COORDS
  if (!existsSync(STREET_COORDS_PATH)) {
    STREET_COORDS = {}
    return STREET_COORDS
  }
  try {
    STREET_COORDS = JSON.parse(readFileSync(STREET_COORDS_PATH, 'utf8'))
  } catch {
    STREET_COORDS = {}
  }
  return STREET_COORDS
}

/** Known sectors/barrios more precise than the official comuna field. */
const LOCALITY_HINTS = [
  { re: /\bcurauma\b/i, key: 'curauma' },
  { re: /\bplacilla\s+de\s+pe[ñn]uelas\b/i, key: 'placilla-de-penuelas' },
  { re: /\bre[ñn]aca\s+alto\b/i, key: 'renaca-alto' },
  { re: /\bre[ñn]aca\b/i, key: 'renaca' },
  { re: /\bconc[oó]n\b/i, key: 'concon' },
  { re: /\bpe[ñn]ablanca\b/i, key: 'penablanca' },
  { re: /\bpiedra\s+roja\b/i, key: 'piedra-roja' },
  { re: /\bchicureo\b/i, key: 'chicureo' },
  { re: /\bla\s+dehesa\b/i, key: 'la-dehesa' },
  { re: /\bandalu[eé]\b/i, key: 'andalue' },
  { re: /\bbosquemar\b/i, key: 'bosquemar' },
  { re: /\blomas?\s+de\s+landa\b|\blanda\b.*penco|camino\s+a\s+penco|ruta\s*150\b/i, key: 'lomas-de-landa' },
  { re: /\bla\s+estrella\s*8540\b|\bestrella\s*8540\b/i, key: 'la-estrella-pudahuel' },
  { re: /\bsan\s+pedro\s+de\s+la\s+paz\b/i, key: 'san-pedro-de-la-paz' },
  { re: /\balto\s+hospicio\b/i, key: 'alto-hospicio' },
  { re: /\bserena\s+oriente\b/i, key: 'serena-oriente' },
  { re: /\bgran\s+avenida\b/i, key: 'gran-avenida' },
  { re: /\bpuerto\s+varas\b/i, key: 'puerto-varas' },
  { re: /\blos\s+andes\b/i, key: 'los-andes' },
  { re: /\bmachal[ií]\b/i, key: 'machali' },
  { re: /\blimache\b/i, key: 'limache' },
  { re: /\bquilpu[eé]\b/i, key: 'quilpue' },
  { re: /\bvilla\s+alemana\b/i, key: 'villa-alemana' },
  { re: /\bsan\s+felipe\b/i, key: 'san-felipe' },
  { re: /\bpuerto\s+montt\b/i, key: 'puerto-montt' },
  { re: /\bpe[ñn]uelas\b/i, key: 'penuelas-coquimbo', region: 'Coquimbo' },
  // Placilla alone (as sector/comuna label) → Peñuelas, not Cerro Yungay
  { re: /\bplacilla\b/i, key: 'placilla' },
]

/** Comuna labels that Nominatim often resolves to the wrong place. */
const COMUNA_QUERY_OVERRIDES = {
  'Placilla|Valparaíso': 'placilla',
  Placilla: 'placilla',
}

/**
 * Pick the most specific locality mentioned in name/description/notes/address/comuna.
 * Longer / earlier hints in LOCALITY_HINTS win (curauma before placilla).
 */
function extractLocalityKey(item) {
  const blob = [
    item.description,
    item.notes,
    item.address,
    item.name,
    item.comuna,
  ]
    .filter(Boolean)
    .join('\n')
  for (const hint of LOCALITY_HINTS) {
    if (hint.re.test(blob) && (!hint.region || hint.region === item.region))
      return hint.key
  }
  const override =
    COMUNA_QUERY_OVERRIDES[`${item.comuna}|${item.region}`] ||
    COMUNA_QUERY_OVERRIDES[item.comuna]
  return override || null
}

const UA =
  'CajasDeFosforosBot/1.4 (+https://github.com/claudette-letelier/cajas-de-fosforos; daily multi-source refresh)'

const COMUNA_REGION = {
  Santiago: 'Metropolitana',
  'Santiago Centro': 'Metropolitana',
  'San Joaquín': 'Metropolitana',
  'San Bernardo': 'Metropolitana',
  Pudahuel: 'Metropolitana',
  Cerrillos: 'Metropolitana',
  Maipú: 'Metropolitana',
  'Puente Alto': 'Metropolitana',
  Renca: 'Metropolitana',
  'La Pintana': 'Metropolitana',
  'La Granja': 'Metropolitana',
  Quilicura: 'Metropolitana',
  Colina: 'Metropolitana',
  Huechuraba: 'Metropolitana',
  Conchalí: 'Metropolitana',
  'El Bosque': 'Metropolitana',
  'San Miguel': 'Metropolitana',
  'Pedro Aguirre Cerda': 'Metropolitana',
  Peñaflor: 'Metropolitana',
  Buin: 'Metropolitana',
  Lampa: 'Metropolitana',
  'Padre Hurtado': 'Metropolitana',
  Independencia: 'Metropolitana',
  Recoleta: 'Metropolitana',
  Ñuñoa: 'Metropolitana',
  Providencia: 'Metropolitana',
  'Estación Central': 'Metropolitana',
  'La Florida': 'Metropolitana',
  Macul: 'Metropolitana',
  'Lo Barnechea': 'Metropolitana',
  'Las Condes': 'Metropolitana',
  'Quinta Normal': 'Metropolitana',
  Vitacura: 'Metropolitana',
  'Lo Prado': 'Metropolitana',
  'Cerro Navia': 'Metropolitana',
  'La Reina': 'Metropolitana',
  'La Cisterna': 'Metropolitana',
  'Chicureo - Piedra Roja': 'Metropolitana',
  Chicureo: 'Metropolitana',
  Rancagua: "O'Higgins",
  Machalí: "O'Higgins",
  'San Felipe': 'Valparaíso',
  Casablanca: 'Valparaíso',
  'Viña del Mar': 'Valparaíso',
  Valparaíso: 'Valparaíso',
  Quilpué: 'Valparaíso',
  Limache: 'Valparaíso',
  Coquimbo: 'Coquimbo',
  'La Serena': 'Coquimbo',
  Ovalle: 'Coquimbo',
  'Puerto Montt': 'Los Lagos',
  Osorno: 'Los Lagos',
  Constitución: 'Maule',
  Talca: 'Maule',
  Chillán: 'Ñuble',
  Concepción: 'Biobío',
  Chiguayante: 'Biobío',
  Talcahuano: 'Biobío',
  'San Pedro de la Paz': 'Biobío',
  'San Pedro de La Paz': 'Biobío',
  Hualpén: 'Biobío',
  Hualpen: 'Biobío',
  Penco: 'Biobío',
  Coronel: 'Biobío',
  Tomé: 'Biobío',
  Lota: 'Biobío',
  'Los Ángeles': 'Biobío',
  'Los Angeles': 'Biobío',
  Curanilahue: 'Biobío',
  Temuco: 'La Araucanía',
  Villarrica: 'La Araucanía',
  Valdivia: 'Los Ríos',
  Osorno: 'Los Lagos',
  'Puerto Varas': 'Los Lagos',
  Rengo: "O'Higgins",
  'San Fernando': "O'Higgins",
  Curicó: 'Maule',
  Linares: 'Maule',
  Parral: 'Maule',
  'San Carlos': 'Ñuble',
  Quillota: 'Valparaíso',
  'La Calera': 'Valparaíso',
  Concón: 'Valparaíso',
  Concon: 'Valparaíso',
  'Villa Alemana': 'Valparaíso',
  Copiapó: 'Atacama',
  'Bahía Inglesa': 'Atacama',
  Caldera: 'Atacama',
  Melipilla: 'Metropolitana',
  Antofagasta: 'Antofagasta',
  Iquique: 'Tarapacá',
  'Alto Hospicio': 'Tarapacá',
  Coyhaique: 'Aysén',
  'Punta Arenas': 'Magallanes',
  Arica: 'Arica y Parinacota',
}

const REGION_ALIASES = {
  "O&#039;Higgins": "O'Higgins",
  "O&#39;Higgins": "O'Higgins",
  'O&amp;#039;Higgins': "O'Higgins",
  'Bio Bío': 'Biobío',
  'Bío Bío': 'Biobío',
  Biobio: 'Biobío',
  Araucanía: 'La Araucanía',
  Arica: 'Arica y Parinacota',
}

const COMUNA_METRO = {
  'San Joaquín': { station: 'San Joaquín', line: 'L5', walk: 12, score: 4 },
  Cerrillos: { station: 'Cerrillos', line: 'L6', walk: 18, score: 4 },
  Maipú: { station: 'Plaza de Maipú', line: 'L5', walk: 14, score: 4 },
  'San Miguel': { station: 'San Miguel', line: 'L2', walk: 10, score: 5 },
  Santiago: { station: 'Universidad de Chile', line: 'L1', walk: 10, score: 5 },
  'Santiago Centro': { station: 'Universidad de Chile', line: 'L1', walk: 10, score: 5 },
  Quilicura: { station: 'Quilicura', line: 'L3', walk: 18, score: 3 },
  Pudahuel: { station: 'Barrancas / Laguna Sur', line: 'L5', walk: 12, score: 4 },
  Renca: { station: 'Lo Prado', line: 'L5', walk: 22, score: 3 },
  'Puente Alto': { station: 'Las Mercedes', line: 'L4', walk: 18, score: 3 },
  'La Pintana': { station: 'Santa Rosa', line: 'L4', walk: 25, score: 2 },
  'La Granja': { station: 'Santa Rosa', line: 'L4', walk: 20, score: 3 },
  'El Bosque': { station: 'El Bosque', line: 'L2', walk: 10, score: 4 },
  Conchalí: { station: 'Vivaceta', line: 'L2', walk: 14, score: 4 },
  Huechuraba: { station: 'Vespucio Norte', line: 'L2', walk: 20, score: 3 },
  Independencia: { station: 'Hospitales', line: 'L3', walk: 12, score: 4 },
  Recoleta: { station: 'Cerro Blanco', line: 'L2', walk: 12, score: 4 },
  Ñuñoa: { station: 'Ñuñoa', line: 'L3/L6', walk: 10, score: 5 },
  Providencia: { station: 'Los Leones', line: 'L1/L6', walk: 8, score: 5 },
  'Estación Central': { station: 'Estación Central', line: 'L1', walk: 8, score: 5 },
  'La Florida': { station: 'Rojas Magallanes', line: 'L4', walk: 12, score: 4 },
  Macul: { station: 'Macul', line: 'L4', walk: 10, score: 4 },
  'Quinta Normal': { station: 'Quinta Normal', line: 'L5', walk: 10, score: 5 },
  'La Cisterna': { station: 'La Cisterna', line: 'L2/L4A', walk: 10, score: 5 },
  'San Bernardo': { station: null, line: null, walk: null, score: 2 },
  Colina: { station: null, line: null, walk: null, score: 1 },
  Buin: { station: null, line: null, walk: null, score: 1 },
  Peñaflor: { station: null, line: null, walk: null, score: 1 },
  Lampa: { station: null, line: null, walk: null, score: 1 },
  'Padre Hurtado': { station: null, line: null, walk: null, score: 1 },
}

const stats = { sources: {} }

/** Portales de la propia inmobiliaria. Si el scrape sale bien y el proyecto ya no está, queda agotado. */
const EXCLUSIVE_PORTALS = new Set([
  'ecomac',
  'ingevec',
  'aitue',
  'ciclos',
  'galilea',
  'los-silos',
  'socovesa',
  'bricsa',
  'euro',
  'paz',
  'santolaya',
  'fundamenta',
  'deisa',
  'py',
  'besalco',
])

function soldListing(text) {
  return /sin\s+stock|agotad|vendid[oa]s?|sin\s+disponibilidad|no\s+disponible|100\s*%\s*vendid/i.test(
    String(text || ''),
  )
}

function slugify(text) {
  return String(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function titleCaseComuna(slug) {
  const map = {
    'san-joaquin': 'San Joaquín',
    'san-bernardo': 'San Bernardo',
    'la-pintana': 'La Pintana',
    'la-granja': 'La Granja',
    'el-bosque': 'El Bosque',
    'padre-hurtado': 'Padre Hurtado',
    'pedro-aguirre-cerda': 'Pedro Aguirre Cerda',
    'puente-alto': 'Puente Alto',
    'san-miguel': 'San Miguel',
    'estacion-central': 'Estación Central',
    'la-florida': 'La Florida',
    'quinta-normal': 'Quinta Normal',
    'santiago-centro': 'Santiago',
    nunoa: 'Ñuñoa',
    penaflor: 'Peñaflor',
    conchali: 'Conchalí',
    'los-angeles': 'Los Ángeles',
    'san-pedro-de-la-paz': 'San Pedro de la Paz',
    'la-serena': 'La Serena',
    'puerto-montt': 'Puerto Montt',
    'punta-arenas': 'Punta Arenas',
  }
  if (map[slug]) return map[slug]
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

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

function parseDorms(text) {
  const nums = [...String(text || '').matchAll(/(\d+)/g)].map((m) => Number(m[1]))
  if (!nums.length) return { min: 1, max: 2 }
  return { min: Math.min(...nums), max: Math.max(...nums) }
}

/** Chilean UF: 1.900 → 1900; 5.968,84 → 5968.84; 3184 → 3184 */
function parseChileUf(raw) {
  const s = String(raw).trim()
  if (!s) return 0
  if (/^\d{1,3}(\.\d{3})+,\d+$/.test(s)) {
    return Math.round(Number(s.replace(/\./g, '').replace(',', '.')))
  }
  if (/^\d+,\d+$/.test(s)) return Math.round(Number(s.replace(',', '.')))
  const dotted = s.replace(/,/g, '.')
  if (/^\d{1,3}(\.\d{3})+$/.test(dotted)) return Number(dotted.replace(/\./g, ''))
  if (/^\d+$/.test(dotted)) return Number(dotted)
  if (/^\d+\.\d+$/.test(dotted) && Number(dotted) < 500) {
    // unlikely UF with decimals under 500 as whole price; treat as thousands if 1-3 digits before dot? skip
  }
  const n = Number(dotted.replace(/\./g, ''))
  return Number.isFinite(n) ? n : 0
}

function extractJsonArray(html, startNeedle) {
  const idx = html.indexOf(startNeedle)
  if (idx < 0) return null
  let depth = 0
  let inStr = false
  let esc = false
  let end = -1
  for (let j = idx; j < html.length; j++) {
    const ch = html[j]
    if (inStr) {
      if (esc) esc = false
      else if (ch === '\\') esc = true
      else if (ch === '"') inStr = false
      continue
    }
    if (ch === '"') inStr = true
    else if (ch === '[') depth++
    else if (ch === ']') {
      depth--
      if (depth === 0) {
        end = j + 1
        break
      }
    }
  }
  if (end < 0) return null
  try {
    return JSON.parse(html.slice(idx, end))
  } catch {
    return null
  }
}

async function fetchText(url, accept = 'text/html,application/xhtml+xml,application/json') {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: accept },
    redirect: 'follow',
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  return res.text()
}

async function fetchJson(url) {
  const raw = await fetchText(url, 'application/json')
  return JSON.parse(raw)
}

async function safeSource(name, fn) {
  try {
    const items = await fn()
    stats.sources[name] = { ok: true, count: items.length }
    console.log(`[${name}] +${items.length}`)
    return items
  } catch (err) {
    stats.sources[name] = { ok: false, error: err.message, count: 0 }
    console.warn(`[${name}] FAIL:`, err.message)
    return []
  }
}

/** Last published UF, used when mindicador.cl is down. */
function readPreviousUf() {
  if (existsSync(META_PATH)) {
    try {
      const n = Number(JSON.parse(readFileSync(META_PATH, 'utf8')).ufClp)
      if (Number.isFinite(n) && n >= 1000) return Math.round(n)
    } catch {
      /* ignore a broken meta file */
    }
  }
  if (existsSync(CATALOG_PATH)) {
    const match = readFileSync(CATALOG_PATH, 'utf8').match(
      /export const UF_CLP = (\d+)/,
    )
    if (match) return Number(match[1])
  }
  return null
}

/**
 * UF is only a display conversion. A 502 from mindicador.cl must not abort
 * the catalog refresh; the previous value stays until the API answers again.
 */
async function fetchUf() {
  try {
    const data = await fetchJson('https://mindicador.cl/api/uf')
    const value = Number(data?.serie?.[0]?.valor)
    if (!Number.isFinite(value) || value < 1000) {
      throw new Error('UF value missing')
    }
    return { ufClp: Math.round(value), ok: true }
  } catch (err) {
    const previous = readPreviousUf()
    if (!previous) throw err
    console.warn(
      `mindicador.cl no respondió (${err.message}). Se mantiene la UF anterior: ${previous}`,
    )
    return { ufClp: previous, ok: false, error: err.message }
  }
}

function normalizeRegion(raw) {
  const decoded = decodeHtml(raw || '')
  return REGION_ALIASES[decoded] || REGION_ALIASES[raw] || decoded
}

function normalizeItem(partial) {
  let comuna = decodeHtml(partial.comuna || 'Chile')
  if (comuna === 'Santiago Centro') comuna = 'Santiago'
  if (/^san pedro de la paz$/i.test(comuna)) comuna = 'San Pedro de la Paz'
  if (/^hualpen$/i.test(comuna)) comuna = 'Hualpén'
  if (/^los angeles$/i.test(comuna)) comuna = 'Los Ángeles'
  if (/^concon$/i.test(comuna)) comuna = 'Concón'
  const region = normalizeRegion(
    partial.region ||
      COMUNA_REGION[comuna] ||
      COMUNA_REGION[partial.comuna] ||
      (partial.regionHint ? partial.regionHint : 'Metropolitana'),
  )

  const regional = regionalAccessFor(comuna, region)
  const metroDefault =
    region === 'Metropolitana'
      ? COMUNA_METRO[comuna] || {
          station: null,
          line: null,
          walk: null,
          score: 2,
        }
      : { station: null, line: null, walk: null, score: null }

  // Outside RM: never keep Santiago metro fields from bad text matches
  const useMetro =
    region === 'Metropolitana' &&
    (partial.metroVerified || partial.accessKind === 'metro')

  const bedroomsMin = partial.bedroomsMin ?? 1
  const bedroomsMax = partial.bedroomsMax ?? Math.max(bedroomsMin, 2)
  const price = partial.priceFromUf || 0

  const metroStation =
    region === 'Metropolitana'
      ? (useMetro ? partial.metroStation : null) ?? metroDefault.station
      : null
  const metroLine =
    region === 'Metropolitana'
      ? (useMetro ? partial.metroLine : null) ?? metroDefault.line
      : null
  const metroWalkMin =
    region === 'Metropolitana'
      ? (useMetro ? partial.metroWalkMin : null) ?? metroDefault.walk
      : null
  const connectivityScore =
    region === 'Metropolitana'
      ? partial.connectivityScore ?? metroDefault.score
      : regional?.connectivityScore ?? partial.connectivityScore ?? 2

  return {
    id: partial.id || `${partial.portal}-${slugify(partial.name)}`,
    name: partial.name,
    developer: partial.developer || 'Consultar portal',
    region,
    comuna,
    propertyType: partial.propertyType || 'departamento',
    condition: partial.condition || 'nuevo',
    // Never invent DS19: missing evidence defaults to Sin subsidio.
    subsidies: partial.subsidies?.length ? partial.subsidies : ['Sin subsidio'],
    priceFromUf: price,
    priceToUf: partial.priceToUf || price,
    bedroomsMin,
    bedroomsMax,
    bathroomsMin: partial.bathroomsMin ?? 1,
    bathroomsMax: partial.bathroomsMax ?? (bedroomsMax >= 3 ? 2 : 1),
    parking: partial.parking || 'consultar',
    delivery: partial.delivery || 'consultar',
    areaM2: partial.areaM2 ?? null,
    metroStation,
    metroLine,
    metroWalkMin,
    connectivityScore,
    accessKind:
      region === 'Metropolitana'
        ? 'metro'
        : regional?.accessKind || partial.accessKind || 'regional',
    accessLabel:
      region === 'Metropolitana'
        ? null
        : regional?.accessLabel ||
          partial.accessLabel ||
          'Sin Metro de Santiago · acceso por buses (estimado)',
    accessDetail:
      region === 'Metropolitana'
        ? null
        : regional?.accessDetail || partial.accessDetail || null,
    accessMode:
      region === 'Metropolitana'
        ? 'metro'
        : regional?.accessMode || partial.accessMode || 'buses',
    lat: partial.lat ?? null,
    lng: partial.lng ?? null,
    address: sanitizeAddress(partial.address),
    contactPhone: partial.contactPhone || null,
    contactWhatsapp: partial.contactWhatsapp || null,
    imageUrl: partial.imageUrl || null,
    images: Array.isArray(partial.images)
      ? [...new Set(partial.images.filter(Boolean))].slice(0, 8)
      : partial.imageUrl
        ? [partial.imageUrl]
        : [],
    description: cleanDescription(partial.description),
    availability:
      partial.availability === 'agotado' ||
      soldListing(
        [partial.delivery, partial.availabilityNote, partial.name].filter(Boolean).join(' '),
      )
        ? 'agotado'
        : 'disponible',
    amenities: Array.isArray(partial.amenities)
      ? [...new Set(partial.amenities.filter(Boolean))].slice(0, 12)
      : [],
    sources: partial.sources || [{ portal: partial.portal, url: partial.url }],
    notes: partial.notes || `Importado desde ${partial.portal}`,
    dataGaps: {
      parkingUnknown: (partial.parking || 'consultar') === 'consultar',
      deliveryUnknown: (partial.delivery || 'consultar') === 'consultar',
      metroEstimated:
        region === 'Metropolitana'
          ? partial.metroVerified
            ? false
            : true
          : true,
      priceIsDesde: true,
      ...(partial.dataGaps || {}),
      // Force regional honesty flags after spread
      ...(region !== 'Metropolitana'
        ? { metroEstimated: true }
        : {}),
    },
  }
}

/** Normalize Chilean mobile to digits for wa.me (569XXXXXXXX) */
function normalizeChileMobile(raw) {
  const digits = String(raw || '').replace(/\D/g, '')
  if (!digits) return null
  let n = digits
  if (n.startsWith('56') && n.length >= 11) n = n.slice(0, 11)
  else if (n.startsWith('9') && n.length === 9) n = `56${n}`
  else if (n.length === 8) n = `569${n}`
  // Chilean mobile: 569 + 8 digits
  if (!/^569\d{8}$/.test(n)) return null
  // Filter obvious placeholders
  if (/^5690{8}$/.test(n) || n === '56912345678' || n === '56999999999') return null
  return n
}

function extractContacts(html) {
  const phones = new Set()
  // Explicit WhatsApp / wa.me links
  for (const m of html.matchAll(
    /(?:wa\.me\/|whatsapp\.com\/send\/?\?phone=)(\d{8,15})/gi,
  )) {
    const n = normalizeChileMobile(m[1])
    if (n) phones.add(n)
  }
  // "Teléfono:" blocks on BCI-like pages
  for (const m of html.matchAll(
    /Tel(?:&eacute;|é)fono:\s*<\/p>\s*<p[^>]*>\s*([^<]+)/gi,
  )) {
    for (const p of m[1].matchAll(/\+?56[\s\-]?9[\s\-]?\d{4}[\s\-]?\d{4}|\b9[\s\-]?\d{4}[\s\-]?\d{4}\b/g)) {
      const n = normalizeChileMobile(p[0])
      if (n) phones.add(n)
    }
  }
  // Generic +56 9 patterns near contact words
  const contactWin = html.match(
    /(?:whatsapp|celular|ejecutivo|vendedor|cotiza|contacto)[\s\S]{0,400}?(\+?56[\s\-]?9[\s\-]?\d{4}[\s\-]?\d{4})/i,
  )
  if (contactWin) {
    const n = normalizeChileMobile(contactWin[1])
    if (n) phones.add(n)
  }

  const list = [...phones]
  if (!list.length) return { contactPhone: null, contactWhatsapp: null }
  const primary = list[0]
  return {
    contactPhone: `+${primary}`,
    contactWhatsapp: `https://wa.me/${primary}`,
  }
}

function inferParking(text) {
  const t = String(text || '').toLowerCase()
  if (!t) return 'consultar'
  if (
    /sin estacionamiento|no (incluye|cuenta con) estacionamiento|estacionamiento\s*:\s*no/.test(
      t,
    )
  ) {
    return 'no'
  }
  if (
    /estacionamientos?\s+(en\s+)?(superficie|subterr|incluid|disponib)|con estacionamiento|incluye estacionamiento|estacionamiento para|\d+\s*estacionamientos?\b/.test(
      t,
    )
  ) {
    return 'si'
  }
  return 'consultar'
}

function inferMetroFromText(text) {
  const t = String(text || '')
  if (!t) return null
  const stations = [
    ['Laguna Sur', 'L5'],
    ['Barrancas', 'L5'],
    ['San Pablo', 'L1'],
    ['Plaza de Maipú', 'L5'],
    ['Las Mercedes', 'L4'],
    ['Santa Rosa', 'L4A'],
    ['Lo Prado', 'L5'],
    ['Estación Central', 'L1'],
    ['San Miguel', 'L2'],
    ['Cerrillos', 'L6'],
    ['Ñuñoa', 'L3/L6'],
    ['Los Leones', 'L1/L6'],
    ['Quilicura', 'L3'],
    ['El Bosque', 'L2'],
    ['Lo Ovalle', 'L2'],
    ['La Cisterna', 'L2/L4A'],
    ['Cerro Blanco', 'L2'],
    ['Salvador', 'L1'],
    ['Irarrázaval', 'L3'],
    ['Ñuble', 'L5/L6'],
    ['Franklin', 'L2/L6'],
    ['Los Presidentes', 'L4'],
    ['Grecia', 'L4'],
    ['Macul', 'L4'],
    ['Las Rejas', 'L1'],
    ['Pajaritos', 'L1'],
    ['Ecuador', 'L1'],
    ['San Alberto Hurtado', 'L1'],
    ['Universidad de Santiago', 'L1'],
    ['República', 'L1'],
    ['Los Héroes', 'L1/L2'],
    ['Toesca', 'L2'],
    ['Parque O\'Higgins', 'L2'],
    ['Rondizzoni', 'L2'],
    ['Departamental', 'L2'],
    ['El Parrón', 'L2'],
    ['Pedrero', 'L5'],
    ['Mirador', 'L5'],
  ]
  const found = []
  for (const [name, line] of stations) {
    if (new RegExp(name, 'i').test(t)) found.push({ station: name, line })
  }
  if (!found.length) return null
  const unique = [...new Map(found.map((f) => [f.station, f])).values()]
  return {
    station: unique.map((u) => u.station).join(' / '),
    line: [...new Set(unique.map((u) => u.line))].join('/'),
    walk: unique.length > 1 ? 10 : 12,
    score: 4,
    verified: true,
  }
}

/** Prefer ficha coords; else a street/number pin; else sector; else comuna centroid. */
function resolveLocation(item, htmlCoords) {
  if (htmlCoords?.lat != null && htmlCoords?.lng != null) {
    return {
      lat: htmlCoords.lat,
      lng: htmlCoords.lng,
      locationEstimated: false,
      locationSource: 'ficha',
    }
  }
  if (
    item.lat != null &&
    item.lng != null &&
    item.dataGaps?.locationEstimated === false &&
    item.dataGaps?.locationSource !== 'calle'
  ) {
    return {
      lat: item.lat,
      lng: item.lng,
      locationEstimated: false,
      locationSource: item.dataGaps?.locationSource || 'ficha',
    }
  }

  const street = lookupStreetPin(loadStreetCoords(), item)
  if (street) {
    const exact = streetPinIsExact(street, item)
    return {
      lat: street.lat,
      lng: street.lng,
      locationEstimated: !exact,
      locationSource: 'calle',
    }
  }

  const localities = loadLocalityCoords()
  const localityKey = extractLocalityKey(item)
  if (localityKey && localities[localityKey]?.lat != null) {
    return {
      lat: localities[localityKey].lat,
      lng: localities[localityKey].lng,
      locationEstimated: true,
      locationSource: `sector:${localityKey}`,
    }
  }

  const bogusComuna = !item.comuna || /^chile$/i.test(item.comuna)
  // Keep previous estimated pin only if we have no better locality hint.
  // "Chile" is not a comuna: Nominatim resolves it to a village (Illapel / Plaza de Armas).
  if (item.lat != null && item.lng != null && !localityKey && !bogusComuna) {
    return {
      lat: item.lat,
      lng: item.lng,
      locationEstimated: item.dataGaps?.locationEstimated === true,
      locationSource: item.dataGaps?.locationSource || 'prev',
    }
  }

  const table = loadComunaCoords()
  if (bogusComuna) {
    return {
      lat: null,
      lng: null,
      locationEstimated: true,
      locationSource: null,
    }
  }
  const key = `${item.comuna}|${item.region}`
  let byComuna = table[key]
  if (!byComuna?.lat) {
    const prefix = `${item.comuna}|`
    for (const [k, v] of Object.entries(table)) {
      if (k.startsWith(prefix) && v?.lat != null) {
        byComuna = v
        break
      }
    }
  }
  if (byComuna?.lat != null && byComuna?.lng != null) {
    return {
      lat: byComuna.lat,
      lng: byComuna.lng,
      locationEstimated: true,
      locationSource: `comuna:${item.comuna}`,
    }
  }
  return {
    lat: null,
    lng: null,
    locationEstimated: true,
    locationSource: null,
  }
}

function extractDtDd(html) {
  const out = {}
  for (const m of html.matchAll(/<dt>([^<]+)<\/dt>\s*<dd>([^<]*)<\/dd>/gi)) {
    const key = decodeHtml(m[1]).trim().toLowerCase()
    const value = decodeHtml(m[2]).trim()
    if (key && value) out[key] = value
  }
  return out
}

function extractLdListing(html) {
  for (const m of html.matchAll(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi,
  )) {
    try {
      const data = JSON.parse(m[1])
      if (data && data['@type'] === 'RealEstateListing') return data
      if (Array.isArray(data)) {
        const hit = data.find((x) => x && x['@type'] === 'RealEstateListing')
        if (hit) return hit
      }
    } catch {
      /* ignore bad JSON-LD */
    }
  }
  return null
}

/** Best-effort public project photo from a detail HTML page. */
function pickProjectImage(html, { prefer = [], reject = [] } = {}) {
  const rejectRe = new RegExp(
    [
      'logo',
      'favicon',
      'icon',
      'sprite',
      'avatar',
      'pixel',
      'tracking',
      'wp-includes',
      'emoji',
      'AgencyLogo',
      'banner-formulario',
      'Recurso%201\\.png',
      'layer-\\d',
      'pop-up',
      'popup',
      ...reject,
    ].join('|'),
    'i',
  )
  const preferRe = prefer.length ? new RegExp(prefer.join('|'), 'i') : null

  const candidates = []
  const push = (raw, score = 0) => {
    if (!raw) return
    let url = String(raw).replace(/\\\//g, '/').trim()
    if (!/^https?:\/\//i.test(url)) return
    if (rejectRe.test(url)) return
    if (!/\.(jpg|jpeg|png|webp)(\?|$)/i.test(url) && !/cdn-cgi\/image/i.test(url))
      return
    let s = score
    if (preferRe?.test(url)) s += 50
    if (/galeria_1|frontis|fachada|destac|og:image|Propertyimage/i.test(url))
      s += 20
    if (/banner/i.test(url)) s += 5
    candidates.push({ url, s })
  }

  const og = html.match(
    /property="og:image"\s+content="(https?:\/\/[^"]+)"/i,
  )?.[1] || html.match(/content="(https?:\/\/[^"]+)"\s+property="og:image"/i)?.[1]
  push(og, 40)

  for (const m of html.matchAll(
    /(?:src|data-src|data-lazy-src)=["'](https?:\/\/[^"']+)["']/gi,
  )) {
    push(m[1], 10)
  }
  for (const m of html.matchAll(
    /background-image:\s*url\(["']?(https?:\/\/[^"')]+)["']?\)/gi,
  )) {
    push(m[1], 8)
  }
  // Escaped JSON URLs (Subsidios.cl embeds)
  for (const m of html.matchAll(
    /https:\\\/\\\/[a-z0-9.\-]+\\\/[^"'\\\s]+\.(?:jpg|jpeg|png|webp)/gi,
  )) {
    push(m[0], 12)
  }

  if (!candidates.length) return null
  candidates.sort((a, b) => b.s - a.s)
  return candidates[0].url
}

/** Top N unique project photos from a detail HTML page. */
function pickProjectImages(html, { prefer = [], reject = [], limit = 6 } = {}) {
  const rejectRe = new RegExp(
    [
      'logo',
      'favicon',
      'icon',
      'sprite',
      'avatar',
      'pixel',
      'tracking',
      'wp-includes',
      'emoji',
      'AgencyLogo',
      'banner-formulario',
      'Recurso%201\\.png',
      'layer-\\d',
      'pop-up',
      'popup',
      'planta-',
      'floor.?plan',
      ...reject,
    ].join('|'),
    'i',
  )
  const preferRe = prefer.length ? new RegExp(prefer.join('|'), 'i') : null
  const scored = new Map()
  const push = (raw, score = 0) => {
    if (!raw) return
    let url = String(raw).replace(/\\\//g, '/').trim()
    if (!/^https?:\/\//i.test(url)) return
    if (rejectRe.test(url)) return
    if (!/\.(jpg|jpeg|png|webp)(\?|$)/i.test(url) && !/cdn-cgi\/image/i.test(url))
      return
    // Drop tiny thumbs / icons by path hints
    if (/[-_](16|24|32|48|64)x\1/i.test(url)) return
    let s = score
    if (preferRe?.test(url)) s += 50
    if (/galeria|frontis|fachada|destac|og:image|Propertyimage|vitrina|banner-proyecto/i.test(url))
      s += 20
    if (/banner/i.test(url)) s += 5
    const prev = scored.get(url)
    if (prev == null || s > prev) scored.set(url, s)
  }

  const og =
    html.match(/property="og:image"\s+content="(https?:\/\/[^"]+)"/i)?.[1] ||
    html.match(/content="(https?:\/\/[^"]+)"\s+property="og:image"/i)?.[1]
  push(og, 40)

  for (const m of html.matchAll(
    /(?:src|data-src|data-lazy-src|data-full|href)=["'](https?:\/\/[^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/gi,
  )) {
    push(m[1], 10)
  }
  for (const m of html.matchAll(
    /background-image:\s*url\(["']?(https?:\/\/[^"')]+)["']?\)/gi,
  )) {
    push(m[1], 8)
  }
  for (const m of html.matchAll(
    /https:\\\/\\\/[a-z0-9.\-]+\\\/[^"'\\\s]+\.(?:jpg|jpeg|png|webp)/gi,
  )) {
    push(m[0], 12)
  }

  return [...scored.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([url]) => url)
    .slice(0, limit)
}

function cleanDescription(raw) {
  if (!raw) return null
  let text = decodeHtml(String(raw))
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (text.length < 40) return null
  // Drop CSS/HTML junk
  if (/[{};]|className|function\s*\(|<!DOCTYPE/i.test(text)) return null
  if (text.length > 900) text = `${text.slice(0, 897).trim()}…`
  return text
}

function extractDescription(html) {
  const listing = extractLdListing(html)
  const ldDesc = listing?.description
  const og =
    html.match(/property="og:description"\s+content="([^"]+)"/i)?.[1] ||
    html.match(/content="([^"]+)"\s+property="og:description"/i)?.[1]
  const meta = html.match(
    /name="description"\s+content="([^"]+)"/i,
  )?.[1]
  const section =
    html.match(
      /(?:detail-section__title|section-title|h2|h3)[^>]*>\s*Descripci[oó]n[\s\S]{0,60}?<\/[^>]+>([\s\S]{0,2200}?)<\/(?:div|section|article)/i,
    )?.[1] ||
    html.match(
      /<(?:p|div)[^>]*class="[^"]*(?:description|descripcion|project-desc)[^"]*"[^>]*>([\s\S]{0,2200}?)<\/(?:p|div)>/i,
    )?.[1]
  return (
    cleanDescription(ldDesc) ||
    cleanDescription(section) ||
    cleanDescription(og) ||
    cleanDescription(meta)
  )
}

const AMENITY_PATTERNS = [
  [/\bpiscinas?\b/i, 'Piscina'],
  [/\bquinchos?\b/i, 'Quincho'],
  [/\bgimnasios?\b/i, 'Gimnasio'],
  [/sala de eventos|sal[oó]n multiuso|sal[oó]n de eventos/i, 'Sala de eventos'],
  [/\bcowork\b|co-work/i, 'Cowork'],
  [/lavander[ií]a/i, 'Lavandería'],
  [/juegos? infantiles?|[aá]rea de juegos/i, 'Juegos infantiles'],
  [/[aá]reas?\s+verdes?/i, 'Áreas verdes'],
  [/estacionamiento(?:s)?\s+(?:de\s+)?visitas?/i, 'Estacionamiento visitas'],
  [/\bbodegas?\b/i, 'Bodega'],
  [/terraza(?:s)?\s+com[uú]n/i, 'Terraza común'],
  [/\bbbq\b|barbecue|\bparrillas?\b/i, 'BBQ / parrilla'],
  [/bicicletero|estacionamiento\s+bicicleta/i, 'Bicicletero'],
  [/conserjer[ií]a|porter[ií]a|seguridad\s*24/i, 'Conserjería'],
  [/\bcanchas?\b/i, 'Cancha'],
  [/\bsauna\b|\bjacuzzi\b|spa\s+(?:y\s+)?(?:wellness|comunal|exterior)|centro\s+de\s+spa/i, 'Spa / wellness'],
  [/pet\s*friendly|acepta\s+mascotas/i, 'Pet friendly'],
  [/sala de cowork|sala cowork/i, 'Sala cowork'],
  [/sala de estar|living\s+comunitario/i, 'Sala de estar'],
  [/c[aá]maras?\s+de\s+seguridad|\bcctv\b/i, 'Cámaras de seguridad'],
]

function extractAmenities(html) {
  const found = []
  const blob = String(html || '')
  for (const [re, label] of AMENITY_PATTERNS) {
    if (re.test(blob)) found.push(label)
  }
  // Bullet lists near amenidades / equipamiento
  const block = blob.match(
    /(?:Amenidades|Equipamiento|Caracter[ií]sticas|Espacios comunes)[\s\S]{0,40}?<\/[^>]+>([\s\S]{0,2500}?)<\/(?:ul|ol|div|section)/i,
  )?.[1]
  if (block) {
    for (const m of block.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)) {
      const label = decodeHtml(m[1])
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      if (label.length >= 3 && label.length <= 48) found.push(label)
    }
  }
  return [...new Set(found)].slice(0, 12)
}

function mergeImages(...lists) {
  const out = []
  const seen = new Set()
  for (const list of lists) {
    for (const url of list || []) {
      if (!url || seen.has(url)) continue
      seen.add(url)
      out.push(url)
      if (out.length >= 8) return out
    }
  }
  return out
}

const IMAGE_PREFER_BY_PORTAL = {
  'subsidios-cl': [
    'galeria_1_',
    'galeria_\\d+_',
    'Propertyimage',
    'digitaloceanspaces\\.com',
  ],
  usatusubsidio: ['usatusubsidio', 'wp-content/uploads', 'Vitrina'],
  'enlace-bci': [
    'cache\\.enlaceinmobiliario',
    'Frontis',
    'cdn-cgi/image',
    'property-gallery',
  ],
  'los-silos': ['proyectos\\.ilossilos', 'frontis', 'uploads'],
  ingevec: ['FOTOS%20WEBP', 'fachada', 'hubfs/PROYECTOS'],
  ciclos: ['wp-content/uploads', 'DJI_', 'condominio'],
  bricsa: ['bricsa', 'uploads', 'proyecto'],
  galilea: ['BANNER-PROYECTO', 'wp-content/uploads', 'Fotos-'],
  euro: ['euroinmobiliaria', 'uploads'],
  ecomac: ['ecomac', 'somosecomac'],
  socovesa: ['socovesa'],
  paz: ['paz\\.cl', 'uploads'],
  aitue: ['aitue'],
}

/** Re-fetch ficha de origen and fill description / gallery / amenities. */
async function enrichGenericFromSource(item) {
  const url = item.sources?.[0]?.url
  if (!url || !/^https?:\/\//i.test(url)) return item
  const portal = item.sources[0].portal
  const prefer = IMAGE_PREFER_BY_PORTAL[portal] || []
  try {
    const html = await fetchText(url)
    const images = pickProjectImages(html, { prefer, limit: 6 })
    const description = extractDescription(html)
    const amenities = extractAmenities(html)
    const address = extractAddress(html) || sanitizeAddress(item.address)
    const contacts = extractContacts(html)
    const htmlCoords = extractCoords(html)
    const location = resolveLocation(item, htmlCoords)
    const parking = inferParking(html)
    const isRM = item.region === 'Metropolitana'
    const metro = isRM ? inferMetroFromText(html) : null
    const regional = !isRM ? regionalAccessFor(item.comuna, item.region) : null
    const goodExisting =
      item.imageUrl && !/logo|AgencyLogo|favicon|icon/i.test(item.imageUrl)
    const imageUrl = goodExisting ? item.imageUrl : images[0] || item.imageUrl
    const mergedImages = mergeImages(
      goodExisting ? [item.imageUrl] : [],
      images,
      item.images,
    )

    const metroVerified = Boolean(metro?.verified)

    return {
      ...item,
      description: description || item.description || null,
      images: mergedImages,
      amenities,
      address: address || null,
      imageUrl: imageUrl || null,
      contactPhone: contacts.contactPhone || item.contactPhone || null,
      contactWhatsapp: contacts.contactWhatsapp || item.contactWhatsapp || null,
      lat: location.lat,
      lng: location.lng,
      parking:
        parking !== 'consultar' ? parking : item.parking || 'consultar',
      metroStation: isRM ? metro?.station || item.metroStation : null,
      metroLine: isRM ? metro?.line || item.metroLine : null,
      metroWalkMin: isRM ? (metro?.walk ?? item.metroWalkMin) : null,
      connectivityScore: isRM
        ? metro?.score ?? item.connectivityScore
        : regional?.connectivityScore ?? item.connectivityScore ?? 2,
      accessKind: isRM ? 'metro' : 'regional',
      accessLabel: isRM ? null : regional?.accessLabel || item.accessLabel,
      accessDetail: isRM ? null : regional?.accessDetail || item.accessDetail,
      accessMode: isRM ? 'metro' : regional?.accessMode || item.accessMode || 'buses',
      metroVerified: isRM ? metroVerified : false,
      dataGaps: {
        ...(item.dataGaps || {}),
        parkingUnknown: !(
          (parking && parking !== 'consultar') ||
          (item.parking && item.parking !== 'consultar')
        ),
        deliveryUnknown:
          item.dataGaps?.deliveryUnknown ??
          !(item.delivery && item.delivery !== 'consultar'),
        metroEstimated: isRM ? !metroVerified : true,
        locationEstimated: location.locationEstimated,
        locationSource: location.locationSource || null,
        priceIsDesde: true,
      },
    }
  } catch (err) {
    console.warn('  detail enrich fail', url, err.message)
    return {
      ...item,
      address: sanitizeAddress(item.address),
      description: cleanDescription(item.description),
      images: Array.isArray(item.images) ? item.images : item.imageUrl ? [item.imageUrl] : [],
      amenities: Array.isArray(item.amenities) ? item.amenities : [],
    }
  }
}

async function enrichAllExistingDetails(catalog) {
  console.log(`  details enriching ${catalog.length} existing fichas…`)
  return mapPool(catalog, 8, enrichGenericFromSource)
}

/** Re-fetch coords/address for projects with estimated pins (esp. regiones / Subsidios.cl). */
async function enrichLocations(catalog) {
  const targets = catalog.filter((p) => {
    const url = p.sources?.[0]?.url || ''
    const fromSubsidios = /subsidios\.cl\/proyecto\//i.test(url)
    const estimated = p.dataGaps?.locationEstimated !== false
    const missingAddr = !p.address
    const outsideRm = p.region !== 'Metropolitana'
    const wrongRegion =
      COMUNA_REGION[p.comuna] &&
      COMUNA_REGION[p.comuna] !== p.region &&
      COMUNA_REGION[p.comuna] !== 'Metropolitana'
    return fromSubsidios || ((outsideRm || wrongRegion) && (estimated || missingAddr))
  })
  console.log(`  locations enriching ${targets.length} / ${catalog.length}…`)
  const byId = new Map(catalog.map((p) => [p.id, p]))

  async function fixOne(item) {
    const url = item.sources?.[0]?.url
    const portal = item.sources?.[0]?.portal
    // Always re-apply known comuna→region map
    const regionFix = COMUNA_REGION[item.comuna]
    let next = item
    if (regionFix && regionFix !== item.region) {
      next = normalizeItem({
        ...item,
        portal: portal || 'subsidios-cl',
        url,
        regionHint: regionFix,
        region: regionFix,
      })
    }

    if (!url || !/^https?:\/\//i.test(url)) return next

    try {
      if (portal === 'subsidios-cl' || /subsidios\.cl\/proyecto\//i.test(url)) {
        return await enrichSubsidiosDetail({
          ...next,
          address: null, // force refresh
          dataGaps: { ...(next.dataGaps || {}), locationEstimated: true },
        })
      }
      const html = await fetchText(url)
      const coords = extractCoords(html)
      const address = extractAddress(html) || next.address
      const location = resolveLocation(
        { ...next, address },
        coords,
      )
      return normalizeItem({
        ...next,
        portal: portal || next.sources?.[0]?.portal || 'web',
        url,
        regionHint: regionFix || next.region,
        address,
        lat: location.lat,
        lng: location.lng,
        dataGaps: {
          ...(next.dataGaps || {}),
          locationEstimated: location.locationEstimated,
          locationSource: location.locationSource,
        },
      })
    } catch (err) {
      console.warn('  location fix fail', url, err.message)
      return next
    }
  }

  const fixed = await mapPool(targets, 6, fixOne)
  for (const p of fixed) byId.set(p.id, p)

  // Second pass: region-only fixes for anyone we skipped
  for (const [id, p] of byId) {
    const regionFix = COMUNA_REGION[p.comuna]
    if (regionFix && regionFix !== p.region) {
      byId.set(
        id,
        normalizeItem({
          ...p,
          portal: p.sources?.[0]?.portal || 'web',
          url: p.sources?.[0]?.url,
          regionHint: regionFix,
          region: regionFix,
        }),
      )
    }
  }

  return [...byId.values()]
}

function applyDetailExtras(item, html, { prefer = [], portal } = {}) {
  const images = pickProjectImages(html, { prefer, limit: 6 })
  const description = extractDescription(html)
  const amenities = extractAmenities(html)
  const address = extractAddress(html)
  const goodExisting =
    item.imageUrl && !/logo|AgencyLogo|favicon|icon/i.test(item.imageUrl)
  return {
    description: description || item.description || null,
    images: mergeImages(goodExisting ? [item.imageUrl] : [], images, item.images),
    amenities: amenities.length ? amenities : item.amenities || [],
    address: address || sanitizeAddress(item.address),
    imageUrl: goodExisting ? item.imageUrl : images[0] || item.imageUrl || null,
    portal,
  }
}

/* -------------------- Subsidios.cl -------------------- */
function extractSubsidios(html) {
  const projects = []
  const seen = new Set()
  const re =
    /href="(\/proyecto\/(\d+)\/([^"]+))"[\s\S]{0,2500}?color-sub-title[^>]*>\s*([\s\S]*?)\s*<\/span>[\s\S]{0,400}?color:\s*#707070[^>]*>\s*([\s\S]*?)\s*<\/span>[\s\S]{0,400}?color:\s*#707070[^>]*>\s*([\s\S]*?dorms\.)\s*<\/span>[\s\S]{0,400}?Desde UF\s*([\d.]+)/gi
  let m
  while ((m = re.exec(html))) {
    const [, pathUrl, idNum, , nameHtml, comunaHtml, dormsText, uf] = m
    if (seen.has(idNum)) continue
    seen.add(idNum)
    const name = decodeHtml(nameHtml)
    const comuna = decodeHtml(comunaHtml)
    const dorms = parseDorms(dormsText)
    if (!name || !uf) continue
    const before = html.slice(Math.max(0, m.index - 1200), m.index)
    const imageUrl =
      before.match(
        /src="(https:\/\/(?:subsidioscl\.)?(?:sfo2\.)?(?:cdn\.)?digitaloceanspaces\.com\/[^"]+)"/i,
      )?.[1] ||
      before.match(/src="(https:\/\/[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/i)?.[1] ||
      null
    projects.push(
      normalizeItem({
        id: `sub-${idNum}-${slugify(name)}`.slice(0, 80),
        portal: 'subsidios-cl',
        name,
        comuna: comuna || 'Chile',
        priceFromUf: parseChileUf(uf),
        bedroomsMin: dorms.min,
        bedroomsMax: dorms.max,
        subsidies: ['DS19'],
        url: `https://www.subsidios.cl${pathUrl}`,
        imageUrl,
        notes: 'Importado desde Subsidios.cl',
      }),
    )
  }
  return projects
}

async function enrichSubsidiosDetail(item) {
  const url = item.sources?.[0]?.url
  if (!url) return item
  const needsDetail =
    !item.description ||
    !(item.images && item.images.length) ||
    !item.imageUrl ||
    /AgencyLogo|logo_|favicon/i.test(item.imageUrl) ||
    !item.address ||
    item.lat == null ||
    item.dataGaps?.locationEstimated !== false
  if (!needsDetail && process.env.FORCE_DETAILS !== '1') return item
  try {
    const html = await fetchText(url)
    const extras = applyDetailExtras(item, html, {
      prefer: IMAGE_PREFER_BY_PORTAL['subsidios-cl'],
      portal: 'subsidios-cl',
    })
    const parking = inferParking(html)
    const isRM = item.region === 'Metropolitana'
    const metro = isRM ? inferMetroFromText(html) : null
    const contacts = extractContacts(html)
    const coords = extractCoords(html)
    const developer =
      html.match(/Inmobiliaria\s+([^<,\n]{2,60})/i)?.[1]?.trim() ||
      item.developer

    const hasFichaCoords = coords?.lat != null && coords?.lng != null
    return normalizeItem({
      ...item,
      portal: 'subsidios-cl',
      url,
      name: item.name,
      comuna: item.comuna,
      regionHint: COMUNA_REGION[item.comuna] || item.region,
      developer:
        developer && developer !== 'Consultar portal'
          ? decodeHtml(developer).slice(0, 80)
          : item.developer,
      priceFromUf: item.priceFromUf,
      priceToUf: item.priceToUf,
      bedroomsMin: item.bedroomsMin,
      bedroomsMax: item.bedroomsMax,
      subsidies: item.subsidies,
      imageUrl: extras.imageUrl,
      images: extras.images,
      description: extras.description,
      amenities: extras.amenities,
      address: extras.address || item.address,
      parking: parking !== 'consultar' ? parking : item.parking,
      metroStation: isRM ? metro?.station || item.metroStation : null,
      metroLine: isRM ? metro?.line || item.metroLine : null,
      metroWalkMin: isRM ? (metro?.walk ?? item.metroWalkMin) : null,
      connectivityScore: isRM
        ? metro?.score ?? item.connectivityScore
        : item.connectivityScore,
      metroVerified: isRM ? Boolean(metro?.verified) : false,
      lat: hasFichaCoords ? coords.lat : item.lat,
      lng: hasFichaCoords ? coords.lng : item.lng,
      contactPhone: contacts.contactPhone || item.contactPhone,
      contactWhatsapp: contacts.contactWhatsapp || item.contactWhatsapp,
      dataGaps: {
        ...(item.dataGaps || {}),
        locationEstimated: hasFichaCoords
          ? false
          : item.dataGaps?.locationEstimated !== false,
        locationSource: hasFichaCoords
          ? 'ficha'
          : item.dataGaps?.locationSource || null,
      },
      notes: extras.imageUrl
        ? `Ficha Subsidios.cl${metro ? `: metro ${metro.station}` : ''}. Confirmá tipologías y cupos en el portal.`
        : item.notes,
    })
  } catch (err) {
    console.warn('  subsidios detail fail', url, err.message)
    return item
  }
}

async function scrapeSubsidios(maxPages = 20) {
  const all = []
  const seen = new Set()
  for (let page = 1; page <= maxPages; page++) {
    const url =
      page === 1
        ? 'https://www.subsidios.cl/proyectos'
        : `https://www.subsidios.cl/proyectos?page=${page}`
    const html = await fetchText(url)
    const batch = extractSubsidios(html)
    let added = 0
    for (const p of batch) {
      if (seen.has(p.id)) continue
      seen.add(p.id)
      all.push(p)
      added++
    }
    if (!added) break
  }
  console.log(`  subsidios enriching ${all.length} detail pages…`)
  return mapPool(all, 6, enrichSubsidiosDetail)
}

/* -------------------- UsaTuSubsidio -------------------- */
function extractUsaTuSubsidio(html) {
  const articles = html.match(/<article class="property-card[\s\S]*?<\/article>/g) || []
  const out = []
  for (const a of articles) {
    const slug =
      a.match(/location\.href='\/propiedades\/([a-z0-9-]+)\/'/)?.[1] ||
      a.match(/href="\/propiedades\/([a-z0-9-]+)\/"/)?.[1]
    const name = decodeHtml(
      a.match(/property-card__title[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/)?.[1],
    )
    const locRaw = decodeHtml(
      a.match(/property-card__location[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/)?.[1],
    )
    const priceRaw = a.match(/property-card__price[^>]*>\s*([\d.]+)\s*UF/i)?.[1]
    const developer = a.match(/propiedades\/\?inmobiliaria=([^"]+)[\s\S]*?<\/a>/)?.[1]
    const subsidyHint = a.match(/subsidio=([^"&]+)/)?.[1] || ''
    const imageUrl =
      a.match(/<img[^>]+src="(https?:\/\/[^"]+)"/i)?.[1] ||
      a.match(/data-src="(https?:\/\/[^"]+)"/i)?.[1] ||
      null
    if (!slug || !name || !priceRaw) continue

    let comuna = 'Chile'
    let regionHint = 'Metropolitana'
    if (locRaw?.includes('/')) {
      const [c, r] = locRaw.split('/').map((x) => x.trim())
      comuna = c
      regionHint = r
    } else if (locRaw) comuna = locRaw

    // Prefer explicit card hint (incl. FOGAES). Never map unknown → DS19.
    let subsidies = parseSubsidyHint(subsidyHint)
    if (!subsidies.length) {
      subsidies = inferHousingSubsidies(a, { defaultTo: 'DS19' })
    }

    out.push(
      normalizeItem({
        id: `uts-${slug}`,
        portal: 'usatusubsidio',
        name,
        comuna,
        region: COMUNA_REGION[comuna] || regionHint || 'Metropolitana',
        developer: developer ? decodeURIComponent(developer).replace(/\+/g, ' ') : 'Consultar portal',
        priceFromUf: parseChileUf(priceRaw),
        subsidies,
        url: `https://usatusubsidio.cl/propiedades/${slug}/`,
        imageUrl,
        notes: 'Importado desde UsaTuSubsidio',
      }),
    )
  }
  return out
}

async function enrichUsaTuSubsidioDetail(item) {
  const url = item.sources?.[0]?.url
  if (!url) return item
  try {
    const html = await fetchText(url)
    const specs = extractDtDd(html)
    const listing = extractLdListing(html)
    const blob = [
      listing?.description || '',
      html.match(
        /detail-section__title[^>]*>\s*Descripci[\s\S]{0,40}?<\/[^>]+>([\s\S]{0,2500}?)<\/(?:div|section)>/i,
      )?.[1] || '',
      html,
    ].join('\n')

    const parking = inferParking(blob)
    const metro = inferMetroFromText(blob)
    const coords = extractCoords(html)
    const contacts = extractContacts(html)

    const dormRaw = specs.dormitorios || specs.dormitorio || ''
    const bathRaw = specs.baños || specs.banos || specs.baño || ''
    const dorms = parseDorms(dormRaw)
    const baths = parseDorms(bathRaw)
    const propertyType = /casa/i.test(specs.tipo || '')
      ? 'casa'
      : item.propertyType || 'departamento'
    const developer =
      specs.inmobiliaria && !/^consultar/i.test(specs.inmobiliaria)
        ? specs.inmobiliaria
        : item.developer
    const comuna = specs.comuna || item.comuna
    const region = specs.región || specs.region || item.region
    const img =
      listing?.image ||
      html.match(/og:image"\s+content="(https:\/\/[^"]+)"/i)?.[1] ||
      item.imageUrl
    const priceFromListing = listing?.price
      ? parseChileUf(String(listing.price).replace(/UF/i, '').trim())
      : 0
    const surfaceRaw =
      specs['superficie útil'] ||
      specs['superficie util'] ||
      specs.superficie ||
      null
    const areaParsed = (() => {
      if (!surfaceRaw) return null
      const n = String(surfaceRaw).match(/([\d]+(?:[.,]\d+)?)/)?.[1]
      if (!n) return null
      const v = Number(n.replace(',', '.'))
      return Number.isFinite(v) && v >= 15 && v <= 400 ? Math.round(v * 10) / 10 : null
    })()

    const notesBits = [
      metro ? `metro ${metro.station}` : null,
      surfaceRaw ? surfaceRaw.replace(/\s+/g, ' ').trim() : null,
      'Confirmá tipologías y cupos en el portal.',
    ].filter(Boolean)

    const extras = applyDetailExtras(item, html, {
      prefer: IMAGE_PREFER_BY_PORTAL.usatusubsidio,
      portal: 'usatusubsidio',
    })

    // Detail “Tipo Subsidio” is authoritative (e.g. FOGAES ≠ DS19).
    const tipo = extractTipoSubsidio(html)
    const fromTipo = parseSubsidyHint(tipo)
    const subsidies = fromTipo.length
      ? fromTipo
      : item.subsidies?.length
        ? item.subsidies
        : ['Sin subsidio']

    return normalizeItem({
      ...item,
      portal: 'usatusubsidio',
      url,
      name: item.name,
      comuna,
      region,
      developer,
      propertyType,
      priceFromUf: item.priceFromUf || priceFromListing || 0,
      priceToUf: item.priceToUf || item.priceFromUf || priceFromListing || 0,
      bedroomsMin: dormRaw ? dorms.min : item.bedroomsMin,
      bedroomsMax: dormRaw ? dorms.max : item.bedroomsMax,
      bathroomsMin: bathRaw ? baths.min : item.bathroomsMin,
      bathroomsMax: bathRaw ? Math.max(baths.min, baths.max) : item.bathroomsMax,
      subsidies,
      parking: parking !== 'consultar' ? parking : item.parking,
      areaM2: areaParsed || item.areaM2 || null,
      metroStation: metro?.station || item.metroStation,
      metroLine: metro?.line || item.metroLine,
      metroWalkMin: metro?.walk ?? item.metroWalkMin,
      connectivityScore: metro?.score ?? item.connectivityScore,
      metroVerified: Boolean(metro?.verified),
      lat: coords?.lat ?? item.lat,
      lng: coords?.lng ?? item.lng,
      imageUrl: extras.imageUrl || img || item.imageUrl,
      images: extras.images,
      description: extras.description,
      amenities: extras.amenities,
      address: extras.address,
      contactPhone: contacts.contactPhone || item.contactPhone,
      contactWhatsapp: contacts.contactWhatsapp || item.contactWhatsapp,
      notes: `Ficha UTS: ${notesBits.join('. ')}`,
    })
  } catch (err) {
    console.warn('  uts detail fail', url, err.message)
    return item
  }
}

async function scrapeUsaTuSubsidio(maxPages = 20) {
  const seeds = [
    ...Array.from({ length: maxPages }, (_, i) => `https://usatusubsidio.cl/propiedades/?page=${i + 1}`),
    'https://usatusubsidio.cl/propiedades/?subsidio=ds19',
    'https://usatusubsidio.cl/propiedades/?subsidio=ds1-tramo-2',
    'https://usatusubsidio.cl/propiedades/?subsidio=ds1-tramo-3',
    'https://usatusubsidio.cl/propiedades/?subsidio=fogaes',
    'https://usatusubsidio.cl/propiedades/?region=metropolitana',
  ]
  const all = []
  const seen = new Set()
  let emptyStreak = 0
  for (const url of seeds) {
    try {
      const html = await fetchText(url)
      const batch = extractUsaTuSubsidio(html)
      let added = 0
      for (const p of batch) {
        if (seen.has(p.id)) continue
        seen.add(p.id)
        all.push(p)
        added++
      }
      if (url.includes('page=') && !added) {
        emptyStreak++
        if (emptyStreak >= 2) break
      } else emptyStreak = 0
    } catch (err) {
      console.warn('  uts page fail', url, err.message)
    }
  }
  console.log(`  uts enriching ${all.length} detail pages…`)
  return mapPool(all, 6, enrichUsaTuSubsidioDetail)
}

/* -------------------- Enlace BCI -------------------- */
function extractBci(html, defaultSubsidies = ['DS19']) {
  const urls = [
    ...html.matchAll(
      /https:\/\/www\.enlaceinmobiliarios\.cl\/bci\/([a-z0-9-]+)\/(departamento|casa)\/([a-z0-9-]+)\/(\d+)/g,
    ),
  ]
  const seen = new Set()
  const out = []
  for (const m of urls) {
    const [full, comunaSlug, tipo, slug, pid] = m
    if (seen.has(pid)) continue
    seen.add(pid)
    const idx = html.indexOf(`/${comunaSlug}/${tipo}/${slug}/${pid}`)
    const window = idx >= 0 ? html.slice(idx, idx + 2800) : ''
    const ufs = [...window.matchAll(/UF\s*([\d.]+)/g)]
      .map((x) => parseChileUf(x[1]))
      .filter((n) => n >= 500 && n <= 12000)
    const priceFromUf = ufs.length ? Math.min(...ufs) : 0
    const priceToUf = ufs.length ? Math.max(...ufs) : priceFromUf
    if (!priceFromUf) continue
    const comuna = titleCaseComuna(comunaSlug)
    const name = slug
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
    out.push(
      normalizeItem({
        id: `bci-${pid}-${slug}`,
        portal: 'enlace-bci',
        name,
        comuna,
        propertyType: tipo === 'casa' ? 'casa' : 'departamento',
        priceFromUf,
        priceToUf,
        subsidies: defaultSubsidies,
        url: full.split('?')[0],
        notes: 'Importado desde Enlace Inmobiliarios (portal BCI)',
      }),
    )
  }
  return out
}

async function enrichBciDetail(item) {
  const url = item.sources?.[0]?.url
  if (!url) return item
  try {
    const html = await fetchText(url)
    const parking = inferParking(html)
    const metro = inferMetroFromText(html)
    const coords = extractCoords(html)
    const extras = applyDetailExtras(item, html, {
      prefer: IMAGE_PREFER_BY_PORTAL['enlace-bci'],
      portal: 'enlace-bci',
    })
    const contacts = extractContacts(html)

    return normalizeItem({
      ...item,
      portal: 'enlace-bci',
      url,
      name: item.name,
      comuna: item.comuna,
      propertyType: item.propertyType,
      priceFromUf: item.priceFromUf,
      priceToUf: item.priceToUf,
      subsidies: item.subsidies,
      parking: parking !== 'consultar' ? parking : item.parking,
      metroStation: metro?.station || item.metroStation,
      metroLine: metro?.line || item.metroLine,
      metroWalkMin: metro?.walk ?? item.metroWalkMin,
      connectivityScore: metro?.score ?? item.connectivityScore,
      metroVerified: Boolean(metro?.verified),
      lat: coords?.lat ?? item.lat,
      lng: coords?.lng ?? item.lng,
      address: extras.address || item.address,
      imageUrl: extras.imageUrl || item.imageUrl,
      images: extras.images,
      description: extras.description,
      amenities: extras.amenities,
      contactPhone: contacts.contactPhone || item.contactPhone,
      contactWhatsapp: contacts.contactWhatsapp || item.contactWhatsapp,
      developer: item.developer,
      notes: metro
        ? `Ficha BCI: metro ${metro.station}. Precio y cupos pueden variar.`
        : item.notes,
    })
  } catch (err) {
    console.warn('  bci detail fail', url, err.message)
    return item
  }
}

async function mapPool(items, concurrency, fn) {
  const out = new Array(items.length)
  let i = 0
  async function worker() {
    while (i < items.length) {
      const idx = i++
      out[idx] = await fn(items[idx], idx)
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  )
  return out
}

async function scrapeBci() {
  const pages = [
    [
      'https://www.enlaceinmobiliarios.cl/bci/listado/region-metropolitana/propiedades/todas/superficie/precios/dormitorios/subsidio-ds19',
      ['DS19'],
    ],
    [
      'https://www.enlaceinmobiliarios.cl/bci/listado/region-metropolitana/propiedades/todas/superficie/precios/dormitorios/subsidio',
      ['DS19', 'DS1'],
    ],
    [
      'https://www.enlaceinmobiliarios.cl/bci/listado/region-metropolitana/propiedades/casa/superficie/precios/dormitorios/subsidio-ds19',
      ['DS19'],
    ],
    [
      'https://www.enlaceinmobiliarios.cl/bci/listado/region-metropolitana/propiedades/departamento/superficie/precios/dormitorios/subsidio-ds19',
      ['DS19'],
    ],
  ]

  const firstHtml = await fetchText(pages[0][0])
  const comunas = [
    ...new Set(
      [
        ...firstHtml.matchAll(
          /\/listado\/region-metropolitana\/([a-z0-9-]+)\/todas\/superficie\/precios\/dormitorios\/subsidio-ds19/g,
        ),
      ]
        .map((m) => m[1])
        .filter((c) => c !== 'propiedades'),
    ),
  ]
  for (const c of comunas) {
    pages.push([
      `https://www.enlaceinmobiliarios.cl/bci/listado/region-metropolitana/${c}/todas/superficie/precios/dormitorios/subsidio-ds19`,
      ['DS19'],
    ])
  }

  const all = []
  const seen = new Set()
  for (const [url, subsidies] of pages) {
    try {
      const html = url === pages[0][0] ? firstHtml : await fetchText(url)
      for (const p of extractBci(html, subsidies)) {
        if (seen.has(p.id)) continue
        seen.add(p.id)
        all.push(p)
      }
    } catch (err) {
      console.warn('  bci page fail', url, err.message)
    }
  }

  console.log(`  bci enriching ${all.length} detail pages…`)
  return mapPool(all, 6, enrichBciDetail)
}

/* -------------------- Los Silos -------------------- */
function extractSilos(html) {
  const out = []
  const seen = new Set()
  // Cards: title link + comuna + DESDE UF (woocommerce)
  const re =
    /wd-entities-title"><a href="(https:\/\/ilossilos\.cl\/producto\/([^"]+)\/)">([^<]+)<\/a>[\s\S]{0,800}?comuna-proyecto">([^<]+)[\s\S]{0,400}?DESDE[\s\S]{0,120}?>([\d.]+)&nbsp;/gi
  let m
  while ((m = re.exec(html))) {
    const [, url, slug, nameHtml, comuna, uf] = m
    if (seen.has(slug)) continue
    seen.add(slug)
    out.push(
      normalizeItem({
        id: `silos-${slugify(slug)}`,
        portal: 'los-silos',
        name: decodeHtml(nameHtml) || slug,
        comuna: comuna.trim(),
        developer: 'Los Silos',
        priceFromUf: parseChileUf(uf),
        subsidies: ['DS19'],
        url,
        notes: 'Importado desde Los Silos',
      }),
    )
  }
  return out
}

async function enrichSilosDetail(item) {
  const url = item.sources?.[0]?.url
  if (!url) return item
  const needsDetail =
    !item.description || !(item.images && item.images.length) || !item.imageUrl
  if (!needsDetail && process.env.FORCE_DETAILS !== '1') return item
  try {
    const html = await fetchText(url)
    const extras = applyDetailExtras(item, html, {
      prefer: IMAGE_PREFER_BY_PORTAL['los-silos'],
      portal: 'los-silos',
    })
    const parking = inferParking(html)
    return normalizeItem({
      ...item,
      portal: 'los-silos',
      url,
      imageUrl: extras.imageUrl,
      images: extras.images,
      description: extras.description,
      amenities: extras.amenities,
      address: extras.address,
      parking: parking !== 'consultar' ? parking : item.parking,
      notes: extras.imageUrl
        ? 'Ficha Los Silos. Confirmá tipologías y cupos en el portal.'
        : item.notes,
    })
  } catch (err) {
    console.warn('  silos detail fail', url, err.message)
    return item
  }
}

async function scrapeSilos() {
  const html = await fetchText('https://ilossilos.cl/los-silos-proyectos-subsidios/')
  const all = extractSilos(html)
  console.log(`  silos enriching ${all.length} detail pages…`)
  return mapPool(all, 5, enrichSilosDetail)
}

/* -------------------- Ingevec -------------------- */
function extractIngevec(html) {
  const out = []
  const links = [
    ...html.matchAll(/href="(https:\/\/ingevecinmobiliaria\.cl\/proyecto-([a-z0-9-]+)[^"]*)"/gi),
  ]
  const seen = new Set()
  for (const m of links) {
    const url = m[1].split('?')[0]
    const slug = m[2]
    if (seen.has(slug)) continue
    seen.add(slug)
    const idx = html.indexOf(m[1])
    // Limit evidence to the same card: do not bleed into the next buscador-card
    // (that bug tagged Diagonal Paraguay as DS19 from Hacienda Lo Errázuriz).
    const cardStart = html.lastIndexOf('buscador-card', idx)
    const nextCard = html.indexOf('buscador-card', idx + Math.max(m[1].length, 1))
    const windowStart = cardStart >= 0 ? cardStart : Math.max(0, idx - 500)
    const windowEnd = nextCard >= 0 ? nextCard : Math.min(html.length, idx + 700)
    const window = html.slice(windowStart, windowEnd)
    const uf = window.match(/UF\s*([\d.]+)/i)?.[1]
    const name = `Ingevec ${slug
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')}`
    const subsidies = inferHousingSubsidies(window)
    out.push(
      normalizeItem({
        id: `ingevec-${slug}`,
        portal: 'ingevec',
        name,
        comuna: 'Santiago',
        region: 'Metropolitana',
        developer: 'Ingevec Inmobiliaria',
        priceFromUf: uf ? parseChileUf(uf) : 2500,
        subsidies,
        url,
        notes: 'Importado desde Ingevec',
        connectivityScore: 4,
      }),
    )
  }
  return out
}

async function enrichIngevecDetail(item) {
  const url = item.sources?.[0]?.url
  if (!url) return item
  const needsDetail =
    !item.description || !(item.images && item.images.length) || !item.imageUrl
  if (!needsDetail && process.env.FORCE_DETAILS !== '1') return item
  try {
    const html = await fetchText(url)
    const extras = applyDetailExtras(item, html, {
      prefer: IMAGE_PREFER_BY_PORTAL.ingevec,
      portal: 'ingevec',
    })
    const parking = inferParking(html)
    const metro = inferMetroFromText(html)
    // Detail page is authoritative for subsidy claims.
    const subsidies = inferHousingSubsidies(html)
    return normalizeItem({
      ...item,
      portal: 'ingevec',
      url,
      subsidies,
      imageUrl: extras.imageUrl,
      images: extras.images,
      description: extras.description,
      amenities: extras.amenities,
      address: extras.address,
      parking: parking !== 'consultar' ? parking : item.parking,
      metroStation: metro?.station || item.metroStation,
      metroLine: metro?.line || item.metroLine,
      metroWalkMin: metro?.walk ?? item.metroWalkMin,
      connectivityScore: metro?.score ?? item.connectivityScore,
      metroVerified: Boolean(metro?.verified),
      notes: extras.imageUrl
        ? `Ficha Ingevec${metro ? `: metro ${metro.station}` : ''}. Confirmá tipologías y cupos en el portal.`
        : item.notes,
    })
  } catch (err) {
    console.warn('  ingevec detail fail', url, err.message)
    return item
  }
}

async function scrapeIngevec() {
  const html = await fetchText('https://ingevecinmobiliaria.cl/proyectos-en-venta')
  const all = extractIngevec(html)
  console.log(`  ingevec enriching ${all.length} detail pages…`)
  return mapPool(all, 5, enrichIngevecDetail)
}

/* -------------------- Ciclos / Gran Avenida -------------------- */
async function scrapeCiclos() {
  const out = []
  const pages = [
    [
      'https://www.iciclos.cl/condominio-santa-rosa/',
      'Condominio Santa Rosa',
      'La Pintana',
      'https://www.iciclos.cl/condominio-santa-rosa/',
    ],
    [
      'https://www.granavenidads19.cl/',
      'Condominio Gran Avenida',
      'El Bosque',
      'https://www.granavenidads19.cl/',
    ],
  ]
  for (const [url, name, comuna, sourceUrl] of pages) {
    try {
      const html = await fetchText(url)
      const ufs = [...html.matchAll(/(?:Desde UF|UF)\s*([\d.]+)/gi)]
        .map((m) => parseChileUf(m[1]))
        .filter((n) => n >= 1000 && n <= 8000)
      const priceFromUf = ufs.length ? Math.min(...ufs) : 1700
      const extras = applyDetailExtras(
        { imageUrl: null, images: [], description: null, amenities: [], address: null },
        html,
        { prefer: IMAGE_PREFER_BY_PORTAL.ciclos, portal: 'ciclos' },
      )
      out.push(
        normalizeItem({
          id: `ciclos-${slugify(name)}`,
          portal: 'ciclos',
          name,
          comuna,
          developer: 'Inmobiliaria Ciclos',
          priceFromUf,
          priceToUf: ufs.length ? Math.max(...ufs) : priceFromUf,
          subsidies: ['DS19'],
          url: sourceUrl,
          imageUrl: extras.imageUrl,
          images: extras.images,
          description: extras.description,
          amenities: extras.amenities,
          address: extras.address,
          bedroomsMin: 1,
          bedroomsMax: 3,
          notes: extras.imageUrl
            ? 'Ficha Ciclos. Confirmá tipologías y cupos en el portal.'
            : 'Importado desde Ciclos / sitio del proyecto',
        }),
      )
    } catch (err) {
      console.warn('  ciclos fail', url, err.message)
    }
  }
  return out
}

/* -------------------- Euro Inmobiliaria -------------------- */
async function scrapeEuro() {
  const html = await fetchText('https://www.euroinmobiliaria.cl/proyectos?subsidio=1')
  const data = extractJsonArray(html, '[{"id":')
  if (!Array.isArray(data) || !data.length) throw new Error('Euro JSON not found')
  const contacts = extractContacts(html)
  const out = []
  for (const p of data) {
    const modelos = Array.isArray(p.modelos) ? p.modelos : []
    const subPrices = modelos
      .filter((m) => m.subsidio && m.precio)
      .map((m) => Number(m.precio))
      .filter((n) => n >= 500)
    const allPrices = modelos
      .map((m) => Number(m.precio))
      .filter((n) => Number.isFinite(n) && n >= 500)
    const hasSub = subPrices.length > 0
    const prices = hasSub ? subPrices : allPrices
    const priceFromUf = prices.length
      ? Math.min(...prices)
      : Number(p.min_price) || 0
    if (!priceFromUf) continue
    const dorms = parseDorms(p.bedrooms || '')
    const comuna = p.comuna_nombre || titleCaseComuna(p.comuna_slug || 'santiago')
    out.push(
      normalizeItem({
        id: `euro-${p.slug || p.id}`,
        portal: 'euro',
        name: p.nombre || p.slug,
        comuna,
        developer: 'Euro Inmobiliaria',
        priceFromUf: Math.round(priceFromUf),
        priceToUf: Math.round(prices.length ? Math.max(...prices) : priceFromUf),
        bedroomsMin: dorms.min,
        bedroomsMax: dorms.max,
        bathroomsMin: Number(String(p.bathrooms || '1').match(/\d+/)?.[0] || 1),
        subsidies: hasSub
          ? // Euro “subsidio” flag = subsidio a la tasa, not MINVU DS19/DS1.
            inferHousingSubsidies(`${p.nombre || ''} ${p.slug || ''} subsidio a la tasa`)
          : ['Sin subsidio'],
        delivery: p.entrega || 'consultar',
        url: `https://www.euroinmobiliaria.cl/proyectos/${p.slug}`,
        imageUrl: p.imagen ? String(p.imagen).replace(/\\\//g, '/') : null,
        images: p.imagen ? [String(p.imagen).replace(/\\\//g, '/')] : [],
        address: sanitizeAddress(p.direccion),
        lat: usableCoord(p.lat, p.lng)?.lat ?? null,
        lng: usableCoord(p.lat, p.lng)?.lng ?? null,
        description: cleanDescription(
          [
            p.nombre,
            p.comuna_nombre ? `en ${p.comuna_nombre}` : null,
            p.entrega ? `entrega ${p.entrega}` : null,
            hasSub ? 'con tipologías sujetas a subsidio a la tasa' : null,
          ]
            .filter(Boolean)
            .join(' · '),
        ),
        contactPhone: contacts.contactPhone,
        contactWhatsapp: contacts.contactWhatsapp
          ? `${contacts.contactWhatsapp}?text=${encodeURIComponent(
              `Hola, me interesa cotizar ${p.nombre || p.slug}`,
            )}`
          : null,
        notes: 'Importado desde Euro Inmobiliaria',
      }),
    )
  }
  return out
}

/* -------------------- Ecomac API -------------------- */
async function scrapeEcomac() {
  const data = await fetchJson(
    'https://api.somosecomac.cl/api/v1/website/web-projects?per_page=100',
  )
  const rows = data?.data || []
  return rows
    .filter((p) => !p.in_draft && p.uf_value_from)
    .map((p) => {
      const dorms = parseDorms(p.bedrooms_range)
      const baths = parseDorms(p.bathrooms_range)
      const tipo = String(p.type || '').toUpperCase().includes('CASA')
        ? 'casa'
        : 'departamento'
      const cover = p.cover_image_desktop || p.cover_image_mobile
      return normalizeItem({
        id: `ecomac-${p.slug || p.id}`,
        portal: 'ecomac',
        name: p.name,
        comuna: p.commune?.name || 'Chile',
        developer: 'Ecomac',
        propertyType: tipo,
        priceFromUf: Math.round(Number(p.uf_value_from)),
        bedroomsMin: dorms.min,
        bedroomsMax: dorms.max,
        bathroomsMin: baths.min,
        bathroomsMax: baths.max,
        subsidies: p.is_ds19 ? ['DS19'] : ['Sin subsidio'],
        delivery: p.sale_type || 'consultar',
        url: `https://www.ecomac.cl/proyectos/${p.slug}`,
        imageUrl: cover ? `https://api.somosecomac.cl${cover}` : null,
        notes: 'Importado desde API Ecomac',
      })
    })
}

/* -------------------- Socovesa -------------------- */
async function scrapeSocovesa() {
  const html = await fetchText('https://www.socovesa.cl/proyectos')
  const out = []
  const re =
    /<div class="card_proyecto"([^>]*)>([\s\S]*?)<h4>([^<]+)<\/h4>[\s\S]*?href="(https:\/\/www\.socovesa\.cl\/nuestros-proyectos\/[^"]+)"/g
  let m
  while ((m = re.exec(html))) {
    const [, attrs, cardHtml, nameHtml, url] = m
    const attr = (k) => attrs.match(new RegExp(`${k}="([^"]*)"`))?.[1]
    const price = Number(attr('data-precio') || 0)
    if (!price || price < 500) continue
    const comuna = attr('data-location') || 'Chile'
    const tipo = String(attr('data-tipo') || '').toLowerCase().includes('casa')
      ? 'casa'
      : 'departamento'
    const dorm = Number(attr('data-dormitorios') || 1)
    const subFlag = String(attr('data-subsidio') || '').toLowerCase()
    const slugSub = /subsidio|ds19/i.test(url)
    const subsidies = subFlag === 'si' || slugSub ? ['DS19'] : ['Sin subsidio']
    const imageUrl =
      cardHtml.match(/src="(https:\/\/www\.socovesa\.cl\/wp-content\/uploads\/[^"]+)"/)?.[1] ||
      null
    out.push(
      normalizeItem({
        id: `soco-${slugify(url.split('/').filter(Boolean).pop())}`,
        portal: 'socovesa',
        name: decodeHtml(nameHtml),
        comuna,
        developer: 'Socovesa',
        propertyType: tipo,
        priceFromUf: price,
        bedroomsMin: dorm,
        bedroomsMax: Math.max(dorm, tipo === 'casa' ? 3 : dorm),
        subsidies,
        delivery: attr('data-disponibilidad') || 'consultar',
        url,
        imageUrl,
        notes: 'Importado desde Socovesa',
      }),
    )
  }
  return out
}

/* -------------------- Paz API -------------------- */
async function scrapePaz() {
  const [rows, images] = await Promise.all([
    fetchJson('https://api.paz.cl/api/proyectos'),
    fetchJson('https://api.paz.cl/api/proyectos/imagenes-principales').catch(() => []),
  ])
  if (!Array.isArray(rows)) throw new Error('Paz API unexpected shape')
  const imgById = new Map()
  for (const img of Array.isArray(images) ? images : []) {
    if (!img?.idProyecto || !img?.url) continue
    if (!imgById.has(img.idProyecto)) {
      imgById.set(img.idProyecto, `https://api.paz.cl${img.url}`)
    }
  }
  return rows
    .map((p) => {
      const price = Math.round(Number(p.precio_desde) || 0)
      if (!price || price < 500) return null
      const name = p.nombre_proyecto || p.edificio
      const slug = slugify(p.edificio || name)
      const hasTasa = Boolean(p.logoSubsidioTasa)
      const subsidies = ['Sin subsidio']
      const notes = hasTasa
        ? 'Importado desde Paz (posible subsidio a la tasa)'
        : 'Importado desde API Paz'
      const dorms = parseDorms(p.cantidad_dormitorios || '1-2')
      const idKey = `${p.id_proyecto}1`
      const imageUrl =
        imgById.get(idKey) ||
        imgById.get(p.id_proyecto) ||
        (p.logo_1_nombre_proyecto
          ? `https://api.paz.cl${p.logo_1_nombre_proyecto}logo.png`
          : null)
      return normalizeItem({
        id: `paz-${p.id_proyecto || slug}`,
        portal: 'paz',
        name: decodeHtml(name),
        comuna: p.comuna || 'Santiago',
        developer: 'Paz Corp',
        propertyType: 'departamento',
        priceFromUf: price,
        bedroomsMin: dorms.min,
        bedroomsMax: dorms.max,
        subsidies,
        delivery: p.tipo_de_entrega || p.fechA_ENTREGA || 'consultar',
        metroStation: p.metro || null,
        connectivityScore: p.metro ? 5 : 3,
        url: `https://www.paz.cl/proyecto/${slug}`,
        imageUrl,
        notes,
      })
    })
    .filter(Boolean)
}

/* -------------------- Aitue -------------------- */
async function scrapeAitue() {
  const html = await fetchText('https://www.aitue.cl/proyectos')
  const blocks = html.split(/<div class="columns proyecto/).slice(1)
  const out = []
  const seen = new Set()
  for (const b of blocks) {
    const href =
      b.match(/href="(https:\/\/www\.aitue\.cl\/propiedades-(casas|departamentos)\/([^"/]+)\/(?:([^"/]+)\/)?)"/)?.[0] &&
      b.match(
        /href="(https:\/\/www\.aitue\.cl\/propiedades-(casas|departamentos)\/([^"/]+)(?:\/([^"/]+))?\/?)"/,
      )
    if (!href) continue
    const url = href[1]
    const tipo = href[2] === 'casas' ? 'casa' : 'departamento'
    const slug = href[3]
    const comunaSlug = href[4] || ''
    if (seen.has(url)) continue
    seen.add(url)
    const uf = b.match(/Desde ([\d.]+) UF/)?.[1]
    if (!uf) continue
    const name =
      decodeHtml(b.match(/alt="([^"]+)"/)?.[1]) ||
      slug
        .split('-')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ')
    const comuna = comunaSlug ? titleCaseComuna(comunaSlug) : 'Chile'
    const price = parseChileUf(uf)
    // Aitue: subsidio a la tasa existe en el sitio; DS19 solo con evidencia explícita.
    const subsidies = inferHousingSubsidies(b)
    const imageUrl =
      b.match(/src="(https:\/\/www\.aitue\.cl\/wp-content\/uploads\/[^"]+)"/)?.[1] ||
      null
    out.push(
      normalizeItem({
        id: `aitue-${slugify(slug)}`,
        portal: 'aitue',
        name,
        comuna,
        developer: 'Aitue',
        propertyType: tipo,
        priceFromUf: price,
        subsidies,
        imageUrl,
        url,
        notes: 'Importado desde Aitue',
      }),
    )
  }
  return out
}

/* -------------------- Bricsa -------------------- */
async function scrapeBricsa() {
  const home = await fetchText('https://www.bricsa.cl/')
  const ids = new Set(
    [...home.matchAll(/https:\/\/bricsa\.cl\/proyecto\/(\d+)/g)].map((m) => m[1]),
  )
  // Known DS19 / subsidio listings that may not appear as clean hrefs
  for (const id of ['35', '42']) ids.add(id)

  const out = []
  for (const id of ids) {
    try {
      const html = await fetchText(`https://bricsa.cl/proyecto/${id}`)
      const title = decodeHtml(html.match(/<title>([^<]+)/)?.[1] || '')
        .replace(/\s*-\s*Bricsa.*/i, '')
        .trim()
      if (!title || /error|not found/i.test(title)) continue
      const ufs = [...html.matchAll(/UF\s*([\d.,]+)/g)]
        .map((m) => parseChileUf(m[1]))
        .filter((n) => n >= 800 && n <= 15000)
      if (!ufs.length) continue
      const priceFromUf = Math.min(...ufs)
      const isSub = /\(Subsidios\)|subsidio\s*ds|DS\s*19/i.test(title + html.slice(0, 8000))
      // Infer comuna from common patterns
      let comuna = 'Metropolitana'
      const muni = html.match(/data-municipality="([^"]+)"/i)?.[1]
      if (muni) comuna = titleCaseComuna(slugify(muni))
      else {
        for (const c of Object.keys(COMUNA_REGION)) {
          if (new RegExp(`\\b${c}\\b`, 'i').test(html.slice(0, 12000))) {
            comuna = c
            break
          }
        }
      }
      if (comuna === 'Metropolitana') comuna = 'Santiago'
      const imageUrl = pickProjectImage(html, {
        prefer: ['venta\\.bricsa\\.cl', 'destac', 'multimedia/proyecto'],
        reject: ['bricsabanner'],
      })
      out.push(
        normalizeItem({
          id: `bricsa-${id}`,
          portal: 'bricsa',
          name: title,
          comuna,
          developer: 'Bricsa',
          priceFromUf,
          priceToUf: Math.max(...ufs),
          subsidies: isSub ? ['DS19'] : ['Sin subsidio'],
          url: `https://bricsa.cl/proyecto/${id}`,
          imageUrl,
          notes: imageUrl
            ? 'Ficha Bricsa. Confirmá tipologías y cupos en el portal.'
            : 'Importado desde Bricsa',
        }),
      )
    } catch (err) {
      console.warn('  bricsa fail', id, err.message)
    }
  }
  return out
}

/* -------------------- Galilea -------------------- */
async function scrapeGalilea() {
  const pages = [
    ['https://www.galilea.cl/proyectos/brisas-de-machali-ii/', 'Brisas de Machalí II', 'Machalí'],
    [
      'https://www.galilea.cl/proyectos/altos-de-tejas-verdes/',
      'Altos de Tejas Verdes',
      'Chile',
    ],
  ]
  const out = []
  for (const [url, name, comunaHint] of pages) {
    try {
      const html = await fetchText(url)
      if (html.length < 2000) continue
      const ufs = [...html.matchAll(/Desde\s*([\d.]+)\s*UF/gi)]
        .map((m) => parseChileUf(m[1]))
        .filter((n) => n >= 1000 && n <= 12000)
      if (!ufs.length) continue
      const hasSub = /\bDS\s*19\b|subsidio\s*autom[aá]tico|acogido\s+al\s+subsidio/i.test(
        html,
      )
      const saysSin = /<p>\s*sin\s+subsidio\s*<\/p>/i.test(html)
      const subsidies =
        hasSub && !saysSin ? ['DS19'] : inferHousingSubsidies(html)
      let comuna = comunaHint
      if (comuna === 'Chile') {
        for (const c of Object.keys(COMUNA_REGION)) {
          if (html.includes(c)) {
            comuna = c
            break
          }
        }
      }
      out.push(
        normalizeItem({
          id: `galilea-${slugify(name)}`,
          portal: 'galilea',
          name,
          comuna,
          developer: 'Galilea',
          priceFromUf: Math.min(...ufs),
          priceToUf: Math.max(...ufs),
          subsidies,
          url,
          bedroomsMin: 2,
          bedroomsMax: 3,
          imageUrl: pickProjectImage(html, {
            prefer: ['BANNER-PROYECTO', 'wp-content/uploads', 'Fotos-'],
            reject: ['POP-UP', 'popup', 'traz\\.png'],
          }),
          notes: 'Ficha Galilea. Confirmá tipologías y cupos en el portal.',
        }),
      )
    } catch (err) {
      console.warn('  galilea fail', url, err.message)
    }
  }
  return out
}

function plainName(raw) {
  return decodeHtml(String(raw || '').replace(/<br\s*\/?>/gi, ' '))
    .replace(/\s+/g, ' ')
    .trim()
}

function numCoord(raw) {
  const n = Number(String(raw ?? '').trim())
  return Number.isFinite(n) ? n : null
}

/** 0,0 and points outside Chile are missing coordinates, not a real pin. */
function usableCoord(lat, lng) {
  const a = Number(lat)
  const b = Number(lng)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null
  if (Math.abs(a) < 0.01 && Math.abs(b) < 0.01) return null
  if (a < -56 || a > -17 || b < -76 || b > -66) return null
  return { lat: a, lng: b }
}

/** Drop coordinates that land in another city than the stated comuna. */
function acceptProjectCoords(lat, lng, comuna, region) {
  if (lat == null || lng == null) return null
  if (lat < -56 || lat > -17 || lng < -76 || lng > -66) return null
  const table = loadComunaCoords()
  const hit =
    table[`${comuna}|${region}`] ||
    Object.entries(table).find(([k]) => k.startsWith(`${comuna}|`))?.[1]
  if (hit?.lat != null && haversineKm(lat, lng, hit.lat, hit.lng) > 40) return null
  return { lat, lng }
}

function comunaSelectMap(html) {
  const map = new Map()
  for (const m of html.matchAll(/<option[^>]*value="(\d+)"[^>]*>([^<]+)/gi)) {
    const label = decodeHtml(m[2]).trim()
    const known = Object.keys(COMUNA_REGION).find(
      (c) => c.toLowerCase() === label.toLowerCase(),
    )
    if (known) map.set(m[1], known)
  }
  return map
}

function regionFor(comuna) {
  return COMUNA_REGION[comuna] || 'Metropolitana'
}

/* -------------------- Santolaya -------------------- */
async function scrapeSantolaya() {
  const [html, data] = await Promise.all([
    fetchText('https://www.santolaya.cl/proyectos-venta'),
    fetchJsonPost('https://www.santolaya.cl/api/proyecto/traerProyectosFiltro'),
  ])
  const rows = data?.proyectos
  if (!Array.isArray(rows) || !rows.length) throw new Error('listado Santolaya vacío')
  const comunas = comunaSelectMap(html)
  return rows
    .map((p) => {
      const price = Math.round(Number(p.desde_uf) || 0)
      if (!price || price < 500) return null
      const comuna = comunas.get(String(p.id_comuna)) || 'Santiago'
      const region = regionFor(comuna)
      const dorms = parseDorms(p.cant_dorm)
      const baths = parseDorms(p.cant_banos)
      const delivery = plainName(p.fecha_entrega || p.estado_entrega?.nombre || p.tipo_venta)
      const coords = acceptProjectCoords(
        numCoord(p.coor_latitud),
        numCoord(p.coor_longitud),
        comuna,
        region,
      )
      const image = p.portada_web
        ? `https://www.santolaya.cl/images/proyecto/portada/${encodeURI(p.portada_web)}`
        : null
      const phone = normalizeChileMobile(p.whatsapp || p.telefono)
      return normalizeItem({
        id: `santolaya-${slugify(p.alias || p.nombre)}`,
        portal: 'santolaya',
        name: plainName(p.nombre),
        comuna,
        region,
        developer: 'Santolaya',
        propertyType: /casa/i.test(p.nombre || '') ? 'casa' : 'departamento',
        priceFromUf: price,
        bedroomsMin: dorms.min,
        bedroomsMax: dorms.max,
        bathroomsMin: baths.min,
        bathroomsMax: baths.max,
        subsidies: inferHousingSubsidies(p.descripcion || ''),
        delivery,
        availabilityNote: delivery,
        url: `https://www.santolaya.cl/proyecto/${p.alias}`,
        imageUrl: image,
        address: plainName(p.direccion),
        description: p.descripcion,
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
        contactPhone: phone ? `+${phone}` : null,
        contactWhatsapp: phone ? `https://wa.me/${phone}` : null,
        dataGaps: coords
          ? { locationEstimated: false, locationSource: 'ficha' }
          : undefined,
        notes: 'Importado desde Santolaya',
      })
    })
    .filter(Boolean)
}

async function fetchJsonPost(url) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'User-Agent': UA,
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: '',
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  return res.json()
}

/* -------------------- Fundamenta -------------------- */
async function scrapeFundamenta() {
  const html = await fetchText('https://www.fundamenta.cl/proyectos-en-venta/')
  const cards = html.split(/<article\b/).slice(1)
  const out = []
  const seen = new Set()
  for (const card of cards) {
    const href = card.match(
      /href="(https:\/\/www\.fundamenta\.cl\/proyectos-en-venta\/([^"/]+)\/([^"/]+)\/?)"/,
    )
    if (!href || seen.has(href[1])) continue
    seen.add(href[1])
    const price = parseChileUf(card.match(/UF\s*([\d.]+)/)?.[1] || '')
    if (!price || price < 500) continue
    const sector = href[2]
    const slug = href[3]
    const tipo = /departamento/i.test(sector) ? 'departamento' : 'casa'
    const comunaSlug = sector.replace(/^departamento-en-/, '')
    const comuna = titleCaseComuna(comunaSlug)
    const dorms = parseDorms(
      [...card.matchAll(/dormitorio[^>]*>(\d+)/gi)].map((m) => m[1]).join(' '),
    )
    const name = slug
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
    const image = card.match(/src="(https:\/\/www\.fundamenta\.cl\/wp-content\/uploads\/[^"]+)"/)?.[1]
    const sold = soldListing(card.replace(/<[^>]+>/g, ' '))
    out.push(
      normalizeItem({
        id: `fundamenta-${slugify(slug)}`,
        portal: 'fundamenta',
        name,
        comuna,
        developer: 'Fundamenta',
        propertyType: tipo,
        priceFromUf: price,
        bedroomsMin: dorms.min,
        bedroomsMax: dorms.max,
        subsidies: inferHousingSubsidies(card),
        availability: sold ? 'agotado' : 'disponible',
        url: href[1],
        imageUrl: image || null,
        notes: 'Importado desde Fundamenta',
      }),
    )
  }
  if (!out.length) throw new Error('listado Fundamenta vacío')
  return out
}

/* -------------------- Deisa -------------------- */
async function scrapeDeisa() {
  const html = await fetchText('https://www.deisa.cl/enventa')
  const at = html.indexOf('BUSCADOR_PROYECTOS = ')
  const rows = at < 0 ? null : extractJsonArray(html.slice(at), '[')
  if (!Array.isArray(rows) || !rows.length) throw new Error('listado Deisa vacío')
  return rows
    .map((p) => {
      const price = Math.round(Number(p.valor_oferta) || Number(p.valor_desde) || 0)
      if (!price || price < 500) return null
      const comuna = p.comuna?.nombre || 'Santiago'
      const region = regionFor(comuna)
      const dorms = parseDorms(p.dormitorios)
      const baths = parseDorms(p.banos)
      const coords = acceptProjectCoords(
        numCoord(p.latitud),
        numCoord(p.longitud),
        comuna,
        region,
      )
      const phone = normalizeChileMobile(p.telefono || p.whatsapp)
      return normalizeItem({
        id: `deisa-${slugify(p.alias || p.nombre)}`,
        portal: 'deisa',
        name: plainName(p.nombre),
        comuna,
        region,
        developer: 'Deisa',
        propertyType: 'departamento',
        priceFromUf: price,
        bedroomsMin: dorms.min,
        bedroomsMax: dorms.max,
        bathroomsMin: baths.min,
        bathroomsMax: baths.max,
        subsidies: inferHousingSubsidies(`${p.bajada || ''} ${p.titulo || ''}`),
        delivery: plainName(p.tipo_entrega || p.buscador_tipo_entrega_label),
        availability: Number(p.estado) === 1 ? 'disponible' : 'agotado',
        url: p.link && /^https?:/i.test(p.link)
          ? p.link
          : `https://www.deisa.cl/proyecto/${p.alias}`,
        imageUrl: p.imagen_fachada
          ? `https://www.deisa.cl/images/proyectos/fachada/${encodeURI(p.imagen_fachada)}`
          : null,
        address: plainName(p.direccion),
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
        contactPhone: phone ? `+${phone}` : null,
        contactWhatsapp: phone ? `https://wa.me/${phone}` : null,
        dataGaps: coords
          ? { locationEstimated: false, locationSource: 'ficha' }
          : undefined,
        notes: 'Importado desde Deisa',
      })
    })
    .filter(Boolean)
}

/* -------------------- PY -------------------- */
async function scrapePy() {
  const html = await fetchText('https://py.cl/proyectos/')
  const parts = html.split(/<a href="(https:\/\/py\.cl\/proyecto\/[^"]+)"/)
  const out = []
  for (let i = 1; i < parts.length; i += 2) {
    const url = parts[i]
    const card = parts[i + 1] || ''
    const slug = url.split('/').filter(Boolean).pop()
    const name = plainName(card.match(/card__title">([^<]+)/)?.[1])
    const comuna = plainName(card.match(/card__place[^>]*>([^<]+)/)?.[1]) || 'Chile'
    const price = parseChileUf(card.match(/UF\s*(?:&nbsp;)?\s*([\d.]+)/)?.[1] || '')
    if (!name || !price || price < 500) continue
    const dorms = parseDorms(card.match(/<strong>([^<]*dorm[^<]*|[^<]+)<\/strong>/i)?.[1] || card)
    const tipo = /\/casas-/i.test(url) ? 'casa' : 'departamento'
    const image = card.match(/src="(https:\/\/py\.cl\/wp-content\/uploads\/[^"]+)"/)?.[1] || null
    const text = card.replace(/<[^>]+>/g, ' ')
    out.push(
      normalizeItem({
        id: `py-${slugify(slug)}`,
        portal: 'py',
        name,
        comuna,
        developer: 'PY',
        propertyType: tipo,
        priceFromUf: price,
        bedroomsMin: dorms.min,
        bedroomsMax: dorms.max,
        subsidies: inferHousingSubsidies(text),
        availability: soldListing(text) ? 'agotado' : 'disponible',
        url,
        imageUrl: image,
        notes: 'Importado desde PY',
      }),
    )
  }
  if (!out.length) throw new Error('listado PY vacío')
  return out
}

/* -------------------- Besalco -------------------- */
async function scrapeBesalco() {
  const html = await fetchText('https://www.besalcoinmobiliaria.cl/proyectos/')
  const scripts = [...new Set([...html.matchAll(/\/_nuxt\/[^"'\s>]+\.js/g)].map((m) => m[0]))]
  let bundle = ''
  for (const src of scripts) {
    const js = await fetchText(`https://www.besalcoinmobiliaria.cl${src}`)
    if (js.includes('typeOfProject') && js.includes('commune:')) {
      bundle = js
      break
    }
  }
  if (!bundle) throw new Error('Besalco no publicó el listado')
  const start = bundle.indexOf('[{id:')
  if (start < 0) throw new Error('listado Besalco no reconocible')
  const objects = splitJsObjects(bundle, start + 1)
  const out = []
  for (const obj of objects) {
    const available = /available:!0/.test(obj)
    if (!available || soldListing(jsString(obj, 'status'))) continue
    const title = jsString(obj, 'title')
    const path = jsString(obj, 'path')
    const price = Math.round(Number(jsString(obj, 'value')) || 0)
    if (!title || !path || !price || price < 500 || price > 80000) continue
    const comuna = jsString(obj, 'commune') || 'Chile'
    const tipo = /casa/i.test(jsString(obj, 'type')) ? 'casa' : 'departamento'
    const dorms = parseDorms(obj.match(/dorms:"([^"]+)"/)?.[1] || '')
    const baths = parseDorms(obj.match(/bath:"([^"]+)"/)?.[1] || '')
    const image = jsString(obj, 'cardImage')
    out.push(
      normalizeItem({
        id: `besalco-${slugify(path)}`,
        portal: 'besalco',
        name: title,
        comuna,
        developer: 'Besalco',
        propertyType: tipo,
        priceFromUf: price,
        bedroomsMin: dorms.min,
        bedroomsMax: dorms.max,
        bathroomsMin: baths.min,
        bathroomsMax: baths.max,
        subsidies: inferHousingSubsidies(obj),
        delivery: jsString(obj, 'status') || 'consultar',
        description: jsString(obj, 'description'),
        url: `https://www.besalcoinmobiliaria.cl/${path}`,
        imageUrl: image
          ? `https://www.besalcoinmobiliaria.cl${image.startsWith('/') ? '' : '/'}${image}`
          : null,
        notes: 'Importado desde Besalco Inmobiliaria',
      }),
    )
  }
  if (!out.length) throw new Error('listado Besalco vacío')
  return out
}

function jsString(obj, key) {
  const m = obj.match(new RegExp(`${key}:"((?:\\\\.|[^"\\\\])*)"`))
  return m ? m[1].replace(/\\"/g, '"') : ''
}

function splitJsObjects(js, from) {
  const out = []
  let i = from
  while (i < js.length && js[i] !== ']') {
    if (js[i] !== '{') {
      i++
      continue
    }
    let depth = 0
    let quote = false
    let esc = false
    let end = i
    for (let j = i; j < js.length; j++) {
      const ch = js[j]
      if (quote) {
        if (esc) esc = false
        else if (ch === '\\') esc = true
        else if (ch === '"') quote = false
        continue
      }
      if (ch === '"') quote = true
      else if (ch === '{') depth++
      else if (ch === '}') {
        depth--
        if (depth === 0) {
          end = j + 1
          break
        }
      }
    }
    out.push(js.slice(i, end))
    i = end
    if (out.length > 400) break
  }
  return out
}

/* -------------------- Merge -------------------- */
function mergeCatalog(existing, scraped) {
  const byId = new Map()
  const byKey = new Map()

  for (const item of existing) {
    const fixed = {
      ...item,
      comuna: decodeHtml(item.comuna),
      region: normalizeRegion(
        COMUNA_REGION[decodeHtml(item.comuna)] || item.region,
      ),
    }
    byId.set(fixed.id, fixed)
    byKey.set(`${slugify(fixed.name)}|${slugify(fixed.comuna)}`, fixed.id)
  }

  let updated = 0
  let created = 0

  for (const s of scraped) {
    const key = `${slugify(s.name)}|${slugify(s.comuna)}`
    const existingId = byKey.get(key)
    if (existingId && byId.has(existingId)) {
      const cur = byId.get(existingId)
      const fromFicha = /Ficha (UTS|BCI|Subsidios|Los Silos|Ingevec|Bricsa|Galilea|Ciclos)/i.test(
        s.notes || '',
      )
      const betterDeveloper = (d) =>
        d && d !== 'Consultar portal' && !/\+/.test(d) ? d : null
      byId.set(existingId, {
        ...cur,
        priceFromUf: s.priceFromUf || cur.priceFromUf,
        priceToUf: s.priceToUf || cur.priceToUf || s.priceFromUf || cur.priceFromUf,
        bedroomsMin: fromFicha
          ? s.bedroomsMin ?? cur.bedroomsMin
          : Math.min(cur.bedroomsMin ?? 99, s.bedroomsMin ?? 99) || cur.bedroomsMin,
        bedroomsMax: fromFicha
          ? s.bedroomsMax ?? cur.bedroomsMax
          : Math.max(cur.bedroomsMax ?? 0, s.bedroomsMax ?? 0) || cur.bedroomsMax,
        bathroomsMin: fromFicha
          ? s.bathroomsMin ?? cur.bathroomsMin
          : Math.min(cur.bathroomsMin ?? 99, s.bathroomsMin ?? 99) ||
            cur.bathroomsMin,
        bathroomsMax: fromFicha
          ? s.bathroomsMax ?? cur.bathroomsMax
          : Math.max(cur.bathroomsMax ?? 0, s.bathroomsMax ?? 0) ||
            cur.bathroomsMax,
        subsidies: uniqueSubsidies([...(cur.subsidies || []), ...(s.subsidies || [])]),
        sources: mergeSources(cur.sources, s.sources?.[0]),
        imageUrl: s.imageUrl || cur.imageUrl || null,
        images: mergeImages(s.images, cur.images, s.imageUrl ? [s.imageUrl] : [], cur.imageUrl ? [cur.imageUrl] : []),
        description: s.description || cur.description || null,
        amenities:
          s.amenities?.length ? s.amenities : cur.amenities?.length ? cur.amenities : [],
        lat: usableCoord(s.lat, s.lng)?.lat ?? usableCoord(cur.lat, cur.lng)?.lat ?? null,
        lng: usableCoord(s.lat, s.lng)?.lng ?? usableCoord(cur.lat, cur.lng)?.lng ?? null,
        address: sanitizeAddress(s.address) || sanitizeAddress(cur.address),
        contactPhone: s.contactPhone || cur.contactPhone || null,
        contactWhatsapp: s.contactWhatsapp || cur.contactWhatsapp || null,
        parking:
          s.parking && s.parking !== 'consultar' ? s.parking : cur.parking,
        areaM2: s.areaM2 ?? cur.areaM2 ?? null,
        metroStation:
          s.dataGaps && !s.dataGaps.metroEstimated
            ? s.metroStation
            : cur.dataGaps && !cur.dataGaps.metroEstimated
              ? cur.metroStation
              : s.metroStation || cur.metroStation,
        metroLine:
          s.dataGaps && !s.dataGaps.metroEstimated
            ? s.metroLine
            : cur.dataGaps && !cur.dataGaps.metroEstimated
              ? cur.metroLine
              : s.metroLine || cur.metroLine,
        metroWalkMin:
          s.dataGaps && !s.dataGaps.metroEstimated
            ? s.metroWalkMin
            : cur.dataGaps && !cur.dataGaps.metroEstimated
              ? cur.metroWalkMin
              : s.metroWalkMin ?? cur.metroWalkMin,
        connectivityScore:
          s.dataGaps && !s.dataGaps.metroEstimated
            ? s.connectivityScore
            : cur.connectivityScore ?? s.connectivityScore,
        dataGaps: {
          parkingUnknown: !(
            (s.parking && s.parking !== 'consultar') ||
            (cur.parking && cur.parking !== 'consultar')
          ),
          deliveryUnknown: !(
            (s.delivery && s.delivery !== 'consultar') ||
            (cur.delivery && cur.delivery !== 'consultar')
          ),
          metroEstimated: !(
            s.dataGaps?.metroEstimated === false ||
            cur.dataGaps?.metroEstimated === false
          ),
          locationEstimated: !(
            s.dataGaps?.locationEstimated === false ||
            cur.dataGaps?.locationEstimated === false
          ),
          locationSource:
            s.dataGaps?.locationEstimated === false
              ? s.dataGaps?.locationSource || 'ficha'
              : cur.dataGaps?.locationEstimated === false
                ? cur.dataGaps?.locationSource || 'ficha'
                : s.dataGaps?.locationSource ||
                  cur.dataGaps?.locationSource ||
                  null,
          priceIsDesde: true,
        },
        developer:
          betterDeveloper(s.developer) ||
          betterDeveloper(cur.developer) ||
          (s.developer || cur.developer || 'Consultar portal').replace(/\+/g, ' '),
        availability: s.availability === 'agotado' ? 'agotado' : 'disponible',
        delivery:
          cur.delivery && cur.delivery !== 'consultar' ? cur.delivery : s.delivery,
        notes: fromFicha ? s.notes : cur.notes || s.notes,
        propertyType: s.propertyType || cur.propertyType,
      })
      updated++
    } else if (byId.has(s.id)) {
      const cur = byId.get(s.id)
      byId.set(s.id, {
        ...cur,
        ...s,
        imageUrl: s.imageUrl || cur.imageUrl || null,
        images: mergeImages(s.images, cur.images, s.imageUrl ? [s.imageUrl] : [], cur.imageUrl ? [cur.imageUrl] : []),
        description: s.description || cur.description || null,
        amenities:
          s.amenities?.length ? s.amenities : cur.amenities?.length ? cur.amenities : [],
        lat: usableCoord(s.lat, s.lng)?.lat ?? usableCoord(cur.lat, cur.lng)?.lat ?? null,
        lng: usableCoord(s.lat, s.lng)?.lng ?? usableCoord(cur.lat, cur.lng)?.lng ?? null,
        address: sanitizeAddress(s.address) || sanitizeAddress(cur.address),
        contactPhone: s.contactPhone || cur.contactPhone || null,
        contactWhatsapp: s.contactWhatsapp || cur.contactWhatsapp || null,
        sources: mergeSources(cur.sources, s.sources?.[0]),
        subsidies: mergeSubsidies(cur.subsidies, s.subsidies),
      })
      updated++
    } else {
      byId.set(s.id, s)
      byKey.set(key, s.id)
      created++
    }
  }

  const catalog = [...byId.values()]
    .filter((p) => p.priceFromUf >= 500)
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))

  return { catalog, updated, created }
}

/**
 * A project that disappears from its own developer site is kept, but marked
 * agotado. A failed fetch does not count: Paz or Euro being down must not
 * hide projects that were still for sale.
 */
function markMissingAsAgotado(catalog, scraped) {
  const freshPortals = new Set(
    Object.entries(stats.sources)
      .filter(
        ([name, info]) => EXCLUSIVE_PORTALS.has(name) && info?.ok && info.count > 0,
      )
      .map(([name]) => name),
  )
  const liveKeys = new Set()
  for (const row of scraped) {
    const portal = row.sources?.[0]?.portal
    if (!stats.sources[portal]?.ok) continue
    liveKeys.add(row.id)
    liveKeys.add(`${portal}|${slugify(row.name)}|${slugify(row.comuna)}`)
    liveKeys.add(`${slugify(row.name)}|${slugify(row.comuna)}`)
  }

  let agotados = 0
  for (const project of catalog) {
    if (!project.availability) project.availability = 'disponible'
    const owned = [...new Set((project.sources || []).map((s) => s.portal))].filter((p) =>
      EXCLUSIVE_PORTALS.has(p),
    )
    const checked = owned.filter((p) => freshPortals.has(p))
    if (!checked.length || checked.length !== owned.length) continue
    const key = `${slugify(project.name)}|${slugify(project.comuna)}`
    const stillListed =
      liveKeys.has(project.id) ||
      checked.some((portal) => liveKeys.has(`${portal}|${key}`)) ||
      liveKeys.has(key)
    if (stillListed) continue
    if (project.availability !== 'agotado') agotados++
    project.availability = 'agotado'
    if (!/ya no aparece en el listado en venta/i.test(project.notes || '')) {
      project.notes = `${project.notes || ''} Ya no aparece en el listado en venta.`.trim()
    }
  }
  return agotados
}

function mergeSources(sources = [], incoming) {
  if (!incoming) return sources || []
  const list = [...(sources || [])]
  if (!list.some((s) => s.portal === incoming.portal && s.url === incoming.url)) {
    list.push(incoming)
  }
  return list
}

function serializeCatalog(catalog, ufClp, generatedAt) {
  const body = JSON.stringify(catalog, null, 2)
  return `/** Auto-generated by scripts/update-catalog.mjs — ${generatedAt} */
export const UF_CLP = ${ufClp}

/**
 * connectivityScore (1–5): ranking de acceso a Metro de Santiago.
 * 5 = ≤8 min a pie · 4 = ≤15 · 3 = ≤25 o combinación bus+metro
 * 2 = lejos / estación futura · 1 = sin metro · null = fuera de RM
 */
export const catalog = ${body}

export const catalogMeta = {
  generatedAt: ${JSON.stringify(generatedAt)},
  ufClp: UF_CLP,
  disclaimer:
    'Precios “desde”, cupos y tipologías cambian. Confirma siempre en el aviso original y en sala de ventas / SERVIU antes de postular o reservar.',
}
`
}

async function loadExistingCatalog() {
  if (!existsSync(CATALOG_PATH)) return []
  const mod = await import(pathToFileURL(CATALOG_PATH).href + `?t=${Date.now()}`)
  return mod.catalog || []
}

async function main() {
  const generatedAt = new Date().toISOString().slice(0, 10)
  console.log('Cajas de Fósforos multi-source update', generatedAt)

  const uf = await fetchUf()
  const ufClp = uf.ufClp
  console.log(uf.ok ? 'UF del día:' : 'UF anterior:', ufClp)
  stats.sources.mindicador = uf.ok
    ? { ok: true, ufClp }
    : { ok: false, error: uf.error, ufClp, fallback: true }

  const only = (process.env.ONLY || '').toLowerCase()
  const scrapedBatches =
    only === 'locations'
      ? [await enrichLocations(await loadExistingCatalog())]
      : only === 'details'
      ? [await enrichAllExistingDetails(await loadExistingCatalog())]
      : only === 'uts' || process.env.UTS_ONLY === '1'
      ? [await safeSource('usatusubsidio', () => scrapeUsaTuSubsidio(20))]
      : only === 'subsidios'
        ? [await safeSource('subsidios-cl', () => scrapeSubsidios(20))]
        : only === 'photos'
          ? await Promise.all([
              safeSource('subsidios-cl', () => scrapeSubsidios(20)),
              safeSource('los-silos', () => scrapeSilos()),
              safeSource('ingevec', () => scrapeIngevec()),
              safeSource('enlace-bci', () => scrapeBci()),
              safeSource('ciclos', () => scrapeCiclos()),
              safeSource('bricsa', () => scrapeBricsa()),
              safeSource('galilea', () => scrapeGalilea()),
            ])
        : await Promise.all([
    safeSource('subsidios-cl', () => scrapeSubsidios(20)),
    safeSource('usatusubsidio', () => scrapeUsaTuSubsidio(20)),
    safeSource('enlace-bci', () => scrapeBci()),
    safeSource('los-silos', () => scrapeSilos()),
    safeSource('ingevec', () => scrapeIngevec()),
    safeSource('ciclos', () => scrapeCiclos()),
    safeSource('euro', () => scrapeEuro()),
    safeSource('ecomac', () => scrapeEcomac()),
    safeSource('socovesa', () => scrapeSocovesa()),
    safeSource('paz', () => scrapePaz()),
    safeSource('aitue', () => scrapeAitue()),
    safeSource('bricsa', () => scrapeBricsa()),
    safeSource('galilea', () => scrapeGalilea()),
    safeSource('santolaya', () => scrapeSantolaya()),
    safeSource('fundamenta', () => scrapeFundamenta()),
    safeSource('deisa', () => scrapeDeisa()),
    safeSource('py', () => scrapePy()),
    safeSource('besalco', () => scrapeBesalco()),
  ])

  const scraped = scrapedBatches.flat()
  console.log('Total scraped rows:', scraped.length)

  const existing =
    only === 'details' || only === 'locations' ? [] : await loadExistingCatalog()
  console.log('Catálogo actual:', existing.length)

  const { catalog, updated, created } =
    only === 'details' || only === 'locations'
      ? {
          catalog: scraped
            .filter((p) => p.priceFromUf >= 500)
            .sort((a, b) => a.name.localeCompare(b.name, 'es')),
          updated: scraped.length,
          created: 0,
        }
      : mergeCatalog(existing, scraped)
  const agotados =
    only === 'details' || only === 'locations'
      ? 0
      : markMissingAsAgotado(catalog, scraped)
  writeFileSync(CATALOG_PATH, serializeCatalog(catalog, ufClp, generatedAt))
  writeFileSync(
    META_PATH,
    JSON.stringify(
      {
        generatedAt,
        ufClp,
        scraped: scraped.length,
        catalogSize: catalog.length,
        updated,
        created,
        agotados,
        sources: stats.sources,
      },
      null,
      2,
    ),
  )

  console.log(
    `OK catalog=${catalog.length} updated=${updated} created=${created} agotados=${agotados}`,
  )
  console.log(JSON.stringify(stats.sources, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
