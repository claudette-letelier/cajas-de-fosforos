#!/usr/bin/env node
/**
 * Actualiza el catálogo UnPortal desde el máximo de fuentes públicas scrapeables.
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
 *
 * Uso: node scripts/update-catalog.mjs
 */
import { writeFileSync, existsSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const CATALOG_PATH = path.join(ROOT, 'src/data/catalog.js')
const META_PATH = path.join(ROOT, 'src/data/update-meta.json')

const UA =
  'UnPortalBot/1.2 (+https://github.com/claudiojaviermeza-creator/casa-al-metro; daily multi-source refresh)'

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
  'Los Ángeles': 'Biobío',
  Temuco: 'La Araucanía',
  Valdivia: 'Los Ríos',
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
  Pudahuel: { station: 'San Pablo', line: 'L1', walk: 20, score: 3 },
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

async function fetchUf() {
  const data = await fetchJson('https://mindicador.cl/api/uf')
  const value = data?.serie?.[0]?.valor
  if (!value) throw new Error('UF value missing')
  return Math.round(value)
}

function normalizeRegion(raw) {
  const decoded = decodeHtml(raw || '')
  return REGION_ALIASES[decoded] || REGION_ALIASES[raw] || decoded
}

function normalizeItem(partial) {
  let comuna = decodeHtml(partial.comuna || 'Chile')
  if (comuna === 'Santiago Centro') comuna = 'Santiago'
  const region = normalizeRegion(
    partial.region ||
      COMUNA_REGION[comuna] ||
      COMUNA_REGION[partial.comuna] ||
      (partial.regionHint ? partial.regionHint : 'Metropolitana'),
  )
  const metro =
    COMUNA_METRO[comuna] ||
    (region === 'Metropolitana'
      ? { station: null, line: null, walk: null, score: 2 }
      : { station: null, line: null, walk: null, score: null })

  const bedroomsMin = partial.bedroomsMin ?? 1
  const bedroomsMax = partial.bedroomsMax ?? Math.max(bedroomsMin, 2)
  const price = partial.priceFromUf || 0

  return {
    id: partial.id || `${partial.portal}-${slugify(partial.name)}`,
    name: partial.name,
    developer: partial.developer || 'Consultar portal',
    region,
    comuna,
    propertyType: partial.propertyType || 'departamento',
    condition: partial.condition || 'nuevo',
    subsidies: partial.subsidies?.length ? partial.subsidies : ['DS19'],
    priceFromUf: price,
    priceToUf: partial.priceToUf || price,
    bedroomsMin,
    bedroomsMax,
    bathroomsMin: partial.bathroomsMin ?? 1,
    bathroomsMax: partial.bathroomsMax ?? (bedroomsMax >= 3 ? 2 : 1),
    parking: partial.parking || 'consultar',
    delivery: partial.delivery || 'consultar',
    metroStation: partial.metroStation ?? metro.station,
    metroLine: partial.metroLine ?? metro.line,
    metroWalkMin: partial.metroWalkMin ?? metro.walk,
    connectivityScore: partial.connectivityScore ?? metro.score,
    sources: partial.sources || [{ portal: partial.portal, url: partial.url }],
    notes: partial.notes || `Importado desde ${partial.portal}`,
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
        notes: 'Importado desde Subsidios.cl',
      }),
    )
  }
  return projects
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
  return all
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
    if (!slug || !name || !priceRaw) continue

    let comuna = 'Chile'
    let regionHint = 'Metropolitana'
    if (locRaw?.includes('/')) {
      const [c, r] = locRaw.split('/').map((x) => x.trim())
      comuna = c
      regionHint = r
    } else if (locRaw) comuna = locRaw

    const subsidies = []
    const s = subsidyHint.toLowerCase()
    if (s.includes('ds19')) subsidies.push('DS19')
    if (s.includes('ds1-tramo-2') || s.includes('tramo-2')) subsidies.push('DS1 Tramo 2')
    if (s.includes('ds1-tramo-3') || s.includes('tramo-3')) subsidies.push('DS1 Tramo 3')
    if (s.includes('ds1') && !subsidies.some((x) => x.includes('DS1'))) subsidies.push('DS1')
    if (s.includes('ds49')) subsidies.push('DS49')
    if (!subsidies.length) subsidies.push('DS19')

    out.push(
      normalizeItem({
        id: `uts-${slug}`,
        portal: 'usatusubsidio',
        name,
        comuna,
        region: COMUNA_REGION[comuna] || regionHint || 'Metropolitana',
        developer: developer ? decodeURIComponent(developer) : 'Consultar portal',
        priceFromUf: parseChileUf(priceRaw),
        subsidies,
        url: `https://usatusubsidio.cl/propiedades/${slug}/`,
        notes: 'Importado desde UsaTuSubsidio',
      }),
    )
  }
  return out
}

