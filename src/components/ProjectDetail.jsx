import { useEffect, useId, useState } from 'react'
import {
  Bath,
  BedDouble,
  Car,
  CircleDollarSign,
  ExternalLink,
  ImageOff,
  Layers,
  MapPin,
  MessageCircle,
  Scale,
  Square,
  Star,
  TrainFront,
  X,
} from 'lucide-react'
import { honestyScore, truthSignals } from '../lib/truth.js'
import { reputationLinks } from '../lib/reputation.js'
import { accessSummary, formatClp, formatUf, ufToClp } from '../lib/search.js'
import { safeHttpUrl, safeImageUrl, safeWhatsappUrl } from '../lib/security.js'

function GalleryImage({ src, alt }) {
  const [failed, setFailed] = useState(false)
  const safeSrc = safeImageUrl(src)
  if (!safeSrc || failed) {
    return (
      <div className="flex aspect-[16/9] w-full flex-col items-center justify-center gap-2 bg-[linear-gradient(145deg,#134e4a_0%,#1c3d4a_55%,#0b2e2b_100%)] text-white/70">
        <ImageOff className="size-6 opacity-70" />
        <span className="px-3 text-center text-xs">Sin foto pública verificada</span>
      </div>
    )
  }
  return (
    <img
      src={safeSrc}
      alt={alt}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="aspect-[16/9] h-full w-full object-cover"
    />
  )
}

function ConnectivityBars({ score, title }) {
  if (score == null) {
    return <span className="text-xs text-[var(--muted-ink)]">N/A</span>
  }
  return (
    <div className="flex items-center gap-1" title={title || ''}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={`h-2.5 w-2.5 rounded-sm ${
            i <= score ? 'bg-[var(--teal)]' : 'bg-[var(--line)]'
          }`}
        />
      ))}
      <span className="ml-1 text-xs font-medium text-[var(--ink)]">{score}/5</span>
    </div>
  )
}

