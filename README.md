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

## Actualizar catálogo

Los datos viven en `src/data/catalog.js` (curados desde fichas públicas). Los portales origen suelen bloquear scraping automático; por eso el catálogo se mantiene como JSON/JS estático con enlace a la ficha original.

## Publicar en GitHub Pages

```bash
VITE_BASE=/casa-al-metro/ npm run build
# subir contenido de dist/ a la rama gh-pages
```

## Aviso

Precios, cupos de subsidio y tipologías cambian. Confirma siempre en el portal de origen y en sala de ventas / SERVIU.