async function scrapeUsaTuSubsidio(maxPages = 20) {
  const seeds = [
    ...Array.from({ length: maxPages }, (_, i) => `https://usatusubsidio.cl/propiedades/?page=${i + 1}`),
    'https://usatusubsidio.cl/propiedades/?subsidio=ds19',
    'https://usatusubsidio.cl/propiedades/?subsidio=ds1-tramo-2',
    'https://usatusubsidio.cl/propiedades/?subsidio=ds1-tramo-3',
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
  return all
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
  return all
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

async function scrapeSilos() {
  const html = await fetchText('https://ilossilos.cl/los-silos-proyectos-subsidios/')
  return extractSilos(html)
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
    const window = html.slice(Math.max(0, idx - 400), idx + 1200)
    const uf = window.match(/UF\s*([\d.]+)/i)?.[1]
    const name = `Ingevec ${slug
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')}`
    out.push(
      normalizeItem({
        id: `ingevec-${slug}`,
        portal: 'ingevec',
        name,
        comuna: 'Santiago',
        region: 'Metropolitana',
        developer: 'Ingevec Inmobiliaria',
        priceFromUf: uf ? parseChileUf(uf) : 2500,
        subsidies: window.toLowerCase().includes('ds19') ? ['DS19'] : ['Sin subsidio'],
        url,
        notes: 'Importado desde Ingevec',
        connectivityScore: 4,
      }),
    )
  }
  return out
}

async function scrapeIngevec() {
  const html = await fetchText('https://ingevecinmobiliaria.cl/proyectos-en-venta')
  return extractIngevec(html)
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
          bedroomsMin: 1,
          bedroomsMax: 3,
          notes: 'Importado desde Ciclos / sitio del proyecto',
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
        subsidies: hasSub ? ['DS19', 'DS1'] : ['Sin subsidio'],
        delivery: p.entrega || 'consultar',
        url: `https://www.euroinmobiliaria.cl/proyectos/${p.slug}`,
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
        notes: 'Importado desde API Ecomac',
      })
    })
}

/* -------------------- Socovesa -------------------- */
async function scrapeSocovesa() {
  const html = await fetchText('https://www.socovesa.cl/proyectos')
  const out = []
  const re =
    /<div class="card_proyecto"([^>]*)>[\s\S]*?<h4>([^<]+)<\/h4>[\s\S]*?href="(https:\/\/www\.socovesa\.cl\/nuestros-proyectos\/[^"]+)"/g
  let m
  while ((m = re.exec(html))) {
    const [, attrs, nameHtml, url] = m
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
        notes: 'Importado desde Socovesa',
      }),
    )
  }
  return out
}

/* -------------------- Paz API -------------------- */
async function scrapePaz() {
  const rows = await fetchJson('https://api.paz.cl/api/proyectos')
  if (!Array.isArray(rows)) throw new Error('Paz API unexpected shape')
  return rows
    .map((p) => {
      const price = Math.round(Number(p.precio_desde) || 0)
      if (!price || price < 500) return null
      const name = p.nombre_proyecto || p.edificio
      const slug = slugify(p.edificio || name)
      const hasTasa = Boolean(p.logoSubsidioTasa)
      const subsidies = hasTasa ? ['Sin subsidio'] : ['Sin subsidio']
      // Paz rarely marks DS19; keep as mercado abierto, flag tasa if present in notes
      const notes = hasTasa
        ? 'Importado desde Paz (posible subsidio a la tasa)'
        : 'Importado desde API Paz'
      const dorms = parseDorms(p.cantidad_dormitorios || '1-2')
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
    // Aitue: subsidio a la tasa available sitewide; DS19 not always. Tag mid-market as Sin subsidio unless name hints.
    const subsidies = /subsidio|ds19/i.test(b) ? ['DS19'] : ['Sin subsidio']
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
          notes: 'Importado desde Bricsa',
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
      const hasSub = /subsidio|DS\s*19/i.test(html)
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
          subsidies: hasSub ? ['DS19'] : ['Sin subsidio'],
          url,
          bedroomsMin: 2,
          bedroomsMax: 3,
          notes: 'Importado desde Galilea',
        }),
      )
    } catch (err) {
      console.warn('  galilea fail', url, err.message)
    }
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
      byId.set(existingId, {
        ...cur,
        priceFromUf: s.priceFromUf || cur.priceFromUf,
        priceToUf: s.priceToUf || cur.priceToUf || s.priceFromUf || cur.priceFromUf,
        bedroomsMin: Math.min(cur.bedroomsMin ?? 99, s.bedroomsMin ?? 99) || cur.bedroomsMin,
        bedroomsMax: Math.max(cur.bedroomsMax ?? 0, s.bedroomsMax ?? 0) || cur.bedroomsMax,
        subsidies: uniqueSubsidies([...(cur.subsidies || []), ...(s.subsidies || [])]),
        sources: mergeSources(cur.sources, s.sources?.[0]),
        developer:
          cur.developer && cur.developer !== 'Consultar portal'
            ? cur.developer
            : s.developer,
        delivery:
          cur.delivery && cur.delivery !== 'consultar' ? cur.delivery : s.delivery,
      })
      updated++
    } else if (byId.has(s.id)) {
      const cur = byId.get(s.id)
      byId.set(s.id, {
        ...cur,
        ...s,
        sources: mergeSources(cur.sources, s.sources?.[0]),
        subsidies: uniqueSubsidies([...(cur.subsidies || []), ...(s.subsidies || [])]),
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

function uniqueSubsidies(list) {
  return [...new Set(list.filter(Boolean))]
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
    'Catálogo actualizado desde fuentes públicas (Subsidios.cl, UsaTuSubsidio, Enlace/BCI, Los Silos, Ingevec, Ciclos, Euro, Ecomac, Socovesa, Paz, Aitue, Bricsa, Galilea, mindicador.cl). Cupos y precios cambian: confirma en el portal de origen.',
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
  console.log('UnPortal multi-source update', generatedAt)

  const ufClp = await fetchUf()
  console.log('UF del día:', ufClp)
  stats.sources.mindicador = { ok: true, ufClp }

  const scrapedBatches = await Promise.all([
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
  ])

  const scraped = scrapedBatches.flat()
  console.log('Total scraped rows:', scraped.length)

  const existing = await loadExistingCatalog()
  console.log('Catálogo actual:', existing.length)

  const { catalog, updated, created } = mergeCatalog(existing, scraped)
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
        sources: stats.sources,
      },
      null,
      2,
    ),
  )

  console.log(`OK catalog=${catalog.length} updated=${updated} created=${created}`)
  console.log(JSON.stringify(stats.sources, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
