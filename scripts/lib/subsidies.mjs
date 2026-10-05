/**
 * Map a portal subsidy slug/label (e.g. UsaTuSubsidio `subsidio=` or
 * “Tipo Subsidio”) to catalog labels. Unknown values return [].
 */
export function parseSubsidyHint(hint) {
  const s = String(hint || '')
    .trim()
    .toLowerCase()
    .replace(/\+/g, ' ')
  if (!s) return []
  if (/fogaes/.test(s)) return ['FOGAES']
  if (/ds19|ds-19|ds_19/.test(s)) return ['DS19']
  if (/ds1[-_\s]?tramo[-_\s]?2|tramo[-_\s]?2/.test(s)) return ['DS1 Tramo 2']
  if (/ds1[-_\s]?tramo[-_\s]?3|tramo[-_\s]?3/.test(s)) return ['DS1 Tramo 3']
  if (/ds1[-_\s]?tramo[-_\s]?1|tramo[-_\s]?1/.test(s)) return ['DS1']
  if (/\bds1\b|ds-1|ds_1/.test(s)) return ['DS1']
  if (/ds49|ds-49|ds_49/.test(s)) return ['DS49']
  if (/sin[-_\s]?subsidio/.test(s)) return ['Sin subsidio']
  return []
}

/**
 * Read “Tipo Subsidio” from UsaTuSubsidio / similar detail HTML.
 */
export function extractTipoSubsidio(html) {
  const raw = String(html || '')
  const fromSpec = raw.match(
    /detail-spec__value[^>]*>\s*([^<]+?)\s*<\/div>\s*<div class="detail-spec__label">\s*Tipo Subsidio/i,
  )?.[1]
  if (fromSpec) return decodeBasic(fromSpec).trim()
  const fromQuery = raw.match(/tipo_subsidio=([A-Za-z0-9_-]+)/i)?.[1]
  if (fromQuery) return decodeURIComponent(fromQuery).trim()
  const fromTable = raw.match(
    /Tipo\s*Subsidio[\s\S]{0,120}?>(FOGAES|DS\s*19|DS\s*1(?:\s*Tramo\s*[123])?|DS\s*49)</i,
  )?.[1]
  if (fromTable) return fromTable.replace(/\s+/g, ' ').trim()
  return null
}

function decodeBasic(s) {
  return String(s)
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#8211;/g, '–')
    .replace(/&nbsp;/g, ' ')
}

/**
 * Infer housing / financing aids from free text.
 * Ignores “subsidio a la tasa” and menu noise; prefers explicit DS19/DS1/DS49/FOGAES.
 */
export function inferHousingSubsidies(text, { defaultTo = 'Sin subsidio' } = {}) {
  const raw = String(text || '')
  const t = raw.toLowerCase()

  // Explicit “sin subsidio” as project status wins when no DS19 token nearby.
  const hasSin = /sin\s+subsidio/.test(t)
  const hasFogaes = /\bfogaes\b/.test(t)
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
  if (hasFogaes) out.push('FOGAES')
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
