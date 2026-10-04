import { useMemo, useState } from 'react'
import {
  Building2,
  Car,
  CheckCircle2,
  ExternalLink,
  MapPin,
  PiggyBank,
  TrainFront,
  AlertTriangle,
  Bookmark,
  BookmarkCheck,
  Filter,
  Home,
  Wallet,
} from 'lucide-react'
import { developers, projects } from './data/projects.js'
import { eligibilityNotes, userProfile } from './data/profile.js'
import {
  estimateFinancing,
  estimateMaxDividend,
  formatClp,
  formatUf,
  scoreProject,
} from './lib/finance.js'

const statusLabel = {
  prioridad: 'Prioridad para ti',
  viable: 'Viable',
  alternativa: 'Alternativa',
  descartable: 'Baja prioridad',
}

const statusBg = {
  prioridad: 'bg-[var(--teal)]',
  viable: 'bg-[#1c4d5e]',
  alternativa: 'bg-[#5a6a6e]',
  descartable: 'bg-[#7a5a4a]',
}

export default function App() {
  const [minBedrooms, setMinBedrooms] = useState(2)
  const [preferTwoBaths, setPreferTwoBaths] = useState(true)
  const [requireParking, setRequireParking] = useState(true)
  const [maxMetroWalk, setMaxMetroWalk] = useState(15)
  const [hideFar, setHideFar] = useState(true)
  const [onlyPriority, setOnlyPriority] = useState(false)
  const [shortlist, setShortlist] = useState([])
  const [householdSize, setHouseholdSize] = useState('2')
  const [tab, setTab] = useState('ruta')

  const maxDividend = estimateMaxDividend(userProfile.salaryClp)

  const ranked = useMemo(() => {
    const filters = {
      minBedrooms,
      preferTwoBaths,
      requireParking,
      maxMetroWalk,
      hideFar,
    }

    return [...projects]
      .filter((p) => {
        if (hideFar && p.status === 'descartable') return false
        if (onlyPriority && p.status !== 'prioridad') return false
        if (!p.bedrooms.some((b) => b >= minBedrooms)) return false
        if (requireParking && p.parking === 'no') return false
        return true
      })
      .map((p) => ({
        project: p,
        score: scoreProject(p, filters),
        finance: estimateFinancing(p, userProfile.salaryClp),
      }))
      .sort((a, b) => b.score - a.score)
  }, [
    hideFar,
    maxMetroWalk,
    minBedrooms,
    onlyPriority,
    preferTwoBaths,
    requireParking,
  ])

  function toggleShortlist(id) {
    setShortlist((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  const shortlisted = projects.filter((p) => shortlist.includes(p.id))

  const tramoHint =
    householdSize === '1'
      ? 'Con hogar unipersonal y sueldo $1.850.000, Tramo 3 puede quedar fuera por tope de ingreso. Prioriza confirmar si tu RSH está hasta el 80% (Tramo 2).'
      : 'Con 2 o más integrantes, tu sueldo suele calzar mejor con los topes referenciales de Tramo 3. Aun así, pide evaluación con tu cartola RSH.'

  return (
    <div className="flex min-h-screen flex-col">
      <header className="relative isolate overflow-hidden">
        <div
          className="absolute inset-0 -z-10 animate-[soft-pulse_10s_ease-in-out_infinite]"
          style={{
            background:
              'radial-gradient(ellipse 80% 60% at 20% 20%, rgba(242,169,59,0.35), transparent 55%), radial-gradient(ellipse 70% 50% at 85% 10%, rgba(20,120,110,0.45), transparent 50%), linear-gradient(165deg, #0b2e2b 0%, #134e4a 38%, #1c3d4a 68%, #243447 100%)',
          }}
        />
        <div className="mx-auto flex min-h-[92vh] w-full max-w-6xl flex-col justify-end px-5 pb-16 pt-10 sm:px-8">
          <nav className="mb-auto flex items-center justify-between text-sm text-white/80">
            <span className="font-[family-name:var(--font-display)] text-lg tracking-tight text-white">
              Casa al Metro
            </span>
            <a
              href="#proyectos"
              className="rounded-md border border-white/20 bg-white/5 px-3 py-1.5 backdrop-blur transition hover:bg-white/10"
            >
              Ver proyectos
            </a>
          </nav>

          <p className="mt-24 font-[family-name:var(--font-display)] text-5xl leading-[0.95] text-white sm:text-7xl md:text-8xl">
            Casa al Metro
          </p>
          <h1 className="mt-6 max-w-2xl text-2xl font-medium leading-snug text-[#f6e7c5] sm:text-3xl">
            Tu mapa DS19 en Santiago: cerca del metro, con estacionamiento y
            lista para mudarte el próximo año.
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-white/75 sm:text-lg">
            Investigación con tu perfil: sueldo $1.850.000, RSH 80–90%, depto de
            2+ dormitorios, idealmente 2 baños, y lejos del “trasmano” de Buin.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="#proyectos"
              className="inline-flex h-10 items-center rounded-lg bg-[#f2a93b] px-4 text-sm font-medium text-[#0b2e2b] hover:bg-[#ffc15a]"
            >
              Explorar proyectos DS19
            </a>
            <a
              href="#elegibilidad"
              className="inline-flex h-10 items-center rounded-lg border border-white/30 px-4 text-sm font-medium text-white hover:bg-white/10"
            >
              Revisar elegibilidad
            </a>
          </div>
        </div>
      </header>

      <section
        id="perfil"
        className="border-b border-[var(--line)] bg-[var(--paper)] px-5 py-16 sm:px-8"
      >
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-[var(--teal)]">
              Tu punto de partida
            </p>
            <h2 className="mt-3 font-[family-name:var(--font-display)] text-4xl text-[var(--ink)] sm:text-5xl">
              Vives al lado del metro. Quieres seguir cerca.
            </h2>
            <p className="mt-4 max-w-xl text-[var(--muted-ink)]">
              Hoy estás en Santiago Centro, a una cuadra de Universidad de
              Chile. Te gusta la ubicación; lo que duele son los gastos comunes
              y el depto de 1 dormitorio. La meta: mudarte el próximo año con
              DS19, sin perder movilidad.
            </p>
            <ul className="mt-8 space-y-3">
              {userProfile.mustHave.map((item) => (
                <li key={item} className="flex gap-3 text-[var(--ink)]">
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-[var(--teal)]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="grid gap-4">
            <div className="rounded-2xl bg-[var(--ink)] p-6 text-white">
              <div className="flex items-center gap-2 text-[#f2a93b]">
                <Wallet className="size-5" />
                <span className="text-sm uppercase tracking-wider">Sueldo</span>
              </div>
              <p className="mt-3 font-[family-name:var(--font-display)] text-4xl">
                {formatClp(userProfile.salaryClp)}
              </p>
              <p className="mt-2 text-sm text-white/70">
                Capacidad referencial de dividendo:{' '}
                {formatClp(maxDividend.conservative)}–
                {formatClp(maxDividend.stretch)}/mes (25–30% del sueldo).
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--line)] bg-white p-6">
              <div className="flex items-center gap-2 text-[var(--teal)]">
                <Home className="size-5" />
                <span className="text-sm uppercase tracking-wider">RSH</span>
              </div>
              <p className="mt-3 font-[family-name:var(--font-display)] text-3xl text-[var(--ink)]">
                {userProfile.rshRange}
              </p>
              <p className="mt-2 text-sm text-[var(--muted-ink)]">
                Dentro del tope DS19 (hasta 90%). El detalle Tramo 2 vs 3
                depende de si estás exactamente hasta 80% o en 81–90%.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section
        id="elegibilidad"
        className="border-b border-[var(--line)] bg-[var(--sand)] px-5 py-16 sm:px-8"
      >
        <div className="mx-auto max-w-6xl">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-[var(--teal)]">
            Elegibilidad DS19
          </p>
          <h2 className="mt-3 max-w-2xl font-[family-name:var(--font-display)] text-4xl text-[var(--ink)]">
            El punto crítico no es el metro: es el tramo y el ingreso.
          </h2>

          <div className="mt-8 flex flex-wrap items-end gap-4">
            <label className="space-y-2 text-sm">
              <span className="block font-medium text-[var(--ink)]">
                Integrantes del hogar (RSH)
              </span>
              <select
                value={householdSize}
                onChange={(e) => setHouseholdSize(e.target.value)}
                className="h-10 w-56 rounded-lg border border-[var(--line)] bg-white px-3"
              >
                <option value="1">1 (unipersonal)</option>
                <option value="2">2 integrantes</option>
                <option value="3">3 o más</option>
              </select>
            </label>
            <p className="max-w-xl text-sm text-[var(--muted-ink)]">{tramoHint}</p>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-2">
            {eligibilityNotes.criticalChecks.map((item) => (
              <article
                key={item.title}
                className="rounded-2xl border border-[var(--line)] bg-white p-6"
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-1 size-5 shrink-0 text-[#c45c26]" />
                  <div>
                    <h3 className="text-lg font-semibold text-[var(--ink)]">
                      {item.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-[var(--muted-ink)]">
                      {item.detail}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-8 rounded-2xl border border-dashed border-[var(--teal)]/40 bg-white/70 p-6">
            <p className="flex items-center gap-2 font-medium text-[var(--ink)]">
              <PiggyBank className="size-5 text-[var(--teal)]" />
              Meta de ahorro esta semana
            </p>
            <p className="mt-2 text-sm text-[var(--muted-ink)]">
              Abre o revisa tu cuenta de ahorro para la vivienda y apunta a{' '}
              <strong>40 UF (~{formatClp(40 * 39500)})</strong> si estás en
              Tramo 2, o <strong>80 UF (~{formatClp(80 * 39500)})</strong> si
              entras por Tramo 3.
            </p>
          </div>
        </div>
      </section>

      <section
        id="proyectos"
        className="border-b border-[var(--line)] bg-[var(--paper)] px-5 py-16 sm:px-8"
      >
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-[var(--teal)]">
                Proyectos investigados
              </p>
              <h2 className="mt-3 font-[family-name:var(--font-display)] text-4xl text-[var(--ink)]">
                Ranking según tu estilo de vida
              </h2>
              <p className="mt-3 max-w-2xl text-[var(--muted-ink)]">
                Priorizamos comunas con metro real (San Joaquín, PAC, El Bosque,
                Cerrillos) y dejamos Buin como referencia, no como favorito.
              </p>
            </div>
            <span className="w-fit rounded-full bg-[var(--sand)] px-3 py-1 text-sm text-[var(--ink)]">
              {ranked.length} proyectos visibles
            </span>
          </div>

          <div className="mt-8 rounded-2xl border border-[var(--line)] bg-white p-5">
            <div className="mb-4 flex items-center gap-2 text-sm font-medium text-[var(--ink)]">
              <Filter className="size-4" />
              Filtros de tu búsqueda
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <label className="space-y-2 text-sm">
                <span className="block font-medium">Dormitorios mínimos</span>
                <select
                  value={minBedrooms}
                  onChange={(e) => setMinBedrooms(Number(e.target.value))}
                  className="h-10 w-full rounded-lg border border-[var(--line)] bg-[var(--paper)] px-3"
                >
                  <option value={2}>2+</option>
                  <option value={3}>3+</option>
                </select>
              </label>
              <label className="space-y-2 text-sm">
                <span className="block font-medium">Metro a pie (máx.)</span>
                <select
                  value={maxMetroWalk}
                  onChange={(e) => setMaxMetroWalk(Number(e.target.value))}
                  className="h-10 w-full rounded-lg border border-[var(--line)] bg-[var(--paper)] px-3"
                >
                  <option value={10}>10 minutos</option>
                  <option value={15}>15 minutos</option>
                  <option value={20}>20 minutos</option>
                </select>
              </label>
              <label className="flex items-center gap-3 rounded-xl border border-[var(--line)] px-3 py-3 text-sm">
                <input
                  type="checkbox"
                  checked={preferTwoBaths}
                  onChange={(e) => setPreferTwoBaths(e.target.checked)}
                />
                Priorizar 2 baños
              </label>
              <label className="flex items-center gap-3 rounded-xl border border-[var(--line)] px-3 py-3 text-sm">
                <input
                  type="checkbox"
                  checked={requireParking}
                  onChange={(e) => setRequireParking(e.target.checked)}
                />
                Con estacionamiento
              </label>
              <label className="flex items-center gap-3 rounded-xl border border-[var(--line)] px-3 py-3 text-sm sm:col-span-2">
                <input
                  type="checkbox"
                  checked={hideFar}
                  onChange={(e) => setHideFar(e.target.checked)}
                />
                Ocultar opciones muy apartadas (ej. Buin)
              </label>
              <label className="flex items-center gap-3 rounded-xl border border-[var(--line)] px-3 py-3 text-sm sm:col-span-2">
                <input
                  type="checkbox"
                  checked={onlyPriority}
                  onChange={(e) => setOnlyPriority(e.target.checked)}
                />
                Solo shortlist prioritaria
              </label>
            </div>
          </div>

          <div className="mt-8 grid gap-5">
            {ranked.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--line)] p-10 text-center text-[var(--muted-ink)]">
                No hay proyectos con esos filtros. Afloja metro a pie o
                estacionamiento para ver más opciones.
              </div>
            ) : (
              ranked.map(({ project, score, finance }, index) => (
                <article
                  key={project.id}
                  className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white transition hover:border-[var(--teal)]/40"
                >
                  <div className="grid gap-0 lg:grid-cols-[140px_1fr]">
                    <div
                      className={`flex flex-col items-center justify-center gap-1 px-4 py-6 text-center text-white ${statusBg[project.status]}`}
                    >
                      <span className="text-xs uppercase tracking-wider opacity-80">
                        Rank
                      </span>
                      <span className="font-[family-name:var(--font-display)] text-4xl">
                        {index + 1}
                      </span>
                      <span className="text-xs opacity-80">{score} pts</span>
                    </div>

                    <div className="p-6">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-[family-name:var(--font-display)] text-2xl text-[var(--ink)]">
                              {project.name}
                            </h3>
                            <span className="rounded-full border border-[var(--line)] px-2 py-0.5 text-xs">
                              {statusLabel[project.status]}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-[var(--muted-ink)]">
                            {project.developer} · {project.comuna}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleShortlist(project.id)}
                          className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-sm ${
                            shortlist.includes(project.id)
                              ? 'bg-[var(--teal)] text-white'
                              : 'border border-[var(--line)]'
                          }`}
                        >
                          {shortlist.includes(project.id) ? (
                            <BookmarkCheck className="size-4" />
                          ) : (
                            <Bookmark className="size-4" />
                          )}
                          {shortlist.includes(project.id)
                            ? 'En shortlist'
                            : 'Guardar'}
                        </button>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2 text-xs">
                        <span className="rounded-full bg-[var(--sand)] px-2.5 py-1 text-[var(--ink)]">
                          Desde {formatUf(project.priceFromUf)}
                        </span>
                        {project.subsidyUf ? (
                          <span className="rounded-full bg-[var(--sand)] px-2.5 py-1">
                            Subsidio ~{formatUf(project.subsidyUf)}
                          </span>
                        ) : null}
                        {project.subsidyFromClp ? (
                          <span className="rounded-full bg-[var(--sand)] px-2.5 py-1">
                            Subsidio desde {formatClp(project.subsidyFromClp)}
                          </span>
                        ) : null}
                        <span className="rounded-full border border-[var(--line)] px-2.5 py-1">
                          {project.bedrooms.join('/')} dorm
                        </span>
                        <span className="rounded-full border border-[var(--line)] px-2.5 py-1">
                          {project.bathrooms.join('/')} baño(s)
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full border border-[var(--line)] px-2.5 py-1">
                          <Car className="size-3" />
                          Estac.: {project.parking}
                        </span>
                      </div>

                      <div className="mt-4 flex items-start gap-2 text-sm text-[var(--ink)]">
                        <TrainFront className="mt-0.5 size-4 shrink-0" />
                        <p>
                          <span className="font-medium">
                            {project.metro.station}
                          </span>{' '}
                          ({project.metro.line})
                          {project.metro.walkMinutes != null
                            ? ` · ~${project.metro.walkMinutes} min a pie`
                            : ' · acceso no peatonal inmediato'}
                          . {project.metro.note}
                        </p>
                      </div>

                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--teal)]">
                            Por qué suma
                          </p>
                          <ul className="mt-2 space-y-1.5 text-sm text-[var(--muted-ink)]">
                            {project.highlights.map((h) => (
                              <li key={h} className="flex gap-2">
                                <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-[var(--teal)]" />
                                {h}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-[#c45c26]">
                            Validar antes de reservar
                          </p>
                          <ul className="mt-2 space-y-1.5 text-sm text-[var(--muted-ink)]">
                            {project.caveats.map((c) => (
                              <li key={c} className="flex gap-2">
                                <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-[#c45c26]" />
                                {c}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      <hr className="my-4 border-[var(--line)]" />

                      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                        <div className="text-[var(--muted-ink)]">
                          Dividendo estimativo tras subsidio:{' '}
                          <span className="font-semibold text-[var(--ink)]">
                            {formatClp(finance.estimatedDividend)}/mes
                          </span>{' '}
                          <span
                            className={`ml-1 rounded-full border px-2 py-0.5 text-xs ${
                              finance.affordability === 'cómodo'
                                ? 'border-emerald-600 text-emerald-700'
                                : finance.affordability === 'ajustado'
                                  ? 'border-amber-600 text-amber-700'
                                  : 'border-red-600 text-red-700'
                            }`}
                          >
                            {finance.affordability}
                          </span>
                          <span className="mt-1 block text-xs">
                            Neto a financiar ~{formatUf(finance.netUf)}.
                            Estimación ilustrativa.
                          </span>
                        </div>
                        <a
                          href={project.website}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--line)] px-3 text-sm hover:bg-[var(--sand)]"
                        >
                          Sitio / ficha
                          <ExternalLink className="size-3.5" />
                        </a>
                      </div>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="border-b border-[var(--line)] bg-[var(--sand)] px-5 py-16 sm:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="inline-flex rounded-lg bg-white p-1">
            {[
              ['ruta', 'Ruta al próximo año'],
              ['inmobiliarias', 'Inmobiliarias'],
              ['shortlist', `Shortlist (${shortlist.length})`],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`rounded-md px-3 py-1.5 text-sm ${
                  tab === id ? 'bg-[var(--teal)] text-white' : 'text-[var(--ink)]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === 'ruta' ? (
            <ol className="relative mt-6 space-y-6 border-l-2 border-[var(--teal)]/30 pl-6">
              {[
                {
                  t: 'Esta semana',
                  d: 'Saca cartola RSH actualizada, confirma tramo exacto (80 vs 90) e integrantes del hogar. Abre/refuerza ahorro vivienda.',
                },
                {
                  t: 'Próximos 15 días',
                  d: 'Agenda salas de ventas de Matta Vial 624, Lira Parque / Maestra y Gran Avenida (Ciclos). Pregunta cupo DS19, 2D/2B, estacionamiento y gastos comunes estimados.',
                },
                {
                  t: 'Mes 1–2',
                  d: 'Simula crédito en 2 bancos con tu liquidación. Compara dividendo real vs el techo de ~$462.000–$555.000.',
                },
                {
                  t: 'Mes 2–4',
                  d: 'Reserva la unidad que cumpla metro + estacionamiento + tipología. La inmobiliaria tramita el DS19 automático si hay cupo.',
                },
                {
                  t: 'Meta mudanza',
                  d: 'Apunta a escrituración/entrega alineada al próximo año. Prioriza proyectos con entrega inmediata o avance real.',
                },
              ].map((step, i) => (
                <li key={step.t} className="relative">
                  <span className="absolute -left-[1.95rem] top-1 flex size-6 items-center justify-center rounded-full bg-[var(--teal)] text-xs text-white">
                    {i + 1}
                  </span>
                  <h3 className="font-semibold text-[var(--ink)]">{step.t}</h3>
                  <p className="mt-1 text-sm text-[var(--muted-ink)]">{step.d}</p>
                </li>
              ))}
            </ol>
          ) : null}

          {tab === 'inmobiliarias' ? (
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {developers.map((dev) => (
                <article
                  key={dev.name}
                  className="rounded-2xl border border-[var(--line)] bg-white p-6"
                >
                  <div className="flex items-center gap-2 text-[var(--teal)]">
                    <Building2 className="size-5" />
                    <h3 className="text-lg font-semibold text-[var(--ink)]">
                      {dev.name}
                    </h3>
                  </div>
                  <p className="mt-2 flex items-start gap-2 text-sm text-[var(--muted-ink)]">
                    <MapPin className="mt-0.5 size-4 shrink-0" />
                    {dev.focus}
                  </p>
                  <p className="mt-3 text-sm text-[var(--ink)]">{dev.note}</p>
                  <a
                    href={dev.website}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--line)] px-3 text-sm"
                  >
                    Visitar
                    <ExternalLink className="size-3.5" />
                  </a>
                </article>
              ))}
            </div>
          ) : null}

          {tab === 'shortlist' ? (
            <div className="mt-6">
              {shortlisted.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[var(--line)] bg-white p-10 text-center text-[var(--muted-ink)]">
                  Aún no guardas proyectos. Usa “Guardar” en el ranking para
                  armar tu visita a salas de ventas.
                </div>
              ) : (
                <ul className="space-y-3">
                  {shortlisted.map((p) => (
                    <li
                      key={p.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-white px-4 py-3"
                    >
                      <div>
                        <p className="font-medium text-[var(--ink)]">{p.name}</p>
                        <p className="text-sm text-[var(--muted-ink)]">
                          {p.comuna} · desde {formatUf(p.priceFromUf)}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <a
                          href={p.website}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-8 items-center rounded-lg border border-[var(--line)] px-3 text-sm"
                        >
                          Abrir
                        </a>
                        <button
                          type="button"
                          onClick={() => toggleShortlist(p.id)}
                          className="inline-flex h-8 items-center px-3 text-sm text-[var(--muted-ink)]"
                        >
                          Quitar
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </div>
      </section>

      <footer className="bg-[var(--ink)] px-5 py-10 text-sm text-white/70 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-[family-name:var(--font-display)] text-xl text-white">
            Casa al Metro
          </p>
          <p className="max-w-xl">
            Sitio estático en JavaScript (sin base de datos). Precios y cupos
            DS19 cambian: confirma en sala de ventas y MINVU/SERVIU.
          </p>
        </div>
      </footer>
    </div>
  )
}
