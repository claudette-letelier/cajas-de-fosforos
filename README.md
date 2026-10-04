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

### Activar por primera vez

1. En el repo: **Settings → Actions → General → Allow all actions**
2. **Settings → Pages** debe seguir apuntando a la rama `gh-pages`
3. Si GitHub rechaza subir el archivo `.github/workflows/...` desde tu PC (falta scope `workflow`), créalo en la web de GitHub o usa un PAT con scope `workflow`

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
