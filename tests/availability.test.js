import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { filterCatalog } from '../src/lib/search.js'

const base = {
  name: 'Edificio Prueba',
  comuna: 'Santiago',
  developer: 'Santolaya',
  region: 'Metropolitana',
  subsidies: ['Sin subsidio'],
  propertyType: 'departamento',
  condition: 'nuevo',
  bedroomsMin: 1,
  bedroomsMax: 2,
  bathroomsMin: 1,
  bathroomsMax: 1,
  parking: 'consultar',
  priceFromUf: 2000,
  connectivityScore: 3,
}

const openFilters = {
  region: 'todas',
  propertyType: 'todos',
  condition: 'todos',
  subsidy: 'todos',
}

describe('disponibilidad', () => {
  const items = [
    { ...base, id: 'a', availability: 'disponible' },
    { ...base, id: 'b', name: 'Sin stock', availability: 'agotado' },
    { ...base, id: 'c', name: 'Antiguo' },
  ]

  it('oculta agotados en el listado en venta', () => {
    const ids = filterCatalog(items, { ...openFilters, availability: 'en-venta' }).map(
      (p) => p.id,
    )
    assert.deepEqual(ids, ['a', 'c'])
  })

  it('el filtro de agotados deja solo los vendidos o sin stock', () => {
    const ids = filterCatalog(items, { ...openFilters, availability: 'agotado' }).map(
      (p) => p.id,
    )
    assert.deepEqual(ids, ['b'])
  })

  it('sin filtro explícito también oculta agotados', () => {
    const ids = filterCatalog(items, openFilters).map((p) => p.id)
    assert.deepEqual(ids, ['a', 'c'])
  })
})
