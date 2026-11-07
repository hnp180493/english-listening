/// <reference types="vitest/config" />
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin, type UserConfig } from 'vite'

/**
 * Stamps public/sw.js (copied to the build output) with every emitted /assets/ file and a build id.
 * The app is code-split, so index.html only names the entry chunk; the service worker needs the full
 * list to precache the lazy page chunks for offline use. See the header of public/sw.js.
 */
function swBuildManifest(): Plugin {
  let outDir = 'dist'
  let assets: string[] = []
  return {
    name: 'nna-sw-build-manifest',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir)
    },
    generateBundle(_options, bundle) {
      assets = Object.keys(bundle)
        .filter((f) => f.startsWith('assets/') && !f.endsWith('.map'))
        .sort()
    },
    async writeBundle() {
      const file = resolve(outDir, 'sw.js')
      const src = await readFile(file, 'utf8')
      const re = /\/\/ @build-manifest-start[^\n]*\n[\s\S]*?\/\/ @build-manifest-end/
      if (!re.test(src)) this.error('public/sw.js: build-manifest markers not found')
      const id = createHash('sha256').update(assets.join('\n')).digest('hex').slice(0, 10)
      const stamped = `// @build-manifest-start (stamped by vite.config.ts)\nconst BUILD = ${JSON.stringify({ id, assets })};\n// @build-manifest-end`
      await writeFile(file, src.replace(re, stamped))
    },
  }
}

/** Intermediate output of `vite build --mode portable`; scripts/build-portable.mjs (same path there) inlines it into one HTML file. */
const PORTABLE_BUILD_DIR = 'node_modules/.portable-build'

/**
 * Portable mode (`npm run portable`): one JS bundle + one CSS file, no public/ copy, no service worker.
 * Chrome/Edge refuse module scripts and dynamic import() of sibling files on file:// (null origin),
 * so every lazy page must land in the entry chunk and scripts/build-portable.mjs then inlines it all.
 */
const portableBuild: UserConfig['build'] = {
  outDir: PORTABLE_BUILD_DIR,
  emptyOutDir: true,
  copyPublicDir: false,
  cssCodeSplit: false,
  modulePreload: false,
  assetsInlineLimit: Number.MAX_SAFE_INTEGER,
  chunkSizeWarningLimit: 4096, // one ~1 MB bundle is the point of this build
  rolldownOptions: {
    output: { codeSplitting: false },
  },
}

export default defineConfig(({ mode }) => {
  const portable = mode === 'portable'
  return {
    base: portable ? './' : '/',
    plugins: portable ? [react()] : [react(), swBuildManifest()],
    build: portable ? portableBuild : undefined,
    test: {
      include: ['src/**/*.test.ts'],
      environment: 'node',
    },
  }
})
