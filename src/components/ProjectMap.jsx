import { useEffect, useMemo, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { formatUf } from '../lib/search.js'

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

const DefaultIcon = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})
L.Marker.prototype.options.icon = DefaultIcon

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Mapa OpenStreetMap (Leaflet) — sin API key.
 * Un click en el pin abre la misma ficha completa del listado.
 * Cubre Chile (incluye regiones fuera de Santiago / Magallanes).
 */
export default function ProjectMap({ projects, onSelect }) {
  const mapRef = useRef(null)
  const containerRef = useRef(null)
  const layerRef = useRef(null)
  const onSelectRef = useRef(onSelect)
  const projectsByIdRef = useRef(new Map())

  useEffect(() => {
    onSelectRef.current = onSelect
  }, [onSelect])

  const points = useMemo(
    () =>
      projects.filter(
        (p) =>
          Number.isFinite(p.lat) &&
          Number.isFinite(p.lng) &&
          p.lat <= -17 &&
          p.lat >= -56 &&
          p.lng <= -66 &&
          p.lng >= -76,
      ),
    [projects],
  )

  const verifiedCount = useMemo(
    () => points.filter((p) => p.dataGaps?.locationEstimated === false).length,
    [points],
  )

  useEffect(() => {
    projectsByIdRef.current = new Map(points.map((p) => [p.id, p]))
  }, [points])

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = L.map(containerRef.current, {
      scrollWheelZoom: true,
      center: [-35.5, -71.2],
      zoom: 5,
    })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 18,
    }).addTo(map)
    layerRef.current = L.layerGroup().addTo(map)
    mapRef.current = map

    const onPopupClick = (e) => {
      const btn = e.target?.closest?.('[data-project-id]')
      if (!btn) return
      e.preventDefault()
      e.stopPropagation()
      const id = btn.getAttribute('data-project-id')
      const project = projectsByIdRef.current.get(id)
      if (project) onSelectRef.current?.(project)
    }
    const el = containerRef.current
    el.addEventListener('click', onPopupClick)

    return () => {
      el.removeEventListener('click', onPopupClick)
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const layer = layerRef.current
    if (!map || !layer) return
    layer.clearLayers()
    if (!points.length) return

    const bounds = []
    for (const p of points) {
      const title = escapeHtml(p.name)
      const comuna = escapeHtml(p.comuna)
      const region = escapeHtml(p.region)
      const estimated = p.dataGaps?.locationEstimated !== false
      const source = String(p.dataGaps?.locationSource || '')
      const sector = source.startsWith('sector:')
        ? source.slice('sector:'.length).replace(/-/g, ' ')
        : null
      const locNote = !estimated
        ? `<br/><span style="color:#0f766e">Ubicación según ficha${
            p.address ? `: ${escapeHtml(p.address)}` : ''
          }</span>`
        : sector
          ? `<br/><span style="color:#9a3412">Aprox. por sector: ${escapeHtml(sector)}</span>`
          : `<br/><span style="color:#9a3412">Ubicación aprox. por comuna</span>`
      const metro = p.metroStation
        ? `<br/><span style="color:#0f766e">Metro: ${escapeHtml(p.metroStation)}</span>`
        : p.region !== 'Metropolitana' && p.accessLabel
          ? `<br/><span style="color:#0f766e">${escapeHtml(p.accessLabel)}</span>`
          : ''

      const mapsBtns =
        !estimated && p.lat != null && p.lng != null
          ? `<div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:6px">
              <a href="https://www.google.com/maps/dir/?api=1&destination=${Number(p.lat)},${Number(p.lng)}"
                target="_blank" rel="noopener noreferrer"
                style="display:inline-flex;align-items:center;background:#1a73e8;color:#fff;border-radius:8px;padding:6px 10px;text-decoration:none;font:600 12px/1 Manrope,system-ui,sans-serif">
                Google Maps
              </a>
              <a href="https://waze.com/ul?ll=${Number(p.lat)}%2C${Number(p.lng)}&navigate=yes"
                target="_blank" rel="noopener noreferrer"
                style="display:inline-flex;align-items:center;background:#33ccff;color:#0b2e2b;border-radius:8px;padding:6px 10px;text-decoration:none;font:600 12px/1 Manrope,system-ui,sans-serif">
                Waze
              </a>
            </div>`
          : ''

      const marker = L.marker([p.lat, p.lng], { title: p.name })
      marker.bindTooltip(p.name, {
        permanent: points.length <= 80,
        direction: 'top',
        offset: [0, -36],
        opacity: 0.95,
        className: 'guan-map-label',
      })
      marker.bindPopup(
        `<div style="min-width:180px;font:14px/1.35 Manrope,system-ui,sans-serif">
          <strong style="font-size:15px">${title}</strong><br/>
          ${comuna}, ${region} · Desde ${escapeHtml(formatUf(p.priceFromUf))}
          ${locNote}${metro}
          ${mapsBtns}
          <div style="margin-top:8px">
            <button type="button" data-project-id="${escapeHtml(p.id)}"
              style="cursor:pointer;background:#0f766e;color:#fff;border:0;border-radius:8px;padding:6px 10px;font:inherit">
              Ver ficha completa
            </button>
          </div>
        </div>`,
        { maxWidth: 280 },
      )
      marker.on('click', () => {
        onSelectRef.current?.(p)
      })
      marker.addTo(layer)
      bounds.push([p.lat, p.lng])
    }
    if (bounds.length === 1) map.setView(bounds[0], 13)
    else map.fitBounds(bounds, { padding: [36, 36], maxZoom: 12 })
  }, [points])

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] px-4 py-3 text-sm">
        <p>
          <span className="font-medium">{points.length}</span> proyectos en el
          mapa
          {points.length ? (
            <span className="text-[var(--muted-ink)]">
              {' '}
              · {verifiedCount} con ubicación del aviso ·{' '}
              {points.length - verifiedCount} aproximados por comuna o sector
            </span>
          ) : null}
        </p>
        <p className="text-xs text-[var(--muted-ink)]">
          Click en el pin para ver la ficha completa
        </p>
      </div>
      {!points.length ? (
        <div className="p-10 text-center text-sm text-[var(--muted-ink)]">
          Todavía no hay ubicación para este filtro. Prueba ampliar la búsqueda.
        </div>
      ) : (
        <div ref={containerRef} className="h-[520px] w-full sm:h-[560px]" />
      )}
    </div>
  )
}
