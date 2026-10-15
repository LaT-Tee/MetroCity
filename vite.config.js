import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { gameScope } from './scripts/game-scope.js'

// `npm run build` → dist/index.html: one self-contained, minified file (scripts and styles inlined)
export default defineConfig({
  plugins: [gameScope(), viteSingleFile()],
  build: {
    target: 'es2022',
    cssCodeSplit: false,
    assetsInlineLimit: Infinity,
    reportCompressedSize: true,
  },
})
