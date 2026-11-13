#!/usr/bin/env node
/**
 * Fill src/data/street-coords.json for projects stuck on a comuna centroid.
 * One Nominatim request per second. Re-run when new street names appear.
 *
 *   node scripts/geocode-street-pins.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  geocodeAcceptable,
  streetFromAddress,
  streetFromName,
  streetPinKey,
} from './lib/street-pin.mjs'

const ROOT = path.resolve(import.meta.dirname, '..')
const OUT = path.join(ROOT, 'src/data/street-coords.json')
const UA = 'CajasDeFosforosBot/1.4 (street pin geocode; contact via github)'

const catalogMod = await import(pathToFileURL(path.join(ROOT, 'src/data/catalog.js')).href)
const catalog = catalogMod.catalog
const comunas = JSON.parse(readFileSync(path.join(ROOT, 'src/data/comuna-coords.json'), 'utf8'))
const comunaNames = [...new Set(Object.keys(comunas).map((k) => k.split('|')[0]))]

function centroidOf(item) {
  return comunas[`${item.comuna}|${item.region}`] || null
}

function dist(a, b) {
  if (!a || b?.lat == null) return Infinity
  const p = Math.PI / 180
  const dLat = (b.lat - a.lat) * p
  const dLng = (b.lng - a.lng) * p
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * p) * Math.cos(b.lat * p) * Math.sin(dLng / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(s))
}

const queries = []
for (const item of catalog) {
  const c = centroidOf(item)
  if (!c || item.lat == null) continue
  if (dist({ lat: item.lat, lng: item.lng }, c) > 0.2) continue
  if (item.dataGaps?.locationEstimated === false) continue
  const parsed = streetFromName(item.name, item.comuna) || streetFromAddress(item.address)
  if (!parsed) continue
  const key = streetPinKey(parsed.street, parsed.number, item.comuna)
  if (!key) continue
  queries.push({ key, item, parsed, centroid: c })
}

const manual = [
  {
    key: 'id:euro-diagonal-vicuna',
    query: 'Santa Elena 2000, Santiago, Chile',
    streetQuery: { street: 'Santa Elena', number: '2000', city: 'Santiago' },
    comuna: 'Santiago',
    street: 'Santa Elena',
    centroid: comunas['Santiago|Metropolitana'],
  },
  {
    key: 'id:euro-vista-portugal',
    query: 'Portugal 755, Santiago, Chile',
    streetQuery: { street: 'Portugal', number: '755', city: 'Santiago' },
    comuna: 'Santiago',
    street: 'Portugal',
    centroid: comunas['Santiago|Metropolitana'],
  },
  {
    key: 'id:borinquen-vina',
    lat: -33.0481684,
    lng: -71.5651539,
    display: 'Condominio Borinquén, Viña del Mar (mapa del aviso)',
    precision: 'point',
  },
  {
    key: 'id:aitue-edificio-huertos-las-margaritas',
    lat: -36.8364923,
    lng: -73.1075815,
    display: 'Edificio Huertos Las Margaritas, San Pedro de la Paz (mapa del aviso)',
    precision: 'point',
  },
]

async function nominatim(params) {
  const url =
    'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=3&countrycodes=cl&addressdetails=1&' +
    params
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const table = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : {}

for (const q of queries) {
  if (table[q.key]?.lat != null) {
    console.log('keep', q.key)
    continue
  }
  const params =
    `street=${encodeURIComponent(`${q.parsed.street} ${q.parsed.number}`)}` +
    `&city=${encodeURIComponent(q.item.comuna)}`
  let hits = []
  try {
    hits = await nominatim(params)
  } catch (err) {
    console.warn('fail', q.key, err.message)
  }
  const ok = hits.find((h) =>
    geocodeAcceptable(h, {
      comuna: q.item.comuna,
      centroid: q.centroid,
      street: q.parsed.street,
      number: q.parsed.number,
      comunas: comunaNames,
    }),
  )
  if (!ok) {
    console.log('REJECT', q.item.name, '|', q.item.comuna, '|', hits[0]?.display_name || 'none')
  } else {
    table[q.key] = {
      lat: Number(ok.lat),
      lng: Number(ok.lon),
      display: ok.display_name,
      precision: ok.addresstype === 'house' || ok.type === 'house' ? 'house' : 'street',
    }
    console.log('OK', q.key, table[q.key].lat, table[q.key].lng, ok.display_name.slice(0, 100))
  }
  await sleep(1100)
}

for (const m of manual) {
  if (m.lat != null) {
    table[m.key] = {
      lat: m.lat,
      lng: m.lng,
      display: m.display,
      precision: m.precision || 'point',
    }
    console.log('MANUAL', m.key)
    continue
  }
  if (table[m.key]?.lat != null) continue
  const params = m.streetQuery
    ? `street=${encodeURIComponent(`${m.streetQuery.street} ${m.streetQuery.number}`)}&city=${encodeURIComponent(m.streetQuery.city)}${m.extra || ''}`
    : `q=${encodeURIComponent(m.query)}`
  const hits = await nominatim(params)
  const ok = hits.find((h) =>
    geocodeAcceptable(h, {
      comuna: m.comuna,
      centroid: m.centroid,
      street: m.street,
      number: m.streetQuery?.number,
      comunas: comunaNames,
    }),
  )
  if (!ok) console.log('REJECT manual', m.key, hits[0]?.display_name || 'none')
  else {
    table[m.key] = {
      lat: Number(ok.lat),
      lng: Number(ok.lon),
      display: ok.display_name,
      precision: ok.type === 'house' ? 'house' : 'street',
    }
    console.log('OK', m.key, table[m.key].lat, table[m.key].lng)
  }
  await sleep(1100)
}

writeFileSync(OUT, JSON.stringify(table, null, 2) + '\n')
console.log('wrote', Object.keys(table).length, 'pins')
