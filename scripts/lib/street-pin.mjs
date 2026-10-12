/**
 * Street-level pins when the catalog only has a comuna centroid
 * (Plaza de Armas for "Santiago", downtown for Viña del Mar, etc.).
 */

export function fold(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/&[#a-z0-9]+;/gi, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

export function isOfficeAddress(address) {
  return /oficina|piso\s+\d|local\s+\d|casa\s+matriz/i.test(String(address || ''))
}

function normalizeNumber(raw) {
  const t = String(raw || '').trim()
  if (/^\d{1,2}\.\d{3}$/.test(t)) return t.replace('.', '')
  return t.replace(/^0+(?=\d)/, '')
}

/** "Santa Elena 1670" / "Fuchslocher 1.170" / "Edificio Castellón 227". */
export function streetFromName(name, comuna) {
  const cleaned = String(name || '')
    .replace(/&#0*39;|&apos;|&#039;/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
  const m = cleaned.match(
    /^(?:edificio|condominio|departamento|depto\.?)?\s*(.+?)\s+(\d{1,2}\.\d{3}|\d{2,5})$/i,
  )
  if (!m) return null
  const street = m[1].replace(/^(?:edificio|condominio)\s+/i, '').trim()
  if (street.length < 3) return null
  if (/^(etapa|torre|block|depto|norte|sur|oriente|poniente)$/i.test(street))
    return null
  if (comuna && fold(street) === fold(comuna)) return null
  return { street, number: normalizeNumber(m[2]) }
}

/** First street+number in an address, ignoring sales-office lines. */
export function streetFromAddress(address) {
  if (!address || isOfficeAddress(address)) return null
  const head = String(address).split(',')[0].replace(/\s+/g, ' ').trim()
  const stripped = head.replace(/\bN[°º]\s*/i, '').replace(/\s+#\s*/g, ' ')
  const m = stripped.match(
    /^(?:av\.?|avenida|calle|pasaje|psje\.?|camino)?\s*(.+?)\s+(\d{1,2}\.\d{3}|\d{2,5})\b/i,
  )
  if (!m) return null
  const street = m[1].trim()
  if (street.length < 3) return null
  return { street, number: normalizeNumber(m[2]) }
}

export function streetPinKey(street, number, comuna) {
  const city = fold(comuna)
  if (!street || !number || !city || city === 'chile') return null
  return `${fold(street)} ${number}|${city}`
}

/** Keys to try against street-coords.json, most specific first. */
export function streetPinKeys(item) {
  const keys = []
  if (item?.id) keys.push(`id:${item.id}`)
  const fromName = streetFromName(item?.name, item?.comuna)
  const fromAddr = streetFromAddress(item?.address)
  const nameKey = fromName
    ? streetPinKey(fromName.street, fromName.number, item.comuna)
    : null
  const addrKey = fromAddr
    ? streetPinKey(fromAddr.street, fromAddr.number, item.comuna)
    : null
  if (nameKey) keys.push(nameKey)
  if (addrKey && addrKey !== nameKey) keys.push(addrKey)
  return keys
}

export function lookupStreetPin(table, item) {
  if (!table || !item) return null
  for (const key of streetPinKeys(item)) {
    const hit = table[key]
    if (hit?.lat != null && hit?.lng != null) return { ...hit, key }
  }
  return null
}

/** House number in the geocoder label, or an explicit point from the listing map. */
export function streetPinIsExact(hit, item) {
  if (!hit) return false
  if (hit.precision === 'house' || hit.precision === 'point') return true
  const parsed =
    streetFromName(item?.name, item?.comuna) || streetFromAddress(item?.address)
  if (!parsed) return false
  return String(hit.display || '')
    .split(',')
    .map((p) => fold(p))
    .some((p) => p === parsed.number || p.startsWith(`${parsed.number} `))
}

const GENERIC_COMUNA = new Set(['chile', 'santiago'])

/** Reject Nominatim hits that landed in another comuna or far from this one. */
function addressParts(display) {
  return String(display || '')
    .split(',')
    .map((p) => fold(p))
    .filter(Boolean)
}

/** A comuna counts only as its own address component, not inside a region name or a street. */
function componentIsComuna(parts, name) {
  const n = fold(name)
  if (!n) return false
  return parts.some((p) => p === n)
}

export function geocodeAcceptable(hit, { comuna, centroid, street, number, comunas }) {
  if (!hit || hit.lat == null || (hit.lon == null && hit.lng == null)) return false
  const lat = Number(hit.lat)
  const lng = Number(hit.lon ?? hit.lng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false
  const raw = hit.display_name || hit.display || ''
  const display = fold(raw)
  const parts = addressParts(raw)
  const want = fold(comuna)
  const streetTok = fold(street)
    .split(' ')
    .filter((w) => w.length > 3)
  const numberOk = number && parts.some((p) => p === String(number) || p.startsWith(`${number} `))
  const streetOk = streetTok.length && streetTok.some((w) => display.includes(w))
  if (!streetOk && !numberOk) return false
  if (centroid?.lat != null && centroid?.lng != null) {
    const km = haversineKm(lat, lng, Number(centroid.lat), Number(centroid.lng))
    if (km > 22) return false
  }
  for (const name of comunas || []) {
    const n = fold(name)
    if (!n || n === want || GENERIC_COMUNA.has(n) || n.length < 5) continue
    if (componentIsComuna(parts, name)) return false
  }
  if (want && want !== 'chile' && !componentIsComuna(parts, comuna) && !display.includes(want))
    return false
  return true
}

export function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371
  const p = Math.PI / 180
  const dLat = (lat2 - lat1) * p
  const dLng = (lng2 - lng1) * p
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * p) * Math.cos(lat2 * p) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}
