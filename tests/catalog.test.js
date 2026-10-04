import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { catalog } from '../src/data/catalog.js'
import {
  validateCatalog,
  validateProject,
} from '../src/lib/catalog-schema.js'
import { googleMapsUrl, hasExactLocation, wazeUrl } from '../src/lib/maps.js'

describe('catalog schema', () => {
  it('validates the generated catalog without structural errors', () => {
    const result = validateCatalog(catalog)
    assert.equal(
      result.ok,
      true,
      result.errors.slice(0, 15).join('\n') || 'unknown',
    )
    assert.ok(result.stats.total >= 100)
  })

  it('flags Biobío comunas wrongly labeled Metropolitana', () => {
    const bad = validateProject({
      id: 'x',
      name: 'Test',
      comuna: 'Penco',
      region: 'Metropolitana',
      priceFromUf: 2000,
      bedroomsMin: 1,
      bedroomsMax: 2,
      sources: [{ portal: 't', url: 'https://example.com/x' }],
      lat: -36.7,
      lng: -73.0,
      accessKind: 'metro',
      metroStation: 'Fake',
      dataGaps: { locationEstimated: true },
    })
    assert.equal(bad.ok, false)
    assert.ok(bad.errors.some((e) => /Metropolitana/.test(e)))
  })

  it('Lomas de Landa has exact ficha coords and address', () => {
    const p = catalog.find((x) => x.name === 'Lomas de Landa')
    assert.ok(p)
    assert.equal(p.address, 'Camino a Penco Ruta 150')
    assert.equal(p.dataGaps?.locationEstimated, false)
    assert.ok(Math.abs(p.lat - -36.809505) < 0.001)
  })

  it('Fuentes de San Pedro is Biobío with Bosquemar address', () => {
    const p = catalog.find((x) => x.name === 'Fuentes de San Pedro')
    assert.ok(p)
    assert.equal(p.region, 'Biobío')
    assert.equal(p.address, 'Avenida Bosquemar 50')
    assert.equal(p.dataGaps?.locationEstimated, false)
  })
})

describe('maps helpers', () => {
  it('exposes Maps/Waze only for exact locations', () => {
    const exact = catalog.find((p) => p.dataGaps?.locationEstimated === false)
    const approx = catalog.find((p) => p.dataGaps?.locationEstimated === true)
    assert.ok(exact && approx)
    assert.equal(hasExactLocation(exact), true)
    assert.ok(googleMapsUrl(exact))
    assert.ok(wazeUrl(exact))
    assert.equal(hasExactLocation(approx), false)
    assert.equal(googleMapsUrl(approx), null)
  })
})
