import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  geocodeAcceptable,
  pinMatchesComuna,
  streetFromAddress,
  streetFromName,
  streetPinIsExact,
  streetPinKeys,
} from '../scripts/lib/street-pin.mjs'

const COMUNAS = ['Santiago', 'Quilicura', 'Viña del Mar', 'Valparaíso', 'Ñuñoa']

describe('streetFromName', () => {
  it('reads Santa Elena 1670 and ignores a comuna used as the name', () => {
    assert.deepEqual(streetFromName('Santa Elena 1670', 'Santiago'), {
      street: 'Santa Elena',
      number: '1670',
    })
    assert.equal(streetFromName('Condominio Quillota 21', 'Quillota'), null)
    assert.deepEqual(streetFromName('Fuchslocher 1.170', 'Osorno'), {
      street: 'Fuchslocher',
      number: '1170',
    })
  })

  it('reads Gómez Carreño from the address, not the sales office', () => {
    assert.deepEqual(
      streetFromAddress('Av. Gómez Carreño 4065, Viña del mar'),
      { street: 'Gómez Carreño', number: '4065' },
    )
    assert.equal(
      streetFromAddress('Av. Apoquindo 4501, Oficina 2104'),
      null,
    )
  })
})

describe('geocodeAcceptable', () => {
  it('keeps Santa Elena 1670 and rejects Matta in Quilicura', () => {
    const santa = {
      lat: '-33.4659992',
      lon: '-70.6282044',
      display_name:
        '1670, Santa Elena, Santiago, Provincia de Santiago, Región Metropolitana de Santiago, Chile',
    }
    assert.equal(
      geocodeAcceptable(santa, {
        comuna: 'Santiago',
        centroid: { lat: -33.4377, lng: -70.6511 },
        street: 'Santa Elena',
        number: '1670',
        comunas: COMUNAS,
      }),
      true,
    )
    const matta = {
      lat: '-33.3641552',
      lon: '-70.754861',
      display_name:
        'Manuel Antonio Matta, Quilicura, Santiago, Provincia de Santiago, Chile',
    }
    assert.equal(
      geocodeAcceptable(matta, {
        comuna: 'Santiago',
        centroid: { lat: -33.4377, lng: -70.6511 },
        street: 'Matta',
        number: '16',
        comunas: COMUNAS,
      }),
      false,
    )
  })
})

describe('streetPinKeys', () => {
  it('matches the cached Gómez Carreño and Santa Elena keys', () => {
    assert.ok(
      streetPinKeys({
        id: 'silos-condominio-parquemar',
        name: 'Edificio Parque Mar',
        comuna: 'Viña del Mar',
        address: 'Av. Gómez Carreño 4065, Viña del mar',
      }).includes('gomez carreno 4065|vina del mar'),
    )
    assert.ok(
      streetPinKeys({
        id: 'uts-santa-elena-1670',
        name: 'Santa Elena 1670',
        comuna: 'Santiago',
        address: null,
      }).includes('santa elena 1670|santiago'),
    )
  })

  it('treats a house number in the label as an exact pin', () => {
    const item = {
      name: 'Edificio Parque Mar',
      comuna: 'Viña del Mar',
      address: 'Av. Gómez Carreño 4065, Viña del mar',
    }
    assert.equal(
      streetPinIsExact(
        {
          precision: 'street',
          display: 'Norte, 4065, Almirante Gómez Carreño, Viña del Mar, Chile',
        },
        item,
      ),
      true,
    )
  })
})

describe('pinMatchesComuna', () => {
  const table = {
    'Valparaíso|Valparaíso': { lat: -33.0458456, lng: -71.6196749 },
    'Concepcion|Metropolitana': { lat: -33.45, lng: -70.66 },
    'Concepción|Biobío': { lat: -36.8270698, lng: -73.0502064 },
  }

  it('rejects a Valparaíso ficha that lands in Argentina', () => {
    assert.equal(
      pinMatchesComuna(-36.723306, -70.274735, 'Valparaíso', table),
      false,
    )
  })

  it('keeps a Concepción pin when another region label is wrong', () => {
    assert.equal(
      pinMatchesComuna(-36.788013, -73.0476297, 'Concepcion', table),
      true,
    )
  })
})
