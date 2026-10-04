/** Señales honestas que los portales comerciales suelen omitir. */
export function truthSignals(project) {
  const gaps = project.dataGaps || {}
  const signals = []

  signals.push({
    id: 'desde',
    tone: 'warn',
    label: 'Precio “desde”',
    detail: 'El valor publicado es el piso de tipología; tipologías reales suelen ser más caras.',
  })

  if (gaps.parkingUnknown || project.parking === 'consultar') {
    signals.push({
      id: 'parking',
      tone: 'gap',
      label: 'Estacionamiento no confirmado',
      detail: 'No está claro si incluye, cuesta extra o hay lista de espera.',
    })
  }

  if (gaps.deliveryUnknown || project.delivery === 'consultar') {
    signals.push({
      id: 'delivery',
      tone: 'gap',
      label: 'Entrega sin fecha firme',
      detail: '“Venta en verde / blanco” puede correrse; pide cláusula y multa por atraso.',
    })
  }

  if (project.region === 'Metropolitana') {
    if (gaps.metroEstimated || project.metroWalkMin == null) {
      signals.push({
        id: 'metro',
        tone: 'gap',
        label: 'Metro estimado por comuna',
        detail: 'No es distancia medida puerta-estación; verifica en Google Maps / recorrido real.',
      })
    } else if (project.metroWalkMin > 15) {
      signals.push({
        id: 'metro-far',
        tone: 'warn',
        label: `~${project.metroWalkMin} min al metro`,
        detail: 'Más de 15 min a pie suele significar bus o bici en la práctica diaria.',
      })
    }
  }

  if ((project.sources || []).length >= 2) {
    signals.push({
      id: 'multi',
      tone: 'ok',
      label: 'Cruce de fuentes',
      detail: `Aparece en ${project.sources.length} portales; compara precio y tipología en cada uno.`,
    })
  } else {
    signals.push({
      id: 'single',
      tone: 'neutral',
      label: 'Una sola fuente',
      detail: 'Sin contraste: valida precio, GGOO y reglamento de copropiedad en sala de ventas.',
    })
  }

  if (project.subsidies?.includes('DS19') || project.subsidies?.some((s) => s.includes('DS1'))) {
    signals.push({
      id: 'subsidy',
      tone: 'warn',
      label: 'Cupo de subsidio no garantizado',
      detail: 'Que diga DS19/DS1 no significa que queden cupos SERVIU para tu RSH.',
    })
  }

  return signals
}

export function honestyScore(project) {
  const signals = truthSignals(project)
  let score = 70
  for (const s of signals) {
    if (s.tone === 'ok') score += 8
    if (s.tone === 'gap') score -= 10
    if (s.tone === 'warn') score -= 4
  }
  if (project.imageUrl) score += 5
  return Math.max(25, Math.min(95, score))
}
