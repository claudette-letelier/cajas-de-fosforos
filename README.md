# UnPortal

Buscador unificado de **proyectos inmobiliarios publicados en Chile**. Sitio estático en JavaScript (Vite + React), **sin base de datos**, hospedado en GitHub Pages.

Agrega fichas públicas de portales listados por el MINVU ([portales de proyectos](https://www.minvu.gob.cl/beneficio/vivienda/portales-de-proyectos/)), incluyendo Subsidios.cl, Enlace Inmobiliario / BancoEstado, UsaTuSubsidio y más.

## Sitio

- Repo: https://github.com/claudiojaviermeza-creator/casa-al-metro
- GitHub Pages: https://claudiojaviermeza-creator.github.io/casa-al-metro/

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
2. Actualiza proyectos desde [Subsidios.cl](https://www.subsidios.cl/proyectos)
3. Hace commit del catálogo si cambió
4. Rebuild + deploy a la rama `gh-pages`

También puedes lanzarlo a mano en GitHub → **Actions → Daily catalog update → Run workflow**.

### Activar por primera vez (importante)

El login actual de GitHub CLI no tiene permiso `workflow`, así que el archivo del cron está en:

`scripts/github-daily-update.yml`

Haz esto **una sola vez**:

1. Abre: https://github.com/claudiojaviermeza-creator/casa-al-metro/new/main?filename=.github/workflows/daily-update.yml
2. Copia y pega el contenido de `scripts/github-daily-update.yml`
3. Commit en `main`
4. Ve a **Actions** y verifica que aparece **Daily catalog update (04:00 Chile)**
5. Opcional: **Run workflow** para probarlo ahora

También: **Settings → Actions → General → Allow all actions**, y Pages en rama `gh-pages`.

### Probar en local

```bash
npm run update:catalog
```

## Publicar en GitHub Pages (manual)

```bash
VITE_BASE=/casa-al-metro/ npm run build
# subir contenido de dist/ a la rama gh-pages
```

## Aviso

Precios, cupos de subsidio y tipologías cambian. Confirma siempre en el portal de origen y en sala de ventas / SERVIU.
