#!/usr/bin/env node
/**
 * Actualiza el catálogo UnPortal desde fuentes públicas:
 * - UF del día: https://mindicador.cl/api/uf
 * - Listados: https://www.subsidios.cl/proyectos?page=N
 *
 * Uso: node scripts/update-catalog.mjs
 */
import { writeFileSync, readFileSync, existsSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const CATALOG_PATH = path.join(ROOT, 'src/data/catalog.js')
const META_PATH = path.join(ROOT, 'src/data/update-meta.json')

const UA =
  'UnPortalBot/1.0 (+https://github.com/claudiojaviermeza-creator/casa-al-metro; daily catalog refresh)'

const COMUNA_REGION = {
  Santiago: 'Metropolitana',
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
  Ñuñoa: 'Metropolitana',
  Providencia: 'Metropolitana',
  Rancagua: "O'Higgins",
  'San Felipe': 'Valparaíso',
  Casablanca: 'Valparaíso',
  'Viña del Mar': 'Valparaíso',
  Coquimbo: 'Coquimbo',
  'Puerto Montt': 'Los Lagos',
  Osorno: 'Los Lagos',
  Limache: 'Valparaíso',
  Talca: 'Maule',
  'San Ramón': 'Metropolitana',
}

const COMUNA_METRO = {
  'San Joaquín': { station: 'San Joaquín', line: 'L5', walk: 12, score: 4 },
  Cerrillos: { station: 'Cerrillos', line: 'L6', walk: 18, score: 4 },
  Maipú: { station: 'Plaza de Maipú', line: 'L5', walk: 14, score: 4 },
  'San Miguel': { station: 'San Miguel', line: 'L2', walk: 10, score: 5 },
  Santiago: { station: 'Universidad de Chile', line: 'L1', walk: 10, score: 5 },
  Quilicura: { station: 'Quilicura', line: 'L3', walk: 18, score: 3 },
  Pudahuel: { station: 'San Pablo', line: 'L1', walk: 20, score: 3 },
  Renca: { station: 'Lo Prado', line: 'L5', walk: 22, score: 3 },
  'Puente Alto': { station: 'Las Mercedes', line: 'L4', walk: 18, score: 3 },
  'La Pintana': { station: 'Santa Rosa', line: 'L4', walk: 25, score: 2 },
  'La Granja': { station: 'Santa Rosa', line: 'L4', walk: 20, score: 3 },
  'El Bosque': { station: 'El Bosque', line: 'L2', walk: 10, score: 4 },
  Conchalí: { station: 'Vivaceta', line: 'L2', walk: 14, score: 4 },
  Huechuraba: { station: 'Vespucio Norte', line: 'L2', walk: 20, score: 3 },
  'San Bernardo': { station: null, line: null, walk: null, score: 2 },
  Colina: { station: null, line: null, walk: null, score: 1 },
  Buin: { station: null, line: null, walk: null, score: 1 },
  Peñaflor: { station: null, line: null, walk: null, score: 1 },
}

function slugify(text) {
  return String(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function parseDorms(text) {
  const nums = [...String(text).matchAll(/(\d+)/g)].map((m) => Number(m[1]))
  if (!nums.length) return { min: 1, max: 2 }
  return { min: Math.min(...nums), max: Math.max(...nums) }
}

/** Chile often writes UF 1.900 meaning one thousand nine hundred. */
function parseChileUf(raw) {
  const s = String(raw).trim().replace(/,/g, '.')
  // 1.900 / 12.500 → thousands
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    return Number(s.replace(/\./g, ''))
  }
  // bare integer
  if (/^\d+$/.test(s)) return Number(s)
  // fallback: strip all dots (safer for listing prices than JS float)
  const digits = s.replace(/\./g, '')
  const n = Number(digits)
  return Number.isFinite(n) ? n : 0
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'text/html,application/json' },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  return res.text()
}

async function fetchUf() {
  const raw = await fetchText('https://mindicador.cl/api/uf')
  const data = JSON.parse(raw)
  const value = data?.serie?.[0]?.valor
  if (!value) throw new Error('UF value missing from mindicador.cl')
  return Math.round(value)
}

function extractProjectsFromHtml(html) {
  const projects = []
  const seen = new Set()

  // Cards look like: href="/proyecto/512/slug" ... name span ... comuna ... dorms ... Desde UF X
  const re =
    /href="(\/proyecto\/(\d+)\/([^"]+))"[\s\S]{0,2500}?color-sub-title[^>]*>\s*([\s\S]*?)\s*<\/span>[\s\S]{0,400}?color:\s*#707070[^>]*>\s*([\s\S]*?)\s*<\/span>[\s\S]{0,400}?color:\s*#707070[^>]*>\s*([\s\S]*?dorms\.)\s*<\/span>[\s\S]{0,400}?Desde UF\s*([\d.]+)/gi

  let m
  while ((m = re.exec(html))) {
    const [, pathUrl, idNum, slug, nameHtml, comunaHtml, dormsText, uf] = m
    if (seen.has(idNum)) continue
    seen.add(idNum)
    const name = nameHtml.replace(/<[^>]+>/g, '').trim()
    const comuna = comunaHtml.replace(/<[^>]+>/g, '').trim()
    const dorms = parseDorms(dormsText)
    if (!name || !uf) continue
    projects.push({
      sourceId: idNum,
      slug,
      name,
      comuna: comuna || 'Chile',
      priceFromUf: parseChileUf(uf),
      bedroomsMin: dorms.min,
      bedroomsMax: dorms.max,
      url: `https://www.subsidios.cl${pathUrl}`,
    })
  }

  return projects
}

