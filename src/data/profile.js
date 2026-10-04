export const userProfile = {
  name: "Perfil de búsqueda",
  salaryClp: 1_850_000,
  rshRange: "80–90%",
  currentLocation: "Santiago Centro, a 1 cuadra de Metro Universidad de Chile",
  moveTarget: "Próximo año",
  mustHave: [
    "Subsidio DS19 (integración social y territorial)",
    "Departamento con más de 1 dormitorio",
    "Ojalá 2 baños",
    "Estacionamiento",
    "Cerca de metro",
    "Barrio tranquilo",
  ],
  niceToHave: [
    "Gastos comunes más razonables que el depto actual",
    "Acceso a eventos y vida urbana (no tan trasmano)",
  ],
  avoid: [
    "Buin como primera opción (tren sí, pero apartado del estilo de vida)",
    "Solo 1 dormitorio",
    "Zonas sin metro consolidado si hay alternativa similar",
  ],
};

export const eligibilityNotes = {
  ds19Basics: [
    "El DS19 permite comprar en proyectos de integración social desarrollados por inmobiliarias/constructoras.",
    "Puedes postular sin subsidio previo si cumples requisitos de sectores medios (DS1): ahorro + RSH + no ser propietario.",
    "Tope general: hasta el 90% en el Registro Social de Hogares.",
  ],
  criticalChecks: [
    {
      title: "Confirma tu tramo exacto en el RSH",
      detail:
        "Si estás hasta el 80%, puedes mirar Tramo 2 (ahorro mínimo referencial 40 UF). Si estás entre 81–90%, normalmente entras por Tramo 3 (ahorro referencial 80 UF) y aplican topes de ingreso familiar.",
    },
    {
      title: "Revisa el tamaño de tu grupo familiar",
      detail:
        "Con sueldo $1.850.000, un hogar unipersonal puede chocar con el tope referencial de Tramo 3 (~$1.327.000). Con 2 integrantes el tope referencial sube a ~$1.917.000. Esto hay que validarlo en sala de ventas / SERVIU con tu cartola RSH.",
    },
    {
      title: "Ahorro mínimo",
      detail:
        "Abre o refuerza tu cuenta de ahorro para la vivienda ya. Meta realista: 40–80 UF según el tramo que te corresponda (aprox. $1,6–$3,2 millones con UF $39.500).",
    },
    {
      title: "No ser propietario",
      detail:
        "Ni tú, ni cónyuge/conviviente civil, ni el núcleo familiar declarado pueden tener vivienda.",
    },
  ],
};
