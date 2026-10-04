#!/usr/bin/env node
import { catalog } from '../src/data/catalog.js'
import { validateCatalog } from '../src/lib/catalog-schema.js'

const result = validateCatalog(catalog)
console.log(JSON.stringify(result.stats, null, 2))
if (!result.ok) {
  console.error(`\n${result.errors.length} error(es) de validación:`)
  for (const e of result.errors.slice(0, 40)) console.error(' -', e)
  if (result.errors.length > 40) {
    console.error(` … y ${result.errors.length - 40} más`)
  }
  process.exit(1)
}
console.log('Catálogo OK')
