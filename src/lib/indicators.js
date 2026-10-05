import indicatorsData from '../data/comuna-indicators.json' with { type: 'json' }

function fold(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

const byFold = new Map()
for (const [name, row] of Object.entries(indicatorsData.byComuna || {})) {
  byFold.set(fold(name), row)
}

export const indicatorsMeta = indicatorsData.meta

export function getComunaIndicators(comuna) {
  if (!comuna) return null
  return byFold.get(fold(comuna)) || null
}

/** 0–100 → CSS color (green → yellow → red). Higher = worse for crime. */
export function scoreColor(score, { invert = false } = {}) {
  if (score == null || Number.isNaN(Number(score))) return '#94a3b8'
  let s = Math.max(0, Math.min(100, Number(score)))
  if (invert) s = 100 - s
  // 0 green, 50 yellow, 100 red
  const r = s < 50 ? Math.round((s / 50) * 220) : 220
  const g = s < 50 ? 180 : Math.round(180 - ((s - 50) / 50) * 140)
  const b = 60
  return `rgb(${r},${g},${b})`
}
