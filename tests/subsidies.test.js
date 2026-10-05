import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  inferHousingSubsidies,
  mergeSubsidies,
  uniqueSubsidies,
  parseSubsidyHint,
  extractTipoSubsidio,
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

  it('detects FOGAES', () => {
    assert.deepEqual(
      inferHousingSubsidies('Tipo Subsidio FOGAES · hasta 90% financiamiento'),
      ['FOGAES'],
    )
  })
})

describe('parseSubsidyHint / extractTipoSubsidio', () => {
  it('maps UTS subsidio=fogaes to FOGAES instead of DS19', () => {
    assert.deepEqual(parseSubsidyHint('fogaes'), ['FOGAES'])
    assert.deepEqual(parseSubsidyHint('ds19-automatico'), ['DS19'])
  })

  it('reads Tipo Subsidio from UTS detail HTML', () => {
    const html = `
      <div class="detail-spec__value">FOGAES</div>
      <div class="detail-spec__label">Tipo Subsidio</div>
      <a href="/financiamiento/?tipo_subsidio=FOGAES">sim</a>`
    assert.equal(extractTipoSubsidio(html), 'FOGAES')
    assert.deepEqual(parseSubsidyHint(extractTipoSubsidio(html)), ['FOGAES'])
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
