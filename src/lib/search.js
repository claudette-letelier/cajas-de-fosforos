import { UF_CLP } from '../data/catalog.js'

export function formatClp(value) {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatUf(value) {
  if (value == null) return '—'
  return `UF ${Number(value).toLocaleString('es-CL', { maximumFractionDigits: 1 })}`
}

export function ufToClp(uf) {
  return Math.round(uf * UF_CLP)
}

export function connectivityLabel(score) {
  if (score == null) return 'N/A (fuera de Metro Santiago)'
  const map = {
    5: 'Excelente (≤8 min al metro)',
    4: 'Muy buena (≤15 min)',
    3: 'Media (≤25 min / bus+metro)',
    2: 'Baja (lejos o estación futura)',
    1: 'Sin metro cercano',
  }
  return map[score] || String(score)
}

export function filterCatalog(items, filters) {
  return items.filter((p) => {
    if (filters.q) {
      const q = filters.q.toLowerCase()
      const hay = `${p.name} ${p.comuna} ${p.developer} ${p.region}`.toLowerCase()
      if (!hay.includes(q)) return false
    }

    if (filters.subsidy === 'con') {
      if (p.subsidies.length === 1 && p.subsidies[0] === 'Sin subsidio') return false
      if (filters.subsidyType && filters.subsidyType !== 'todos') {
        if (!p.subsidies.some((s) => s.includes(filters.subsidyType))) return false
      }
    } else if (filters.subsidy === 'sin') {
      if (!p.subsidies.includes('Sin subsidio')) return false
    }

    if (filters.region !== 'todas' && p.region !== filters.region) return false
    if (filters.propertyType !== 'todos' && p.propertyType !== filters.propertyType)
      return false
    if (filters.condition !== 'todos' && p.condition !== filters.condition) return false

    if (filters.bedrooms > 0) {
      if (p.bedroomsMax < filters.bedrooms) return false
    }
    if (filters.bathrooms > 0) {
      if (p.bathroomsMax < filters.bathrooms) return false
    }

    if (filters.parking === 'si') {
      if (p.parking !== 'incluido' && p.parking !== 'disponible') return false
    } else if (filters.parking === 'si-o-consultar') {
      if (p.parking === 'no') return false
    }

    if (filters.priceMinUf && p.priceFromUf < filters.priceMinUf) return false
    if (filters.priceMaxUf && p.priceFromUf > filters.priceMaxUf) return false

    if (filters.minConnectivity > 0) {
      if (p.connectivityScore == null || p.connectivityScore < filters.minConnectivity)
        return false
    }

    return true
  })
}

export function sortCatalog(items, sortBy) {
  const arr = [...items]
  switch (sortBy) {
    case 'precio-asc':
      return arr.sort((a, b) => a.priceFromUf - b.priceFromUf)
    case 'precio-desc':
      return arr.sort((a, b) => b.priceFromUf - a.priceFromUf)
    case 'metro-desc':
      return arr.sort(
        (a, b) => (b.connectivityScore ?? -1) - (a.connectivityScore ?? -1),
      )
    case 'metro-asc':
      return arr.sort(
        (a, b) => (a.connectivityScore ?? 99) - (b.connectivityScore ?? 99),
      )
    case 'nombre':
      return arr.sort((a, b) => a.name.localeCompare(b.name, 'es'))
    default:
      return arr
  }
}
