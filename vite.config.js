import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// For GitHub Pages project sites: https://USER.github.io/REPO/
// Override with VITE_BASE=/repo-name/ when deploying.
const base = process.env.VITE_BASE || '/'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base,
})
