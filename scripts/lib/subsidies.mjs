/**
 * Infer MINVU-style housing subsidies from free text.
 * Ignores “subsidio a la tasa” and menu noise; prefers explicit DS19/DS1/DS49.
 */
export function inferHousingSubsidies(text, { defaultTo = 'Sin subsidio' } = {}) {
  const raw = String(text || '')
  const t = raw.toLowerCase()

  // Explicit “sin subsidio” as project status wins when no DS19 token nearby.
  const hasSin = /sin\s+subsidio/.test(t)
  const hasDs19 = /\bds[\s.\-]?19\b|subsidio\s*autom[aá]tico\s*ds[\s.\-]?19/.test(t)
  const hasDs49 = /\bds[\s.\-]?49\b/.test(t)
  const hasDs1T2 = /\bds[\s.\-]?1\b[^.\n]{0,24}tramo\s*2|tramo\s*2[^.\n]{0,24}\bds[\s.\-]?1\b|ds1-tramo-2/.test(
    t,
  )
  const hasDs1T3 = /\bds[\s.\-]?1\b[^.\n]{0,24}tramo\s*3|tramo\s*3[^.\n]{0,24}\bds[\s.\-]?1\b|ds1-tramo-3/.test(
    t,
  )
  const hasDs1 =
    /\bds[\s.\-]?0?1\b|\bds1\b/.test(t) &&
    !hasDs1T2 &&
    !hasDs1T3 &&
    !/\bds[\s.\-]?19\b/.test(t)

  const out = []
  if (hasDs19) out.push('DS19')
  if (hasDs1T2) out.push('DS1 Tramo 2')
  if (hasDs1T3) out.push('DS1 Tramo 3')
  if (hasDs1 && !out.some((x) => x.includes('DS1'))) out.push('DS1')
  if (hasDs49) out.push('DS49')

  if (!out.length) {
    // “Subsidio a la tasa” is not a MINVU dwelling subsidy (DS19/DS1/…).
    if (hasSin || /subsidio\s+a\s+la\s+tasa/.test(t)) return [defaultTo]
    return [defaultTo]
  }
  return out
}

/** Drop “Sin subsidio” when any real subsidy is present. */
export function uniqueSubsidies(list) {
  const set = [...new Set((list || []).filter(Boolean))]
  const real = set.filter((s) => s !== 'Sin subsidio')
  return real.length ? real : set.length ? ['Sin subsidio'] : ['Sin subsidio']
}

/**
 * Prefer scraped subsidies when the scraper made an explicit call.
 * Avoids sticky false DS19 from older catalog rows.
 */
export function mergeSubsidies(current, scraped) {
  if (scraped?.length) return uniqueSubsidies(scraped)
  return uniqueSubsidies(current || ['Sin subsidio'])
}
