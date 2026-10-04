import { useMemo, useRef, useState } from 'react'
import {
  Building2,
  Car,
  ExternalLink,
  Filter,
  MapPin,
  Search,
  TrainFront,
  Bath,
  BedDouble,
  CircleDollarSign,
  Layers,
  Info,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  ImageOff,
  RotateCcw,
} from 'lucide-react'
import { catalog, catalogMeta, UF_CLP } from './data/catalog.js'
import { portals, REGIONS, SUBSIDY_OPTIONS } from './data/portals.js'
import {
  connectivityLabel,
  filterCatalog,
  formatClp,
  formatUf,
  sortCatalog,
  ufToClp,
} from './lib/search.js'
import { honestyScore, truthSignals } from './lib/truth.js'

const portalName = Object.fromEntries(portals.map((p) => [p.id, p.name]))

const defaultFilters = {
  q: '',
  subsidy: 'todos',
  subsidyType: 'todos',
  region: 'todas',
  propertyType: 'todos',
  condition: 'todos',
  bedrooms: 0,
  bathrooms: 0,
  parking: 'todos',
  priceMinUf: '',
  priceMaxUf: '',
  minConnectivity: 0,
  sortBy: 'metro-desc',
}

function ConnectivityBars({ score }) {
  if (score == null) {
    return <span className="text-xs text-[var(--muted-ink)]">N/A</span>
  }
  return (
    <div className="flex items-center gap-1" title={connectivityLabel(score)}>
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

function SignalIcon({ tone }) {
  if (tone === 'ok') return <CheckCircle2 className="size-3.5 text-[var(--teal)]" />
  if (tone === 'warn') return <AlertTriangle className="size-3.5 text-[#b45309]" />
  if (tone === 'gap') return <HelpCircle className="size-3.5 text-[#9a3412]" />
  return <Info className="size-3.5 text-[var(--muted-ink)]" />
}

function ProjectImage({ src, alt }) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) {
    return (
      <div className="flex h-full min-h-[140px] w-full flex-col items-center justify-center gap-2 bg-[linear-gradient(145deg,#134e4a_0%,#1c3d4a_55%,#0b2e2b_100%)] text-white/70">
        <ImageOff className="size-6 opacity-70" />
        <span className="px-3 text-center text-xs">Sin foto pública verificada</span>
      </div>
    )
  }
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="h-full min-h-[140px] w-full object-cover"
    />
  )
}

