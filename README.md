# Casa al Metro

App estática en **JavaScript** (Vite + React) para investigar departamentos con subsidio **DS19** en Santiago, cerca del metro. **Sin base de datos.**

## Correr en local

```bash
npm install
npm run dev
```

Abre http://127.0.0.1:43127

## Publicar en GitHub Pages

1. Crea un repositorio vacío en tu cuenta de GitHub (ej. `casa-al-metro`).
2. Sube este código a la rama `main`.
3. En el repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
4. El workflow `.github/workflows/deploy-pages.yml` construye el sitio estático y lo publica.
5. La URL quedará como: `https://TU_USUARIO.github.io/casa-al-metro/`

El build usa `VITE_BASE=/nombre-del-repo/` automáticamente en Actions.

### Subir desde tu máquina

```bash
git remote add github https://github.com/TU_USUARIO/casa-al-metro.git
git push -u github main
```

## Stack

- JavaScript (sin TypeScript)
- Vite + React
- Tailwind CSS
- Datos locales en `src/data/` (sin backend ni base de datos)
