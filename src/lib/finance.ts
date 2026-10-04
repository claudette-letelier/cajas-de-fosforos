import { UF_CLP, type Project } from "@/data/projects";

export function formatClp(value: number): string {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatUf(value: number): string {
  return `UF ${value.toLocaleString("es-CL", { maximumFractionDigits: 1 })}`;
}

/** Rough bank capacity: ~25–30% of net income for dividend */
export function estimateMaxDividend(salaryClp: number) {
  return {
    conservative: Math.round(salaryClp * 0.25),
    stretch: Math.round(salaryClp * 0.3),
  };
}

export function estimateFinancing(project: Project, salaryClp: number) {
  const subsidyUf = project.subsidyUf ?? 0;
  const netUf = Math.max(project.priceFromUf - subsidyUf, 0);
  const netClp = netUf * UF_CLP;
  const max = estimateMaxDividend(salaryClp);

  // Very rough 25-year mortgage at ~4.5% annual real-ish for illustration
  const monthlyRate = 0.004;
  const months = 300;
  const factor =
    (monthlyRate * Math.pow(1 + monthlyRate, months)) /
    (Math.pow(1 + monthlyRate, months) - 1);
  const estimatedDividend = Math.round(netClp * factor);

  let affordability: "cómodo" | "ajustado" | "apretado" = "cómodo";
  if (estimatedDividend > max.stretch) affordability = "apretado";
  else if (estimatedDividend > max.conservative) affordability = "ajustado";

  return {
    netUf,
    netClp,
    estimatedDividend,
    max,
    affordability,
  };
}

export function scoreProject(
  project: Project,
  filters: {
    minBedrooms: number;
    preferTwoBaths: boolean;
    requireParking: boolean;
    maxMetroWalk: number;
    hideFar: boolean;
  },
): number {
  let score = project.lifestyleFit * 20;

  if (project.bedrooms.some((b) => b >= filters.minBedrooms)) score += 15;
  else score -= 30;

  if (filters.preferTwoBaths) {
    if (project.bathrooms.some((b) => b >= 2)) score += 15;
    else score -= 10;
  }

  if (filters.requireParking) {
    if (project.parking === "incluido" || project.parking === "disponible")
      score += 15;
    else if (project.parking === "consultar") score += 5;
    else score -= 20;
  }

  if (project.metro.walkMinutes != null) {
    if (project.metro.walkMinutes <= filters.maxMetroWalk) score += 20;
    else if (project.metro.walkMinutes <= filters.maxMetroWalk + 8) score += 8;
    else score -= 5;
  } else {
    score -= 8;
  }

  if (filters.hideFar && project.status === "descartable") score -= 40;
  if (project.status === "prioridad") score += 10;

  return score;
}