export default function App() {
  const [filters, setFilters] = useState(defaultFilters)
  const [showPortals, setShowPortals] = useState(false)
  const buscadorRef = useRef(null)
  const resultsTopRef = useRef(null)

  function set(key, value) {
    setFilters((f) => ({ ...f, [key]: value }))
  }

  function clearFilters() {
    setFilters(defaultFilters)
    // Sube la ventana completa (no solo la columna de resultados).
    requestAnimationFrame(() => {
      const top =
        buscadorRef.current?.getBoundingClientRect().top + window.scrollY - 12
      window.scrollTo({ top: Math.max(0, top || 0), behavior: 'smooth' })
    })
  }

  const results = useMemo(() => {
    const parsed = {
      ...filters,
      priceMinUf: filters.priceMinUf === '' ? 0 : Number(filters.priceMinUf),
      priceMaxUf: filters.priceMaxUf === '' ? 0 : Number(filters.priceMaxUf),
      bedrooms: Number(filters.bedrooms),
      bathrooms: Number(filters.bathrooms),
      minConnectivity: Number(filters.minConnectivity),
    }
    return sortCatalog(filterCatalog(catalog, parsed), filters.sortBy)
  }, [filters])

  const stats = useMemo(() => {
    const withSub = catalog.filter(
      (p) => !(p.subsidies.length === 1 && p.subsidies[0] === 'Sin subsidio'),
    ).length
    const withPhoto = catalog.filter((p) => p.imageUrl).length
    const regions = new Set(catalog.map((p) => p.region)).size
    return { total: catalog.length, withSub, regions, withPhoto }
  }, [])

  return (
    <div className="min-h-screen overflow-x-hidden bg-[var(--paper)] text-[var(--ink)]">
      <header className="relative isolate overflow-hidden">
        <div
          className="absolute inset-0 -z-10"
          style={{
            background:
              'radial-gradient(ellipse 70% 55% at 15% 20%, rgba(242,169,59,0.28), transparent 55%), linear-gradient(160deg, #0b2e2b 0%, #134e4a 45%, #1c3d4a 100%)',
          }}
        />
        <div
          className="pointer-events-none absolute -right-16 top-10 h-56 w-56 rounded-full bg-[#f2a93b]/20 blur-3xl"
          style={{ animation: 'soft-pulse 7s ease-in-out infinite' }}
        />
        <div className="mx-auto max-w-6xl px-5 pb-10 pt-8 sm:px-8">
          <nav className="flex flex-wrap items-center justify-between gap-3 text-sm text-white/80">
            <span className="font-[family-name:var(--font-display)] text-xl text-white">
              Güan Portal
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowPortals((v) => !v)}
                className="rounded-md border border-white/20 px-3 py-1.5 hover:bg-white/10"
              >
                Portales fuente
              </button>
              <a
                href="#buscador"
                className="rounded-md bg-[#f2a93b] px-3 py-1.5 font-medium text-[#0b2e2b]"
              >
                Buscar
              </a>
            </div>
          </nav>

          <p className="mt-14 font-[family-name:var(--font-display)] text-5xl leading-[0.95] text-white sm:text-7xl">
            Güan Portal
          </p>
          <h1 className="mt-5 max-w-2xl text-2xl font-medium text-[#f6e7c5] sm:text-3xl">
            La verdad detrás de cada proyecto, no el brochure.
          </h1>
          <p className="mt-4 max-w-2xl text-white/75">
            Un solo buscador que cruza portales públicos de Chile y marca lo que
            falta: precio “desde”, metro estimado, cupos inciertos y datos a
            consultar. Menos marketing, más señal útil.
          </p>

          <div className="mt-8 grid max-w-2xl grid-cols-2 gap-3 text-white sm:grid-cols-4">
            <div className="rounded-xl bg-white/10 p-3 backdrop-blur">
              <p className="text-2xl font-semibold">{stats.total}</p>
              <p className="text-xs text-white/70">proyectos</p>
            </div>
            <div className="rounded-xl bg-white/10 p-3 backdrop-blur">
              <p className="text-2xl font-semibold">{stats.withSub}</p>
              <p className="text-xs text-white/70">con subsidio</p>
            </div>
            <div className="rounded-xl bg-white/10 p-3 backdrop-blur">
              <p className="text-2xl font-semibold">{stats.withPhoto}</p>
              <p className="text-xs text-white/70">con foto</p>
            </div>
            <div className="rounded-xl bg-white/10 p-3 backdrop-blur">
              <p className="text-2xl font-semibold">{stats.regions}</p>
              <p className="text-xs text-white/70">regiones</p>
            </div>
          </div>
        </div>
      </header>

      {showPortals ? (
        <section className="border-b border-[var(--line)] bg-[var(--sand)] px-5 py-8 sm:px-8">
          <div className="mx-auto max-w-6xl">
            <h2 className="font-[family-name:var(--font-display)] text-2xl">
              Portales de origen
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-[var(--muted-ink)]">
              Güan Portal no reemplaza la postulación oficial: te lleva a la
              ficha de origen y te avisa qué dato no está confirmado.
            </p>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {portals.map((p) => (
                <a
                  key={p.id}
                  href={p.url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl border border-[var(--line)] bg-white p-4 hover:border-[var(--teal)]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold">{p.name}</p>
                    <ExternalLink className="size-4 text-[var(--teal)]" />
                  </div>
                  <p className="mt-1 text-sm text-[var(--muted-ink)]">{p.role}</p>
                </a>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section
        id="buscador"
        ref={buscadorRef}
        className="px-5 py-10 sm:px-8"
      >
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="rounded-2xl border border-[var(--line)] bg-white p-5 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto lg:overscroll-contain">
            <div className="mb-4 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-medium">
                <Filter className="size-4 text-[var(--teal)]" />
                Filtros
              </div>
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-1 rounded-md border border-[var(--line)] px-2.5 py-1 text-xs hover:bg-[var(--sand)]"
              >
                <RotateCcw className="size-3.5" />
                Limpiar
              </button>
            </div>

            <label className="mb-4 block text-sm">
              <span className="mb-1 block font-medium">Buscar</span>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-[var(--muted-ink)]" />
                <input
                  value={filters.q}
                  onChange={(e) => set('q', e.target.value)}
                  placeholder="Comuna, proyecto, inmobiliaria…"
                  className="h-10 w-full rounded-lg border border-[var(--line)] bg-[var(--paper)] pl-9 pr-3"
                />
              </div>
            </label>

            <fieldset className="mb-4 space-y-2 text-sm">
              <legend className="mb-1 font-medium">Subsidio</legend>
              {[
                ['todos', 'Todos'],
                ['con', 'Con subsidio'],
                ['sin', 'Sin subsidio'],
              ].map(([v, label]) => (
                <label key={v} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="subsidy"
                    checked={filters.subsidy === v}
                    onChange={() => set('subsidy', v)}
                  />
                  {label}
                </label>
              ))}
              {filters.subsidy === 'con' ? (
                <select
                  value={filters.subsidyType}
                  onChange={(e) => set('subsidyType', e.target.value)}
                  className="mt-2 h-9 w-full rounded-lg border border-[var(--line)] px-2"
                >
                  <option value="todos">Cualquier tipo</option>
                  {SUBSIDY_OPTIONS.filter((s) => s !== 'Sin subsidio').map(
                    (s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ),
                  )}
                </select>
              ) : null}
            </fieldset>

            <label className="mb-3 block text-sm">
              <span className="mb-1 block font-medium">Región</span>
              <select
                value={filters.region}
                onChange={(e) => set('region', e.target.value)}
                className="h-10 w-full rounded-lg border border-[var(--line)] px-2"
              >
                <option value="todas">Todas</option>
                {REGIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>

            <label className="mb-3 block text-sm">
              <span className="mb-1 block font-medium">Tipo</span>
              <select
                value={filters.propertyType}
                onChange={(e) => set('propertyType', e.target.value)}
                className="h-10 w-full rounded-lg border border-[var(--line)] px-2"
              >
                <option value="todos">Casa o departamento</option>
                <option value="departamento">Departamento</option>
                <option value="casa">Casa</option>
              </select>
            </label>

            <label className="mb-3 block text-sm">
              <span className="mb-1 block font-medium">Nuevo o usado</span>
              <select
                value={filters.condition}
                onChange={(e) => set('condition', e.target.value)}
                className="h-10 w-full rounded-lg border border-[var(--line)] px-2"
              >
                <option value="todos">Todos</option>
                <option value="nuevo">Nuevo</option>
                <option value="usado">Usado / semi-nuevo</option>
              </select>
            </label>

            <div className="mb-3 grid grid-cols-2 gap-2 text-sm">
              <label>
                <span className="mb-1 block font-medium">Dorm. mín.</span>
                <select
                  value={filters.bedrooms}
                  onChange={(e) => set('bedrooms', e.target.value)}
                  className="h-10 w-full rounded-lg border border-[var(--line)] px-2"
                >
                  <option value={0}>Cualquiera</option>
                  <option value={1}>1+</option>
                  <option value={2}>2+</option>
                  <option value={3}>3+</option>
                </select>
              </label>
              <label>
                <span className="mb-1 block font-medium">Baños mín.</span>
                <select
                  value={filters.bathrooms}
                  onChange={(e) => set('bathrooms', e.target.value)}
                  className="h-10 w-full rounded-lg border border-[var(--line)] px-2"
                >
                  <option value={0}>Cualquiera</option>
                  <option value={1}>1+</option>
                  <option value={2}>2+</option>
                </select>
              </label>
            </div>

            <label className="mb-3 block text-sm">
              <span className="mb-1 block font-medium">Estacionamiento</span>
              <select
                value={filters.parking}
                onChange={(e) => set('parking', e.target.value)}
                className="h-10 w-full rounded-lg border border-[var(--line)] px-2"
              >
                <option value="todos">Todos</option>
                <option value="si">Incluido / disponible</option>
                <option value="si-o-consultar">Incluido o a consultar</option>
              </select>
            </label>

            <div className="mb-3 grid grid-cols-2 gap-2 text-sm">
              <label>
                <span className="mb-1 block font-medium">Precio mín. UF</span>
                <input
                  type="number"
                  min={0}
                  value={filters.priceMinUf}
                  onChange={(e) => set('priceMinUf', e.target.value)}
                  className="h-10 w-full rounded-lg border border-[var(--line)] px-2"
                  placeholder="0"
                />
              </label>
              <label>
                <span className="mb-1 block font-medium">Precio máx. UF</span>
                <input
                  type="number"
                  min={0}
                  value={filters.priceMaxUf}
                  onChange={(e) => set('priceMaxUf', e.target.value)}
                  className="h-10 w-full rounded-lg border border-[var(--line)] px-2"
                  placeholder="5000"
                />
              </label>
            </div>
            <p className="mb-3 text-xs text-[var(--muted-ink)]">
              UF referencial: {formatClp(UF_CLP)}. Ejemplo UF 2.200 ≈{' '}
              {formatClp(ufToClp(2200))}.
            </p>

            <label className="mb-3 block text-sm">
              <span className="mb-1 block font-medium">
                Conectividad metro Santiago (mín.)
              </span>
              <select
                value={filters.minConnectivity}
                onChange={(e) => set('minConnectivity', e.target.value)}
                className="h-10 w-full rounded-lg border border-[var(--line)] px-2"
              >
                <option value={0}>Cualquiera</option>
                <option value={3}>3+ (media o mejor)</option>
                <option value={4}>4+ (muy buena)</option>
                <option value={5}>Solo 5 (excelente)</option>
              </select>
            </label>

            <label className="mb-4 block text-sm">
              <span className="mb-1 block font-medium">Ordenar por</span>
              <select
                value={filters.sortBy}
                onChange={(e) => set('sortBy', e.target.value)}
                className="h-10 w-full rounded-lg border border-[var(--line)] px-2"
              >
                <option value="metro-desc">Mejor conectividad metro</option>
                <option value="precio-asc">Precio UF ↑</option>
                <option value="precio-desc">Precio UF ↓</option>
                <option value="nombre">Nombre</option>
              </select>
            </label>

            <button
              type="button"
              onClick={clearFilters}
              className="h-9 w-full rounded-lg border border-[var(--line)] text-sm hover:bg-[var(--sand)]"
            >
              Limpiar filtros
            </button>
          </aside>

          <div className="min-w-0">
            <div
              ref={resultsTopRef}
              className="mb-4 flex flex-wrap items-end justify-between gap-3"
            >
              <div>
                <h2 className="font-[family-name:var(--font-display)] text-3xl">
                  Resultados
                </h2>
                <p className="text-sm text-[var(--muted-ink)]">
                  {results.length} proyecto{results.length === 1 ? '' : 's'} ·
                  datos al {catalogMeta.generatedAt}
                </p>
              </div>
            </div>

            <div className="mb-5 flex items-start gap-2 rounded-xl border border-dashed border-[var(--teal)]/40 bg-white p-4 text-sm text-[var(--muted-ink)]">
              <Info className="mt-0.5 size-4 shrink-0 text-[var(--teal)]" />
              <p>{catalogMeta.disclaimer}</p>
            </div>

            {results.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--line)] bg-white p-12 text-center text-[var(--muted-ink)]">
                <p>No hay proyectos con esos filtros.</p>
                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-4 inline-flex h-9 items-center gap-2 rounded-lg bg-[var(--teal)] px-4 text-sm text-white"
                >
                  <RotateCcw className="size-3.5" />
                  Limpiar filtros y ver todos
                </button>
              </div>
            ) : (
              <div className="grid gap-4">
                {results.map((p) => {
                  const signals = truthSignals(p)
                  const score = honestyScore(p)
                  return (
                    <article
                      key={p.id}
                      className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white transition hover:border-[var(--teal)]/50"
                    >
                      <div className="grid sm:grid-cols-[200px_1fr]">
                        <div className="relative min-h-[160px] bg-[var(--sand)] sm:min-h-full">
                          <ProjectImage
                            src={p.imageUrl}
                            alt={`Foto de ${p.name}`}
                          />
                          <div className="absolute left-2 top-2 rounded-md bg-black/55 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-white backdrop-blur">
                            Transparencia {score}
                          </div>
                        </div>

                        <div className="p-5">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <h3 className="font-[family-name:var(--font-display)] text-2xl">
                                {p.name}
                              </h3>
                              <p className="mt-1 flex items-center gap-1.5 text-sm text-[var(--muted-ink)]">
                                <MapPin className="size-3.5" />
                                {p.comuna}, {p.region} · {p.developer}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-semibold text-[var(--teal)]">
                                Desde {formatUf(p.priceFromUf)}
                              </p>
                              <p className="text-xs text-[var(--muted-ink)]">
                                ≈ {formatClp(ufToClp(p.priceFromUf))}
                                {p.priceToUf && p.priceToUf !== p.priceFromUf
                                  ? ` · hasta ${formatUf(p.priceToUf)}`
                                  : ''}
                              </p>
                            </div>
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2 text-xs">
                            {p.subsidies.map((s) => (
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
                              {p.propertyType}
                            </span>
                            <span className="rounded-full border border-[var(--line)] px-2.5 py-1 capitalize">
                              {p.condition}
                            </span>
                            <span className="rounded-full border border-[var(--line)] px-2.5 py-1 capitalize">
                              Entrega: {p.delivery}
                            </span>
                          </div>

                          <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                            <div className="flex items-center gap-2">
                              <BedDouble className="size-4 text-[var(--teal)]" />
                              {p.bedroomsMin === p.bedroomsMax
                                ? `${p.bedroomsMin} dorm.`
                                : `${p.bedroomsMin}–${p.bedroomsMax} dorm.`}
                            </div>
                            <div className="flex items-center gap-2">
                              <Bath className="size-4 text-[var(--teal)]" />
                              {p.bathroomsMin === p.bathroomsMax
                                ? `${p.bathroomsMin} baño(s)`
                                : `${p.bathroomsMin}–${p.bathroomsMax} baños`}
                            </div>
                            <div className="flex items-center gap-2">
                              <Car className="size-4 text-[var(--teal)]" />
                              Estac.: {p.parking}
                            </div>
                            <div className="flex items-center gap-2">
                              <CircleDollarSign className="size-4 text-[var(--teal)]" />
                              {formatUf(p.priceFromUf)}
                            </div>
                          </div>

                          <div className="mt-4 rounded-xl bg-[var(--sand)]/70 p-3">
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--ink)]">
                              Lo que conviene saber
                            </p>
                            <ul className="grid gap-2 sm:grid-cols-2">
                              {signals.slice(0, 4).map((s) => (
                                <li
                                  key={s.id}
                                  className="flex items-start gap-2 text-xs text-[var(--muted-ink)]"
                                >
                                  <SignalIcon tone={s.tone} />
                                  <span>
                                    <span className="font-medium text-[var(--ink)]">
                                      {s.label}.
                                    </span>{' '}
                                    {s.detail}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>

                          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-4">
                            <div className="flex items-start gap-2 text-sm">
                              <TrainFront className="mt-0.5 size-4 text-[var(--teal)]" />
                              <div>
                                <p className="font-medium">
                                  Ranking metro Santiago
                                </p>
                                <ConnectivityBars score={p.connectivityScore} />
                                <p className="mt-1 text-xs text-[var(--muted-ink)]">
                                  {p.metroStation
                                    ? `${p.metroStation}${
                                        p.metroLine ? ` (${p.metroLine})` : ''
                                      }${
                                        p.metroWalkMin != null
                                          ? ` · ~${p.metroWalkMin} min`
                                          : ''
                                      }`
                                    : connectivityLabel(p.connectivityScore)}
                                </p>
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              {p.sources.map((s) => (
                                <a
                                  key={`${p.id}-${s.portal}-${s.url}`}
                                  href={s.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--line)] px-3 text-xs hover:bg-[var(--sand)]"
                                >
                                  <Layers className="size-3.5" />
                                  {portalName[s.portal] || s.portal}
                                  <ExternalLink className="size-3" />
                                </a>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="border-t border-[var(--line)] bg-[var(--sand)] px-5 py-12 sm:px-8">
        <div className="mx-auto max-w-6xl">
          <h2 className="font-[family-name:var(--font-display)] text-3xl">
            Cómo Güan Portal se diferencia
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-[var(--muted-ink)]">
            La mayoría de portales venden. Aquí priorizamos señales verificables
            y avisos de incertidumbre.
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {[
              [
                'Precio “desde” explícito',
                'Nunca presentamos el piso como el valor típico. Marcamos tipologías y rangos cuando existen.',
              ],
              [
                'Huecos a la vista',
                'Si falta estacionamiento, fecha de entrega o metro medido, lo etiquetamos en vez de inventarlo.',
              ],
              [
                'Cruce de fuentes',
                'Cuando un proyecto aparece en varios portales, lo destacamos para que contrastes.',
              ],
            ].map(([t, d]) => (
              <div
                key={t}
                className="rounded-2xl border border-[var(--line)] bg-white p-5"
              >
                <p className="font-semibold">{t}</p>
                <p className="mt-2 text-sm text-[var(--muted-ink)]">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="bg-[var(--ink)] px-5 py-10 text-sm text-white/70 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 sm:flex-row sm:justify-between">
          <div>
            <p className="font-[family-name:var(--font-display)] text-xl text-white">
              Güan Portal
            </p>
            <p className="mt-2 max-w-md">
              Buscador unificado estático (JavaScript, sin base de datos).
              Fuentes:{' '}
              <a
                className="underline"
                href="https://www.minvu.gob.cl/beneficio/vivienda/portales-de-proyectos/"
                target="_blank"
                rel="noreferrer"
              >
                portales MINVU
              </a>{' '}
              e inmobiliarias públicas.
            </p>
          </div>
          <p className="flex items-center gap-2 self-start sm:self-end">
            <Building2 className="size-4" />
            GitHub Pages · catálogo con señales de verdad
          </p>
        </div>
      </footer>
    </div>
  )
}
