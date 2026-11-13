#!/usr/bin/env node
/**
 * Write street-coords.json hits into src/data/catalog.js without a full rescrape.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { lookupStreetPin, streetPinIsExact } from './lib/street-pin.mjs'

const ROOT = path.resolve(import.meta.dirname, '..')
const CATALOG_PATH = path.join(ROOT, 'src/data/catalog.js')
const catalogMod = await import(pathToFileURL(path.join(ROOT, 'src/data/catalog.js')).href)
const table = JSON.parse(readFileSync(path.join(ROOT, 'src/data/street-coords.json'), 'utf8'))
const localities = JSON.parse(
  readFileSync(path.join(ROOT, 'src/data/locality-coords.json'), 'utf8'),
)

function setJsonField(block, field, value) {
  const re = new RegExp(
    `"${field}": (?:null|true|false|"(?:[^"\\\\]|\\\\.)*"|-?\\d+(?:\\.\\d+)?)`,
  )
  const encoded =
    value === null
      ? 'null'
      : typeof value === 'number' || typeof value === 'boolean'
        ? String(value)
        : JSON.stringify(value)
  if (!re.test(block)) throw new Error(`missing ${field}`)
  return block.replace(re, `"${field}": ${encoded}`)
}

function patchId(src, id, mutate) {
  const marker = `"id": "${id}"`
  const at = src.indexOf(marker)
  if (at < 0) throw new Error(`missing id ${id}`)
  const start = src.lastIndexOf('{', at)
  let depth = 0
  let end = -1
  for (let i = start; i < src.length; i++) {
    const ch = src[i]
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) {
        end = i + 1
        break
      }
    }
  }
  if (end < 0) throw new Error(`unclosed ${id}`)
  const next = mutate(src.slice(start, end))
  return src.slice(0, start) + next + src.slice(end)
}

function applyPin(block, { lat, lng, estimated, source, address }) {
  let next = setJsonField(block, 'lat', lat)
  next = setJsonField(next, 'lng', lng)
  next = setJsonField(next, 'locationEstimated', estimated)
  next = setJsonField(next, 'locationSource', source)
  if (address && /"address": null/.test(next))
    next = setJsonField(next, 'address', address)
  return next
}

let src = readFileSync(CATALOG_PATH, 'utf8')
const changed = []

for (const item of catalogMod.catalog) {
  const pin = lookupStreetPin(table, item)
  if (!pin) continue
  const exact = streetPinIsExact(pin, item)
  src = patchId(src, item.id, (block) =>
    applyPin(block, {
      lat: pin.lat,
      lng: pin.lng,
      estimated: !exact,
      source: 'calle',
    }),
  )
  changed.push(`${item.name} → ${pin.lat}, ${pin.lng} (${exact ? 'exacta' : 'calle'})`)
}

const sectorFixes = [
  {
    id: 'uts-aires-de-renaca',
    key: 'renaca-alto',
  },
  {
    id: 'uts-sol-de-penuelas',
    key: 'penuelas-coquimbo',
  },
]
for (const fix of sectorFixes) {
  const loc = localities[fix.key]
  src = patchId(src, fix.id, (block) =>
    applyPin(block, {
      lat: loc.lat,
      lng: loc.lng,
      estimated: true,
      source: `sector:${fix.key}`,
    }),
  )
  changed.push(`${fix.id} → sector ${fix.key}`)
}

src = patchId(src, 'aitue-edificio-huertos-las-margaritas', (block) => {
  let next = block
  next = setJsonField(next, 'region', 'Biobío')
  next = setJsonField(next, 'comuna', 'San Pedro de la Paz')
  next = setJsonField(next, 'connectivityScore', 4)
  next = setJsonField(next, 'accessKind', 'regional')
  next = setJsonField(next, 'accessMode', 'biotren')
  next = setJsonField(next, 'accessLabel', 'Biotrén · San Pedro de la Paz')
  next = setJsonField(next, 'accessDetail', 'Estaciones Biotrén / acceso Concepción')
  return next
})
changed.push('Huertos Las Margaritas → San Pedro de la Paz')

src = patchId(src, 'euro-diagonal-vicuna', (block) =>
  setJsonField(block, 'address', 'Santa Elena 2000'),
)
src = patchId(src, 'euro-vista-portugal', (block) =>
  setJsonField(block, 'address', 'Portugal 755'),
)
src = patchId(src, 'uts-santa-elena-1670', (block) =>
  setJsonField(block, 'address', 'Santa Elena 1670'),
)

writeFileSync(CATALOG_PATH, src)
console.log(changed.join('\n'))
console.log('updated', changed.length)
