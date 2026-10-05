#!/usr/bin/env python3
"""Rebuild src/data/comuna-indicators.json from CEAD parquet + catalog.

Requires: pandas, pyarrow
Downloads open CEAD extract from bastianolea/delincuencia_chile if missing.
"""
from __future__ import annotations

import json
import subprocess
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "src/data/comuna-indicators.json"
CACHE = Path("/tmp/cead")
CACHE.mkdir(parents=True, exist_ok=True)


def download(url: str, dest: Path) -> None:
    if dest.exists() and dest.stat().st_size > 1000:
        return
    print("download", url)
    urllib.request.urlretrieve(url, dest)


def main() -> None:
    import pandas as pd

    pq = CACHE / "cead.parquet"
    censo_p = CACHE / "censo.csv"
    download(
        "https://github.com/bastianolea/delincuencia_chile/raw/main/app/cead_delincuencia.parquet",
        pq,
    )
    download(
        "https://raw.githubusercontent.com/bastianolea/delincuencia_chile/main/app/censo_proyecciones_año.csv",
        censo_p,
    )

    df = pd.read_parquet(pq)
    censo = pd.read_csv(censo_p)
    DMCS = {
        "Homicidios",
        "Femicidios",
        "Robos con violencia o intimidación",
        "Robo por sorpresa",
        "Robo violento de vehículo motorizado",
        "Robo de vehículo motorizado",
        "Robo de objetos de o desde vehículo",
        "Robo en lugar habitado",
        "Robo en lugar no habitado",
        "Otros robos con fuerza en las cosas",
        "Hurtos",
        "Lesiones graves o gravísimas",
        "Lesiones menos graves",
        "Violaciones",
        "Abusos sexuales",
    }
    df["fecha"] = pd.to_datetime(df["fecha"])
    # Prefer the latest calendar year with ≥11 months of data
    chosen = None
    for year in sorted(df["fecha"].dt.year.unique(), reverse=True):
        probe = df[
            (df["fecha"].dt.year == year) & (df["delito"].astype(str).isin(DMCS))
        ]
        if probe["fecha"].dt.month.nunique() >= 11:
            chosen = int(year)
            break
    if chosen is None:
        chosen = int(df["fecha"].dt.year.max())
    print("using CEAD year", chosen)
    y = df[(df["fecha"].dt.year == chosen) & (df["delito"].astype(str).isin(DMCS))]
    agg = (
        y.groupby(["comuna", "region", "cut_comuna"], observed=True)["delito_n"]
        .sum()
        .reset_index()
        .rename(columns={"delito_n": "casos_dmcs"})
    )
    pop = censo[censo["año"] == chosen][["cut_comuna", "comuna", "población"]].copy()
    if pop.empty:
        pop = (
            censo.sort_values("año")
            .groupby("cut_comuna", as_index=False)
            .tail(1)[["cut_comuna", "comuna", "población"]]
        )
    agg["cut_comuna"] = agg["cut_comuna"].astype(float).astype(int)
    pop["cut_comuna"] = pop["cut_comuna"].astype(int)
    merged = agg.merge(pop[["cut_comuna", "población"]], on="cut_comuna", how="left")
    missing = merged["población"].isna()
    if missing.any():
        pop_by_name = (
            censo.sort_values("año")
            .groupby("comuna", as_index=False)
            .tail(1)
            .set_index("comuna")["población"]
        )
        merged.loc[missing, "población"] = merged.loc[missing, "comuna"].map(pop_by_name)
    merged = merged[merged["población"].notna() & (merged["población"] > 0)].copy()
    merged["tasa_dmcs_100k"] = (merged["casos_dmcs"] / merged["población"] * 100000).round(1)

    subprocess.check_call(
        [
            "node",
            "--input-type=module",
            "-e",
            """
import { catalog } from "./src/data/catalog.js"
import { writeFileSync } from "fs"
const by = {}
for (const p of catalog) {
  const k = p.comuna
  if (!by[k]) by[k] = { comuna: p.comuna, region: p.region, n: 0, sumPrice: 0, sumConn: 0, nConn: 0 }
  by[k].n++
  by[k].sumPrice += p.priceFromUf || 0
  if (p.connectivityScore != null) { by[k].sumConn += p.connectivityScore; by[k].nConn++ }
}
writeFileSync("/tmp/cead/catalog-by-comuna.json", JSON.stringify(by))
""",
        ],
        cwd=str(ROOT),
    )
    cat = json.loads(Path("/tmp/cead/catalog-by-comuna.json").read_text())

    rates = sorted(merged["tasa_dmcs_100k"].tolist())

    def pct(v, arr):
        if not arr or v is None:
            return None
        if len(arr) == 1:
            return 50.0
        less = sum(1 for x in arr if x < v)
        return round(100 * less / (len(arr) - 1), 1)

    indicators = {}
    for _, row in merged.iterrows():
        name = str(row["comuna"]).strip()
        cat_hit = next((v for k, v in cat.items() if k.casefold() == name.casefold()), None)
        oferta = cat_hit["n"] if cat_hit else 0
        precio = round(cat_hit["sumPrice"] / cat_hit["n"], 1) if cat_hit and cat_hit["n"] else None
        conn = (
            round(cat_hit["sumConn"] / cat_hit["nConn"], 2)
            if cat_hit and cat_hit["nConn"]
            else None
        )
        indicators[name] = {
            "comuna": name,
            "region": str(row["region"]).strip(),
            "cut": int(row["cut_comuna"]),
            "year": chosen,
            "casosDmcs": int(row["casos_dmcs"]),
            "poblacion": int(row["población"]),
            "tasaDmcs100k": float(row["tasa_dmcs_100k"]),
            "crimeScore": pct(float(row["tasa_dmcs_100k"]), rates),
            "projects": oferta,
            "priceAvgUf": precio,
            "connectivityAvg": conn,
        }

    for k, v in cat.items():
        if not any(k.casefold() == x.casefold() for x in indicators):
            indicators[k] = {
                "comuna": v["comuna"],
                "region": v["region"],
                "cut": None,
                "year": chosen,
                "casosDmcs": None,
                "poblacion": None,
                "tasaDmcs100k": None,
                "crimeScore": None,
                "projects": v["n"],
                "priceAvgUf": round(v["sumPrice"] / v["n"], 1),
                "connectivityAvg": round(v["sumConn"] / v["nConn"], 2)
                if v["nConn"]
                else None,
            }

    offers = [x["projects"] for x in indicators.values() if x["projects"]]
    prices = [x["priceAvgUf"] for x in indicators.values() if x["priceAvgUf"]]
    for x in indicators.values():
        x["offerScore"] = pct(x["projects"], offers) if x["projects"] else 0
        x["priceScore"] = pct(x["priceAvgUf"], prices) if x["priceAvgUf"] else None
        x["connectivityScore"] = (
            round((x["connectivityAvg"] or 0) / 5 * 100, 1)
            if x["connectivityAvg"] is not None
            else None
        )

    out = {
        "meta": {
            "source": "CEAD (dataset abierto delincuencia_chile) + catálogo Cajas de Fósforos",
            "year": chosen,
            "metric": "Tasa aproximada DMCS por 100 mil hab.",
            "disclaimer": "Indicador comunal, no de barrio. No es un mapa de zonas rojas.",
            "comunas": len(indicators),
        },
        "byComuna": indicators,
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")))
    print("wrote", OUT, "comunas", len(indicators), "year", chosen)


if __name__ == "__main__":
    main()
