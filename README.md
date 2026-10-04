# Casa al Metro

App estática en **JavaScript** (Vite + React) para investigar departamentos con subsidio **DS19** en Santiago, cerca del metro. **Sin base de datos.**

## Sitio publicado

- Repo: https://github.com/claudiojaviermeza-creator/casa-al-metro
- GitHub Pages: https://claudiojaviermeza-creator.github.io/casa-al-metro/

## Correr en local

```bash
npm install
npm run dev
```

Abre http://127.0.0.1:43127

## Cómo se publica

El sitio se genera con `npm run build` (`VITE_BASE=/casa-al-metro/`) y se publica en la rama **`gh-pages`**.

GitHub Pages está configurado con:

- Source: Deploy from a branch
- Branch: `gh-pages` / `/` (root)

Para republicar después de cambios:

```bash
VITE_BASE=/casa-al-metro/ npm run build
# subir el contenido de dist/ a la rama gh-pages
```

## Stack

- JavaScript (sin TypeScript)
- Vite + React
- Tailwind CSS
- Datos locales en `src/data/` (sin backend ni base de datos)
