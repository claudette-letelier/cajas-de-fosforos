import { safeHttpUrl } from './security.js'

/** True when we have ficha coordinates (not comuna/sector centroid). */
export function hasExactLocation(project) {
  if (project?.lat == null || project?.lng == null) return false
  if (!Number.isFinite(Number(project.lat)) || !Number.isFinite(Number(project.lng))) {
    return false
  }
  return project.dataGaps?.locationEstimated === false
}

export function googleMapsUrl(project) {
  if (!hasExactLocation(project)) return null
  const lat = Number(project.lat)
  const lng = Number(project.lng)
  const q =
    project.address && String(project.address).trim().length >= 6
      ? encodeURIComponent(`${project.address}, ${project.comuna || ''}, Chile`)
      : `${lat},${lng}`
  return safeHttpUrl(
    `https://www.google.com/maps/dir/?api=1&destination=${q}`,
  )
}

export function wazeUrl(project) {
  if (!hasExactLocation(project)) return null
  const lat = Number(project.lat)
  const lng = Number(project.lng)
  return safeHttpUrl(
    `https://waze.com/ul?ll=${lat}%2C${lng}&navigate=yes`,
  )
}
