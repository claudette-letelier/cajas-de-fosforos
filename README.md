# Cajas de Fósforos

Iniciativa **sin fines de lucro** para ayudar a encontrar vivienda en Chile:
juntamos avisos públicos, mostramos lo que hay y marcamos lo que conviene
confirmar (precio “desde”, cupos, metro, entrega).

No somos inmobiliaria ni reemplazamos la postulación oficial (SERVIU / sala de
ventas).

## Sitio

- https://claudette-letelier.github.io/cajas-de-fosforos/

## Cómo correrlo en tu computador

```bash
npm install
npm run dev
```

## Actualizar el listado de proyectos

```bash
npm run update:catalog
```

## Tests y validación del scrape

Usamos el runner nativo de Node (`node --test`), sin Jest/Vitest extra.

```bash
# Unit tests (extractores HTML + esquema del catálogo)
npm test

# Valida el catálogo generado (coords, regiones, ids, etc.)
npm run validate:catalog
```

Qué cubren hoy:

- **Extractores** (`scripts/lib/html-location.mjs`): lat/lng y dirección de fichas Subsidios.cl (fixtures).
- **Esquema** (`src/lib/catalog-schema.js`): cada proyecto del `catalog.js` (precios, región, coords Chile, sin metro falso fuera de RM, etc.).
- **Casos reales**: Lomas de Landa / Fuentes de San Pedro con dirección exacta.

Conviene correr `npm test` y `npm run validate:catalog` después de `npm run update:catalog`.

Si quieres el refresco automático diario en GitHub, copia
`scripts/github-daily-update.yml` a `.github/workflows/daily-update.yml`
(desde la web de GitHub o con un token que permita workflows) y actívalo en
Actions. Ese archivo ya incluye las acciones `checkout` y `setup-node` en v7.

## Visitas (GoatCounter)

El sitio usa **GoatCounter hosted** (el servicio gratis de ellos), no self-hosted.

1. Crea una cuenta en https://www.goatcounter.com  
2. Código del sitio: `claudette` (debe coincidir con el script en `index.html`)  
3. Panel: https://claudette.goatcounter.com  

Hasta que no crees ese sitio en GoatCounter, el contador no guarda visitas.

### ¿Qué es self-hosted?

- **Hosted (lo que usamos):** GoatCounter corre en sus servidores. Tú solo pones el script y miras el panel web. Cero servidor propio.
- **Self-hosted:** instalas GoatCounter en **tu** VPS/servidor (Docker o binario + base de datos). Tú pagas/mantienes la máquina, backups y actualizaciones; a cambio los datos no pasan por goatcounter.com.

Para este proyecto el hosted gratis alcanza. Self-hosted solo tiene sentido si quieres control total de los datos o no depender de un tercero.

## Aviso

Precios, cupos de subsidio y tipologías cambian. Confirma siempre en el aviso
original y en sala de ventas / SERVIU.