export default function ProjectDetail({
  project,
  portalName,
  onClose,
}) {
  const titleId = useId()
  const gallery = [
    ...new Set(
      [
        ...(Array.isArray(project.images) ? project.images : []),
        project.imageUrl,
      ].filter(Boolean),
    ),
  ]
  const [activeIdx, setActiveIdx] = useState(0)
  const activeSrc = gallery[Math.min(activeIdx, Math.max(0, gallery.length - 1))] || null
  const signals = truthSignals(project)
  const score = honestyScore(project)
  const wa = safeWhatsappUrl(project.contactWhatsapp)

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKey(e) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight' && gallery.length > 1) {
        setActiveIdx((i) => (i + 1) % gallery.length)
      }
      if (e.key === 'ArrowLeft' && gallery.length > 1) {
        setActiveIdx((i) => (i - 1 + gallery.length) % gallery.length)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose, gallery.length])

  return (
    <div
        className="fixed inset-0 z-[2000] flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-6"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:max-h-[90vh] sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--line)] px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--teal)]">
              Ficha completa · Transparencia {score}
            </p>
            <h2
              id={titleId}
              className="font-[family-name:var(--font-display)] text-2xl leading-tight text-[var(--ink)]"
            >
              {project.name}
            </h2>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[var(--muted-ink)]">
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5" />
                {project.comuna}, {project.region}
              </span>
              <span>· {project.developer}</span>
              {project.address ? <span>· {project.address}</span> : null}
              {project.dataGaps?.locationEstimated ? (
                <span className="text-[#9a3412]">
                  · pin aprox.
                  {String(project.dataGaps?.locationSource || '').startsWith(
                    'sector:',
                  )
                    ? ` (${String(project.dataGaps.locationSource)
                        .slice('sector:'.length)
                        .replace(/-/g, ' ')})`
                    : ' por comuna'}
                </span>
              ) : project.lat != null ? (
                <span className="text-[var(--teal)]">· pin según ficha</span>
              ) : null}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-[var(--line)] text-[var(--ink)] hover:bg-[var(--sand)]"
            aria-label="Cerrar ficha"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="overflow-y-auto px-4 py-4 sm:px-5">
          <div className="overflow-hidden rounded-xl bg-[var(--sand)]">
            <GalleryImage src={activeSrc} alt={`Foto de ${project.name}`} />
          </div>
          {gallery.length > 1 ? (
            <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
              {gallery.map((src, i) => {
                const thumb = safeImageUrl(src)
                if (!thumb) return null
                return (
                  <button
                    key={src}
                    type="button"
                    onClick={() => setActiveIdx(i)}
                    className={`h-14 w-20 shrink-0 overflow-hidden rounded-md border ${
                      i === activeIdx
                        ? 'border-[var(--teal)] ring-2 ring-[var(--teal)]/40'
                        : 'border-[var(--line)]'
                    }`}
                  >
                    <img
                      src={thumb}
                      alt=""
                      className="h-full w-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </button>
                )
              })}
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-2xl font-semibold text-[var(--teal)]">
                Desde {formatUf(project.priceFromUf)}
              </p>
              <p className="text-xs text-[var(--muted-ink)]">
                ≈ {formatClp(ufToClp(project.priceFromUf))}
                {project.priceToUf && project.priceToUf !== project.priceFromUf
                  ? ` · hasta ${formatUf(project.priceToUf)}`
                  : ''}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              {project.subsidies.map((s) => (
                <span
                  key={s}
                  className={`rounded-full px-2.5 py-1 ${
                    s === 'Sin subsidio'
                      ? 'bg-[var(--sand)]'
                      : 'bg-[#d7f0ec] text-[#0f4f48]'
                  }`}
                >
                  {s}
                </span>
              ))}
              <span className="rounded-full border border-[var(--line)] px-2.5 py-1 capitalize">
                {project.propertyType}
              </span>
              <span className="rounded-full border border-[var(--line)] px-2.5 py-1 capitalize">
                {project.condition}
              </span>
            </div>
          </div>

          {project.description ? (
            <div className="mt-5">
              <h3 className="font-[family-name:var(--font-display)] text-lg">
                Descripción
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--muted-ink)]">
                {project.description}
              </p>
            </div>
          ) : (
            <div className="mt-5 rounded-xl border border-dashed border-[var(--line)] bg-[var(--sand)]/50 p-3 text-sm text-[var(--muted-ink)]">
              Esta ficha no trae una descripción usable. Revisa el aviso
              original y sala de ventas.
            </div>
          )}

          <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
            <div className="flex items-center gap-2">
              <BedDouble className="size-4 text-[var(--teal)]" />
              {project.bedroomsMin === project.bedroomsMax
                ? `${project.bedroomsMin} dormitorios`
                : `${project.bedroomsMin}–${project.bedroomsMax} dormitorios`}
            </div>
            <div className="flex items-center gap-2">
              <Bath className="size-4 text-[var(--teal)]" />
              {project.bathroomsMin === project.bathroomsMax
                ? `${project.bathroomsMin} baño(s)`
                : `${project.bathroomsMin}–${project.bathroomsMax} baños`}
            </div>
            <div className="flex items-center gap-2">
              <Car className="size-4 text-[var(--teal)]" />
              Estacionamiento:{' '}
              {project.parking === 'si'
                ? 'disponible / en ficha'
                : project.parking === 'no'
                  ? 'no'
                  : 'consultar'}
            </div>
            {project.areaM2 ? (
              <div className="flex items-center gap-2">
                <Square className="size-4 text-[var(--teal)]" />
                {project.areaM2} m²
              </div>
            ) : null}
            <div className="flex items-center gap-2">
              <CircleDollarSign className="size-4 text-[var(--teal)]" />
              Entrega: {project.delivery}
            </div>
            <div className="flex items-start gap-2">
              <TrainFront className="mt-0.5 size-4 text-[var(--teal)]" />
              <div>
                {(() => {
                  const access = accessSummary(project)
                  return (
                    <>
                      <p className="text-xs font-medium text-[var(--ink)]">
                        {access.title}
                      </p>
                      <ConnectivityBars
                        score={access.score}
                        title={access.detail}
                      />
                      <p className="mt-1 text-xs text-[var(--muted-ink)]">
                        {access.detail}
                      </p>
                    </>
                  )
                })()}
              </div>
            </div>
          </div>

          {project.amenities?.length ? (
            <div className="mt-5">
              <h3 className="font-[family-name:var(--font-display)] text-lg">
                Amenidades detectadas
              </h3>
              <ul className="mt-2 flex flex-wrap gap-2">
                {project.amenities.map((a) => (
                  <li
                    key={a}
                    className="rounded-full border border-[var(--line)] bg-[var(--sand)]/60 px-2.5 py-1 text-xs"
                  >
                    {a}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11px] text-[var(--muted-ink)]">
                Tomadas del aviso público; confirma vigencia en sala de ventas.
              </p>
            </div>
          ) : null}

          <div className="mt-5 rounded-xl bg-[var(--sand)]/70 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide">
              Lo que conviene saber
            </p>
            <ul className="grid gap-2 sm:grid-cols-2">
              {signals.map((s) => (
                <li key={s.id} className="text-xs text-[var(--muted-ink)]">
                  <span className="font-medium text-[var(--ink)]">{s.label}.</span>{' '}
                  {s.detail}
                </li>
              ))}
            </ul>
          </div>

          {project.notes ? (
            <p className="mt-4 text-xs text-[var(--muted-ink)]">{project.notes}</p>
          ) : null}

          <div className="mt-5 rounded-xl border border-[var(--line)] p-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
              <Star className="size-3.5 text-[var(--teal)]" />
              Opiniones y reclamos
            </div>
            <div className="flex flex-wrap gap-2">
              {reputationLinks(project).map((link) => {
                const href = safeHttpUrl(link.url)
                if (!href) return null
                return (
                  <a
                    key={link.id}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--line)] px-3 text-xs hover:border-[var(--teal)] hover:bg-[var(--sand)]"
                  >
                    {link.id.startsWith('sernac') ? (
                      <Scale className="size-3.5 text-[var(--teal)]" />
                    ) : (
                      <Star className="size-3.5 text-[var(--teal)]" />
                    )}
                    {link.label}
                    <ExternalLink className="size-3 opacity-60" />
                  </a>
                )
              })}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--line)] bg-white px-4 py-3 sm:px-5">
          <div className="flex flex-wrap gap-2">
            {wa ? (
              <a
                href={wa}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#128C7E] px-3 text-xs font-medium text-white hover:bg-[#0e7a6e]"
              >
                <MessageCircle className="size-3.5" />
                WhatsApp
                {project.contactPhone ? ` ${project.contactPhone}` : ''}
              </a>
            ) : null}
            {project.sources.map((s) => {
              const href = safeHttpUrl(s.url)
              if (!href) return null
              return (
                <a
                  key={`${project.id}-${s.portal}-${s.url}`}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--line)] px-3 text-xs hover:bg-[var(--sand)]"
                >
                  <Layers className="size-3.5" />
                  {portalName[s.portal] || s.portal}
                  <ExternalLink className="size-3" />
                </a>
              )
            })}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 items-center rounded-lg bg-[var(--ink)] px-4 text-xs font-medium text-white"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
