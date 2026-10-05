import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  inferHousingSubsidies,
  mergeSubsidies,
  uniqueSubsidies,
} from '../scripts/lib/subsidies.mjs'

describe('inferHousingSubsidies', () => {
  it('detects explicit DS19', () => {
    assert.deepEqual(
      inferHousingSubsidies('Departamentos con subsidio automático DS19'),
      ['DS19'],
    )
  })

  it('does not treat subsidio a la tasa as DS19', () => {
    assert.deepEqual(
      inferHousingSubsidies('Financia con el nuevo subsidio a la tasa'),
      ['Sin subsidio'],
    )
  })

  it('respects sin subsidio status', () => {
    assert.deepEqual(inferHousingSubsidies('<p>Sin subsidio</p>'), [
      'Sin subsidio',
    ])
  })

  it('does not bleed DS19 from a neighboring card window', () => {
    const cardA =
      'buscador-card">Diagonal Paraguay <a href="https://ingevecinmobiliaria.cl/proyecto-diagonalparaguay">ver</a>'
    const cardB =
      'buscador-card">Hacienda Lo Errázuriz (DS19) <a href="https://subsidios.cl/x">ver</a>'
    assert.deepEqual(inferHousingSubsidies(cardA), ['Sin subsidio'])
    assert.deepEqual(inferHousingSubsidies(cardB), ['DS19'])
  })
})

describe('uniqueSubsidies / mergeSubsidies', () => {
  it('drops Sin subsidio when a real subsidy exists', () => {
    assert.deepEqual(uniqueSubsidies(['Sin subsidio', 'DS19']), ['DS19'])
  })

  it('lets scraped Sin subsidio overwrite sticky DS19', () => {
    assert.deepEqual(mergeSubsidies(['DS19'], ['Sin subsidio']), [
      'Sin subsidio',
    ])
  })
})
