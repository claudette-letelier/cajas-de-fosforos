/**
 * Enlaces honestos a opiniones / reclamos.
 * No inventamos notas: abrimos búsquedas en fuentes públicas.
 */

function q(parts) {
  return encodeURIComponent(
    parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim(),
  )
}

function cleanDeveloper(name) {
  return String(name || '')
    .replace(/\+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * @param {object} project
 * @returns {{ id: string, label: string, detail: string, url: string }[]}
 */
export function reputationLinks(project) {
  const name = project.name || ''
  const developer = cleanDeveloper(project.developer)
  const place = [name, project.address, project.comuna, 'Chile']
    .filter(Boolean)
    .join(' ')
  const mapsQuery =
    Number.isFinite(project.lat) && Number.isFinite(project.lng)
      ? `${name} ${project.comuna || ''} @${project.lat},${project.lng}`
      : place

  const links = [
    {
      id: 'gmaps',
      label: 'Opiniones en Google Maps',
      detail: 'Reseñas de vecinos / zona del proyecto (si el lugar está indexado).',
      url: `https://www.google.com/maps/search/?api=1&query=${q([mapsQuery])}`,
    },
    {
      id: 'reclamos',
      label: 'Reclamos.cl',
      detail: `Buscar quejas sobre ${developer && developer !== 'Consultar portal' ? developer : 'la inmobiliaria'}.`,
      url: `https://www.reclamos.cl/?s=${q([
        developer && developer !== 'Consultar portal' ? developer : name,
        'inmobiliaria',
      ])}`,
    },
    {
      id: 'sernac',
      label: 'SERNAC',
      detail: 'Portal oficial de protección al consumidor (búsqueda / ingreso de reclamo).',
      url: `https://www.sernac.cl/?s=${q([
        developer && developer !== 'Consultar portal' ? developer : name,
        'inmobiliaria',
      ])}`,
    },
    {
      id: 'sernac-reclamo',
      label: 'Ingresar reclamo SERNAC',
      detail: 'Formulario oficial si ya compraste o firmaste y hay un problema.',
      url: 'https://www.sernac.cl/portal/604/w3-channel.html',
    },
  ]

  // Atajos útiles con coords: abrir Maps centrado
  if (Number.isFinite(project.lat) && Number.isFinite(project.lng)) {
    links.splice(1, 0, {
      id: 'gmaps-pin',
      label: 'Ver pin en Maps',
      detail: 'Abre la ubicación exacta del proyecto en el mapa.',
      url: `https://www.google.com/maps?q=${project.lat},${project.lng}`,
    })
  }

  return links
}
