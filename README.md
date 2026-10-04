# Güan Portal

Buscador unificado y más honesto de **proyectos inmobiliarios publicados en Chile**. Sitio estático en JavaScript (Vite + React), **sin base de datos**, hospedado en GitHub Pages.

Agrega fichas públicas de portales listados por el MINVU ([portales de proyectos](https://www.minvu.gob.cl/beneficio/vivienda/portales-de-proyectos/)) y sitios de inmobiliarias scrapeables: Subsidios.cl, UsaTuSubsidio, Enlace/BCI, Los Silos, Ingevec, Ciclos, Euro, Ecomac, Socovesa, Paz, Aitue, Bricsa y Galilea.

## Sitio

- Repo: https://github.com/claudette-letelier/guan-portal
- GitHub Pages: https://claudette-letelier.github.io/guan-portal/

## Filtros

- Subsidio / sin subsidio (DS19, DS1, tramos)
- Región
- Casa o departamento
- Nuevo o usado
- Precio en UF (y equivalente CLP referencial)
- Dormitorios y baños
- Estacionamiento
- Ranking de conectividad a Metro de Santiago (1–5)

## Local

```bash
npm install
npm run dev
```

## Actualización diaria (04:00 Chile)

El workflow `.github/workflows/daily-update.yml` corre **todos los días cerca de las 04:00 (America/Santiago)**:

1. Lee la **UF del día** desde [mindicador.cl](https://mindicador.cl/api/uf)
2. Actualiza proyectos desde **13+ fuentes**
3. Hace commit del catálogo si cambió
4. Rebuild + deploy a la rama `gh-pages` con `VITE_BASE=/guan-portal/`

También puedes lanzarlo a mano en GitHub → **Actions → Daily catalog update → Run workflow**.

### Probar en local

```bash
npm run update:catalog
```

## Publicar en GitHub Pages (manual)

```bash
VITE_BASE=/guan-portal/ npm run build
# subir contenido de dist/ a la rama gh-pages
```

## Seguridad (página estática)

Güan Portal es **solo frontend en GitHub Pages**: no hay login ni base de datos propia. Aun así conviene:

### Ya aplicado en el repo

- **HTTPS** vía GitHub Pages
- **CSP** (Content-Security-Policy) en `index.html`
- **Referrer / nosniff / Permissions-Policy**
- Enlaces externos con `rel="noopener noreferrer"`
- Validación de URLs scrapeadas (`safeHttpUrl` / `safeImageUrl`) — bloquea `javascript:` y protocolos raros
- **Dependabot** semanal (npm + Actions)
- Sin secretos en el cliente (el catálogo es público)

### Checklist en tu cuenta GitHub

1. **Settings → Pages**: Source = rama `gh-pages` / carpeta `/ (root)`
2. **Settings → Actions**: permitir Actions; el workflow usa `GITHUB_TOKEN` (no pegues PATs en el código)
3. **Settings → Secrets**: no guardes tokens de scraping en el frontend
4. Activa **2FA** en tu cuenta
5. Revisa PRs de Dependabot antes de mergear
6. Si compartes el repo, evita tokens `gho_` / `ghp_` en historial (`git log`, Issues, Actions logs)

### Límites realistas

Una página estática no puede “blindarse” como un banco: el JS es público. El riesgo principal es **XSS** (inyectar scripts) o **links maliciosos** en datos scrapeados; por eso filtramos URLs y usamos CSP. No hay servidor propio que un atacante pueda “hackear” para robar contraseñas de usuarios finales.

## Aviso

Precios, cupos de subsidio y tipologías cambian. Confirma siempre en el portal de origen y en sala de ventas / SERVIU.
