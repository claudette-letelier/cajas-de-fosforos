import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { getComunaIndicators, scoreColor } from '../src/lib/indicators.js'

describe('comuna indicators', () => {
  it('loads Santiago CEAD scores', () => {
    const s = getComunaIndicators('Santiago')
    assert.ok(s)
    assert.ok(s.crimeScore > 50)
    assert.ok(s.projects >= 1)
    assert.ok(s.tasaDmcs100k > 0)
  })

  it('maps score to a color string', () => {
    assert.match(scoreColor(0), /^rgb\(/)
    assert.match(scoreColor(100), /^rgb\(/)
  })
})
