/**
 * Pure HTML → location helpers used by the catalog scraper.
 * Kept separate so unit tests can cover Subsidios.cl / maps quirks.
 */

function decodeHtml(text) {
  return String(text || '')
    .replace(/&#8211;/g, '–')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractLdListing(html) {
  for (const m of String(html || '').matchAll(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi,
  )) {
    try {
      const data = JSON.parse(m[1])
      if (data && data['@type'] === 'RealEstateListing') return data
      if (Array.isArray(data)) {
        const hit = data.find((x) => x && x['@type'] === 'RealEstateListing')
        if (hit) return hit
      }
    } catch {
      /* ignore */
    }
  }
  return null
}

export function sanitizeAddress(raw) {
  if (!raw) return null
  let a = decodeHtml(String(raw))
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (a.length < 8 || a.length > 140) return null
  if (/[{}<>;]|olw-|prev-head|className|function\s*\(|https?:|www\./i.test(a))
    return null
  if (
    /no me gusta|me gusta|consultar|sin informaci|por definir|proximamente|próximamente/i.test(
      a,
    )
  ) {
    return null
  }
  if (!/(av\.|avenida|calle|pasaje|camino|pte\.|puente|los |las |el |la |\d)/i.test(a))
    return null
  return a
}

/** Best lat/lng found in HTML (Chile bounds). Higher score wins. */
export function extractCoords(html) {
  const candidates = []
  const push = (lat, lng, score = 0) => {
    lat = Number(lat)
    lng = Number(lng)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return
    if (lat < -56 || lat > -17 || lng < -76 || lng > -66) return
    candidates.push({ lat, lng, score })
  }

  const text = String(html || '')

  for (const m of text.matchAll(/@(-?\d+\.\d+),(-?\d+\.\d+)/g)) {
    push(m[1], m[2], 40)
  }
  for (const m of text.matchAll(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/g)) {
    push(m[1], m[2], 50)
  }
  for (const m of text.matchAll(
    /[?&](?:q|ll|center|query)=(-?\d+\.\d+)[,+\s](-?\d+\.\d+)/gi,
  )) {
    push(m[1], m[2], 35)
  }
  for (const m of text.matchAll(
    /(?:waze\.com\/(?:.*?[?&](?:ll|to)=|ul\?ll=)|navigate\.waze\.com\/.*[?&]ll=)(-?\d+\.\d+)%2C(-?\d+\.\d+)/gi,
  )) {
    push(m[1], m[2], 45)
  }
  for (const m of text.matchAll(
    /waze\.com[^"'\\\s<>]*[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/gi,
  )) {
    push(m[1], m[2], 45)
  }
  for (const m of text.matchAll(
    /"lat(?:itude)?"\s*:\s*(-?\d+\.\d+)[\s\S]{0,80}"l(?:ng|on|ongitude)"\s*:\s*(-?\d+\.\d+)/gi,
  )) {
    push(m[1], m[2], 30)
  }
  for (const m of text.matchAll(
    /"l(?:ng|on|ongitude)"\s*:\s*(-?\d+\.\d+)[\s\S]{0,80}"lat(?:itude)?"\s*:\s*(-?\d+\.\d+)/gi,
  )) {
    push(m[2], m[1], 30)
  }
  // Subsidios.cl quoted strings
  for (const m of text.matchAll(
    /"latitude"\s*:\s*"(-?\d+\.\d+)"[\s\S]{0,120}"longitude"\s*:\s*"(-?\d+\.\d+)"/gi,
  )) {
    push(m[1], m[2], 70)
  }
  for (const m of text.matchAll(
    /"longitude"\s*:\s*"(-?\d+\.\d+)"[\s\S]{0,120}"latitude"\s*:\s*"(-?\d+\.\d+)"/gi,
  )) {
    push(m[2], m[1], 70)
  }
  for (const m of text.matchAll(
    /"lat"\s*:\s*"(-?\d+\.\d+)"[\s\S]{0,80}"l(?:ng|on)"\s*:\s*"(-?\d+\.\d+)"/gi,
  )) {
    push(m[1], m[2], 65)
  }
  for (const m of text.matchAll(
    /initUbicacion\(\s*'(-?\d+\.\d+)'\s*,\s*'(-?\d+\.\d+)'/g,
  )) {
    push(m[1], m[2], 55)
  }
  for (const m of text.matchAll(
    /data-lat=["'](-?\d+\.\d+)["'][^>]*data-l(?:ng|on)=["'](-?\d+\.\d+)["']/gi,
  )) {
    push(m[1], m[2], 40)
  }
  for (const m of text.matchAll(
    /data-l(?:ng|on)=["'](-?\d+\.\d+)["'][^>]*data-lat=["'](-?\d+\.\d+)["']/gi,
  )) {
    push(m[2], m[1], 40)
  }
  for (const m of text.matchAll(/!2d(-?\d+\.\d+)!3d(-?\d+\.\d+)/g)) {
    push(m[2], m[1], 42)
  }

  if (!candidates.length) return null
  candidates.sort((a, b) => b.score - a.score)
  return { lat: candidates[0].lat, lng: candidates[0].lng }
}

export function extractAddress(html) {
  const listing = extractLdListing(html)
  const ldAddr =
    listing?.address?.streetAddress ||
    (typeof listing?.address === 'string' ? listing.address : null)
  const subsidiosAddr =
    String(html || '').match(
      /"address"\s*:\s*"((?:[^"\\]|\\.){5,120})"\s*,\s*"latitude"/i,
    )?.[1] ||
    String(html || '').match(/"address"\s*:\s*"((?:[^"\\]|\\.){5,120})"/i)?.[1]
  const raw =
    ldAddr ||
    (subsidiosAddr
      ? subsidiosAddr
          .replace(/\\u003C/gi, '<')
          .replace(/\\u003E/gi, '>')
          .replace(/\\"/g, '"')
          .replace(/\\\//g, '/')
      : '') ||
    String(html || '').match(
      /<(?:h3|p|span|div)[^>]*>\s*((?:Avenida|Av\.|Calle|Pasaje|Camino)[^<]{5,90})\s*</i,
    )?.[1] ||
    String(html || '').match(
      /(?:Direcci[oó]n|Ubicaci[oó]n)\s*[:：]?\s*<\/[^>]+>\s*<[^>]+>\s*([^<]{8,100})/i,
    )?.[1] ||
    String(html || '').match(/"streetAddress"\s*:\s*"([^"]+)"/i)?.[1] ||
    ''
  return sanitizeAddress(raw)
}
