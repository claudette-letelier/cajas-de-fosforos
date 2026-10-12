import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  extractAddress,
  extractCoords,
  sanitizeAddress,
} from '../scripts/lib/html-location.mjs'

describe('extractCoords', () => {
  it('parses Subsidios.cl quoted latitude/longitude', () => {
    const html = `"slug":"lomas-de-landa","address":"Camino a Penco Ruta 150","latitude":"-36.809505","longitude":"-73.028382","type_property":"department"`
    const c = extractCoords(html)
    assert.ok(c)
    assert.equal(c.lat, -36.809505)
    assert.equal(c.lng, -73.028382)
  })

  it('parses Fuentes de San Pedro coords', () => {
    const html = `"address":"Avenida Bosquemar 50","latitude":"-36.886128","longitude":"-73.143133"`
    const c = extractCoords(html)
    assert.deepEqual(c, { lat: -36.886128, lng: -73.143133 })
  })

  it('rejects coords outside Chile', () => {
    assert.equal(extractCoords('"latitude":"40.7","longitude":"-74.0"'), null)
  })

  it('prefers quoted Subsidios coords over weaker @lat,lng', () => {
    const html = `@-33.45,-70.66 "latitude":"-36.809505","longitude":"-73.028382"`
    const c = extractCoords(html)
    assert.equal(c.lat, -36.809505)
  })

  it('reads Waze links even when the ampersand is an HTML entity', () => {
    const html = `href="https://waze.com/ul?ll=-33.04816840%2C-71.56515390&#038;navigate=yes"`
    const c = extractCoords(html)
    assert.equal(c.lat, -33.0481684)
    assert.equal(c.lng, -71.5651539)
  })
})

describe('extractAddress', () => {
  it('reads address next to latitude in Subsidios JSON', () => {
    const html = `"address":"Camino a Penco Ruta 150","latitude":"-36.809505"`
    assert.equal(extractAddress(html), 'Camino a Penco Ruta 150')
  })

  it('reads Avenida Bosquemar 50', () => {
    const html = `"address":"Avenida Bosquemar 50","latitude":"-36.886128"`
    assert.equal(extractAddress(html), 'Avenida Bosquemar 50')
  })

  it('rejects junk address text', () => {
    assert.equal(sanitizeAddress('consultar'), null)
    assert.equal(sanitizeAddress('no me gusta'), null)
  })
})
