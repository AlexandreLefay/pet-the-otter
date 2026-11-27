import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// `npm run build:single` produit un seul fichier HTML (pratique pour partager / publier).
// base relative : le build marche aussi bien à la racine d'un domaine que sous
// alexandrelefay.github.io/pet-the-otter/ (GitHub Pages).
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [react(), ...(mode === 'single' ? [viteSingleFile()] : [])],
}))
