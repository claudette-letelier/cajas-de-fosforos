import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { formatUf } from '../lib/search.js'
import {
  getComunaIndicators,
  indicatorsMeta,
  scoreColor,
} from '../lib/indicators.js'
import comunaCoords from '../data/comuna-coords.json' with { type: 'json' }

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

function fold(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function coordsForComuna(comuna, region) {
  const key = `${comuna}|${region}`
  if (comunaCoords[key]) return comunaCoords[key]
  const want = fold(comuna)
  for (const [k, v] of Object.entries(comunaCoords)) {
    if (fold(k.split('|')[0]) === want) return v
  }
  return null
}

function SimBar({ label, score, detail, invert }) {
  const width = score == null ? 0 : Math.max(4, Math.min(100, score))
  const color = scoreColor(score, { invert })
  return (
    <div className="grid grid-cols-[88px_1fr_auto] items-center gap-2 text-[11px]">
      <span className="truncate font-medium text-white/90">{label}</span>
      <div className="h-2.5 overflow-hidden rounded-sm bg-white/15">
        <div
          className="h-full rounded-sm transition-all"
          style={{ width: `${width}%`, background: color }}
        />
      </div>
      <span className="w-10 text-right tabular-nums text-white/70">
        {score == null ? '—' : Math.round(score)}
      </span>
      {detail ? (
        <p className="col-span-3 -mt-0.5 text-[10px] text-white/50">{detail}</p>
      ) : null}
    </div>
  )
}

/**
 * Mapa OpenStreetMap (Leaflet) — sin API key.
 * Capa opcional de indicadores comunales (estilo SimCity) con CEAD + catálogo.
 */
export default function ProjectMap({ projects, onSelect }) {
  const mapRef = useRef(null)
  const containerRef = useRef(null)
  const layerRef = useRef(null)
  const indicatorLayerRef = useRef(null)
  const onSelectRef = useRef(onSelect)
  const projectsByIdRef = useRef(new Map())
  const [showIndicators, setShowIndicators] = useState(true)
  const [selectedComuna, setSelectedComuna] = useState(null)

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

  const comunaKeys = useMemo(() => {
    const set = new Set()
    for (const p of points) set.add(p.comuna)
    return [...set]
  }, [points])

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
    indicatorLayerRef.current = L.layerGroup().addTo(map)
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

  // Project markers
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
        setSelectedComuna(p.comuna)
        onSelectRef.current?.(p)
      })
      marker.addTo(layer)
      bounds.push([p.lat, p.lng])
    }
    if (bounds.length === 1) map.setView(bounds[0], 13)
    else map.fitBounds(bounds, { padding: [36, 36], maxZoom: 12 })
  }, [points])

  // Indicator circles (comuna centroids)
  useEffect(() => {
    const layer = indicatorLayerRef.current
    if (!layer) return
    layer.clearLayers()
    if (!showIndicators) return

    for (const comuna of comunaKeys) {
      const ind = getComunaIndicators(comuna)
      const sample = points.find((p) => p.comuna === comuna)
      const coords = coordsForComuna(comuna, sample?.region)
      if (!coords?.lat || !ind) continue
      const crime = ind.crimeScore
      const color = scoreColor(crime)
      const circle = L.circleMarker([coords.lat, coords.lng], {
        radius: 11,
        color: '#0b2e2b',
        weight: 1,
        fillColor: color,
        fillOpacity: 0.55,
      })
      circle.bindTooltip(
        `${comuna}: delincuencia ${crime == null ? 's/d' : Math.round(crime)}/100`,
        { direction: 'top' },
      )
      circle.on('click', () => setSelectedComuna(comuna))
      circle.addTo(layer)
    }
  }, [comunaKeys, points, showIndicators])

  const panel = selectedComuna ? getComunaIndicators(selectedComuna) : null

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] px-3 py-2 text-xs text-[var(--muted-ink)]">
        <p>
          {points.length} en mapa · {verifiedCount} con ubicación de ficha
          {showIndicators
            ? ` · ${comunaKeys.length} comunas con indicador`
            : ''}
        </p>
        <label className="inline-flex cursor-pointer items-center gap-2 font-medium text-[var(--ink)]">
          <input
            type="checkbox"
            checked={showIndicators}
            onChange={(e) => setShowIndicators(e.target.checked)}
            className="size-3.5 accent-[var(--teal)]"
          />
          Indicadores comunales (CEAD)
        </label>
      </div>
      {!points.length ? (
        <div className="p-10 text-center text-sm text-[var(--muted-ink)]">
          Todavía no hay ubicación para este filtro. Prueba ampliar la búsqueda.
        </div>
      ) : null}
      <div className={`relative ${!points.length ? 'hidden' : ''}`}>
        <div ref={containerRef} className="h-[min(70vh,640px)] w-full" />
        {showIndicators && points.length ? (
          <div className="pointer-events-none absolute left-3 top-3 z-[500] max-w-[260px] rounded-xl bg-[#0b2e2b]/92 p-3 text-white shadow-lg backdrop-blur-sm">
            <p className="font-[family-name:var(--font-display)] text-base leading-tight">
              {panel ? panel.comuna : 'Indicadores tipo SimCity'}
            </p>
            <p className="mt-0.5 text-[10px] text-white/55">
              {panel
                ? `CEAD ${panel.year} · tasa DMCS/100 mil`
                : 'Haz clic en un círculo o pin para ver la comuna'}
            </p>
            <div className="pointer-events-auto mt-3 space-y-2">
              <SimBar
                label="Delincuencia"
                score={panel?.crimeScore}
                detail={
                  panel?.tasaDmcs100k != null
                    ? `${panel.tasaDmcs100k} casos/100 mil (percentil país)`
                    : 'Sin dato CEAD'
                }
              />
              <SimBar
                label="Oferta viv."
                score={panel?.offerScore}
                invert
                detail={
                  panel
                    ? `${panel.projects} proyecto(s) en el catálogo`
                    : undefined
                }
              />
              <SimBar
                label="Precio UF"
                score={panel?.priceScore}
                detail={
                  panel?.priceAvgUf != null
                    ? `Promedio desde ${formatUf(panel.priceAvgUf)}`
                    : undefined
                }
              />
              <SimBar
                label="Conectividad"
                score={panel?.connectivityScore}
                invert
                detail={
                  panel?.connectivityAvg != null
                    ? `Score medio ${panel.connectivityAvg}/5`
                    : undefined
                }
              />
            </div>
            <p className="mt-3 text-[9px] leading-snug text-white/45">
              {indicatorsMeta.disclaimer} Fuente: {indicatorsMeta.source}.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  )
}
