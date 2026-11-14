/// <reference types="vitest/config" />
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin, type UserConfig } from 'vite'

/** Pictures (the town's WebP atlases): same pattern as ART_FILE_RE in public/sw.js. */
const ART_FILE_RE = /\.(?:webp|png|jpe?g|avif|gif)$/i

/**
 * Stamps public/sw.js (copied to the build output) with every emitted /assets/ file and a build id.
 * The app is code-split, so index.html only names the entry chunk; the service worker needs the full
 * list to precache the lazy page chunks for offline use. Pictures are listed apart (`art`): several MB that most
 * visits never draw, so the worker stores them on first use instead of at install. See the header of public/sw.js.
 */
function swBuildManifest(): Plugin {
  let outDir = 'dist'
  let assets: string[] = []
  let art: string[] = []
  return {
    name: 'nna-sw-build-manifest',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir)
    },
    generateBundle(_options, bundle) {
      const all = Object.keys(bundle)
        .filter((f) => f.startsWith('assets/') && !f.endsWith('.map'))
        .sort()
      assets = all.filter((f) => !ART_FILE_RE.test(f))
      art = all.filter((f) => ART_FILE_RE.test(f))
    },
    async writeBundle() {
      const file = resolve(outDir, 'sw.js')
      const src = await readFile(file, 'utf8')
      const re = /\/\/ @build-manifest-start[^\n]*\n[\s\S]*?\/\/ @build-manifest-end/
      if (!re.test(src)) this.error('public/sw.js: build-manifest markers not found')
      // the id names the precache: pictures do not live there, so a change of pictures alone keeps it
      const id = createHash('sha256').update(assets.join('\n')).digest('hex').slice(0, 10)
      const stamped = `// @build-manifest-start (stamped by vite.config.ts)\nconst BUILD = ${JSON.stringify({ id, assets, art })};\n// @build-manifest-end`
      await writeFile(file, src.replace(re, stamped))
    },
  }
}

/** Intermediate output of `vite build --mode portable`; scripts/build-portable.mjs (same path there) inlines it into one HTML file. */
const PORTABLE_BUILD_DIR = 'node_modules/.portable-build'

/**
 * Portable mode: the town's pictures (several MB of WebP) are NOT inlined. They stay files, which
 * scripts/build-portable.mjs copies to "<out>/art/" next to the HTML, and the code names them "./art/<file>": an
 * <img> (unlike fetch or a module import) loads a sibling file on file://. Keep in sync with build-portable.mjs.
 */
const PORTABLE_ART_DIR = 'art'

/**
 * Portable mode (`npm run portable`): one JS bundle + one CSS file, no public/ copy, no service worker.
 * Chrome/Edge refuse module scripts and dynamic import() of sibling files on file:// (null origin),
 * so every lazy page must land in the entry chunk and scripts/build-portable.mjs then inlines it all
 * (every asset as a data: URI, except the town's pictures: PORTABLE_ART_DIR).
 */
const portableBuild: UserConfig['build'] = {
  outDir: PORTABLE_BUILD_DIR,
  emptyOutDir: true,
  copyPublicDir: false,
  cssCodeSplit: false,
  modulePreload: false,
  assetsInlineLimit: (file) => !ART_FILE_RE.test(file),
  chunkSizeWarningLimit: 4096, // one ~2 MB bundle is the point of this build (the town's pictures are files)
  rolldownOptions: {
    output: { codeSplitting: false },
  },
}

/**
 * Web build: React and the built-in course content get their own chunks. A deploy usually changes app code only,
 * so a returning learner re-downloads just that chunk (the hashed react / content files stay the same). Only
 * content the entry chunk already needs is grouped, so nothing extra is downloaded up front.
 */
const webBuild: UserConfig['build'] = {
  rolldownOptions: {
    output: {
      codeSplitting: {
        groups: [
          { name: 'react', test: /node_modules[/\\](react|react-dom|scheduler)[/\\]/ },
          { name: 'content', test: /src[/\\]data[/\\](courses[/\\]|lessons|sentences|chunks|realClips)/ },
        ],
      },
    },
  },
}

export default defineConfig(({ mode }) => {
  const portable = mode === 'portable'
  return {
    base: portable ? './' : '/',
    plugins: portable ? [react()] : [react(), swBuildManifest()],
    build: portable ? portableBuild : webBuild,
    experimental: portable
      ? { renderBuiltUrl: (file: string, { type }: { type: 'asset' | 'public' }) => (type === 'asset' && ART_FILE_RE.test(file) ? `./${PORTABLE_ART_DIR}/${basename(file)}` : undefined) }
      : undefined,
    test: {
      include: ['src/**/*.test.ts'],
      environment: 'node',
    },
  }
})