async function scrapeSubsidios(maxPages = 5) {
  const all = []
  const seen = new Set()
  for (let page = 1; page <= maxPages; page++) {
    const url =
      page === 1
        ? 'https://www.subsidios.cl/proyectos'
        : `https://www.subsidios.cl/proyectos?page=${page}`
    try {
      const html = await fetchText(url)
      const batch = extractProjectsFromHtml(html)
      if (!batch.length) break
      let added = 0
      for (const p of batch) {
        if (seen.has(p.sourceId)) continue
        seen.add(p.sourceId)
        all.push(p)
        added++
      }
      console.log(`subsidios.cl page ${page}: +${added} (total ${all.length})`)
      if (added === 0) break
    } catch (err) {
      console.warn(`subsidios.cl page ${page} failed:`, err.message)
      break
    }
  }
  return all
}

function loadExistingCatalog() {
  if (!existsSync(CATALOG_PATH)) return []
  // Dynamic import of current catalog
  return import(pathToFileURL(CATALOG_PATH).href).then((m) => m.catalog || [])
}

function mergeCatalog(existing, scraped, ufClp) {
  const bySlug = new Map()
  const byNameComuna = new Map()

  for (const item of existing) {
    bySlug.set(item.id, { ...item })
    byNameComuna.set(`${slugify(item.name)}|${slugify(item.comuna)}`, item.id)
  }

  let updated = 0
  let created = 0

  for (const s of scraped) {
    const key = `${slugify(s.name)}|${slugify(s.comuna)}`
    const existingId = byNameComuna.get(key) || slugify(s.name)
    const current = bySlug.get(existingId)

    if (current) {
      const next = {
        ...current,
        priceFromUf: s.priceFromUf || current.priceFromUf,
        bedroomsMin: s.bedroomsMin || current.bedroomsMin,
        bedroomsMax: s.bedroomsMax || current.bedroomsMax,
        sources: mergeSources(current.sources, {
          portal: 'subsidios-cl',
          url: s.url,
        }),
      }
      if (!next.subsidies?.length) next.subsidies = ['DS19']
      bySlug.set(existingId, next)
      updated++
    } else {
      const metro = COMUNA_METRO[s.comuna] || {
        station: null,
        line: null,
        walk: null,
        score: COMUNA_REGION[s.comuna] === 'Metropolitana' ? 2 : null,
      }
      const id = `sub-${s.sourceId}-${slugify(s.name)}`.slice(0, 80)
      bySlug.set(id, {
        id,
        name: s.name,
        developer: 'Consultar portal',
        region: COMUNA_REGION[s.comuna] || 'Metropolitana',
        comuna: s.comuna,
        propertyType: 'departamento',
        condition: 'nuevo',
        subsidies: ['DS19'],
        priceFromUf: s.priceFromUf,
        priceToUf: s.priceFromUf,
        bedroomsMin: s.bedroomsMin,
        bedroomsMax: s.bedroomsMax,
        bathroomsMin: 1,
        bathroomsMax: s.bedroomsMax >= 3 ? 2 : 1,
        parking: 'consultar',
        delivery: 'consultar',
        metroStation: metro.station,
        metroLine: metro.line,
        metroWalkMin: metro.walk,
        connectivityScore: metro.score,
        sources: [{ portal: 'subsidios-cl', url: s.url }],
        notes: 'Importado automáticamente desde Subsidios.cl',
      })
      created++
    }
  }

  const catalog = [...bySlug.values()].sort((a, b) =>
    a.name.localeCompare(b.name, 'es'),
  )

  return { catalog, updated, created, ufClp }
}

function mergeSources(sources = [], incoming) {
  const list = [...sources]
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
    'Catálogo curado/actualizado desde fichas públicas (Subsidios.cl, Enlace/BancoEstado, UsaTuSubsidio e inmobiliarias). Cupos, precios y tipologías cambian: confirma siempre en el portal de origen y sala de ventas.',
}
`
}

async function main() {
  const generatedAt = new Date().toISOString().slice(0, 10)
  console.log('UnPortal catalog update', generatedAt)

  const ufClp = await fetchUf()
  console.log('UF del día:', ufClp)

  const scraped = await scrapeSubsidios(6)
  console.log('Proyectos scrapeados:', scraped.length)

  const existing = await loadExistingCatalog()
  console.log('Catálogo actual:', existing.length)

  const { catalog, updated, created } = mergeCatalog(existing, scraped, ufClp)
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
        source: 'subsidios.cl + mindicador.cl',
      },
      null,
      2,
    ),
  )

  console.log(
    `OK catalog=${catalog.length} updated=${updated} created=${created} -> ${CATALOG_PATH}`,
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
