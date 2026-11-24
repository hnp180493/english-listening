/// <reference types="vitest/config" />
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin, type UserConfig } from 'vite'

/**
 * Stamps public/sw.js (copied to the build output) with every emitted /assets/ file and a build id.
 * The app is code-split, so index.html only names the entry chunk; the service worker needs the full
 * list to precache the lazy page chunks for offline use. The three.js chunk (only the town page needs
 * it, about 580 kB) is listed apart as `lazy`: cached on first use, not downloaded at install for
 * every visitor. See the header of public/sw.js.
 */
function swBuildManifest(): Plugin {
  let outDir = 'dist'
  let assets: string[] = []
  let lazy: string[] = []
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
      lazy = all.filter((f) => {
        const out = bundle[f]
        return out.type === 'chunk' && out.name === 'three'
      })
      assets = all.filter((f) => !lazy.includes(f))
    },
    async writeBundle() {
      const file = resolve(outDir, 'sw.js')
      const src = await readFile(file, 'utf8')
      const re = /\/\/ @build-manifest-start[^\n]*\n[\s\S]*?\/\/ @build-manifest-end/
      if (!re.test(src)) this.error('public/sw.js: build-manifest markers not found')
      const id = createHash('sha256').update([...assets, ...lazy].join('\n')).digest('hex').slice(0, 10)
      const stamped = `// @build-manifest-start (stamped by vite.config.ts)\nconst BUILD = ${JSON.stringify({ id, assets, lazy })};\n// @build-manifest-end`
      await writeFile(file, src.replace(re, stamped))
    },
  }
}

/** Vite's usual warning for a chunk over this size (kB, minified). */
const CHUNK_WARN_KB = 500

/**
 * The size warning for every chunk except three.js: three (the 3D town) is one file of about 580 kB, loaded only
 * by the town page and unchanged between deploys, so the web build raises Vite's own limit just above it
 * (chunkSizeWarningLimit) and this check keeps the usual 500 kB for every other chunk.
 */
function chunkSizeGuard(): Plugin {
  return {
    name: 'nna-chunk-size-guard',
    apply: 'build',
    generateBundle(_options, bundle) {
      for (const [file, out] of Object.entries(bundle)) {
        if (out.type !== 'chunk' || out.name === 'three') continue
        const kb = Buffer.byteLength(out.code) / 1000
        if (kb > CHUNK_WARN_KB) this.warn(`${file} is ${kb.toFixed(0)} kB (over ${CHUNK_WARN_KB} kB): split it, or group it in vite.config.ts`)
      }
    },
  }
}

/** Intermediate output of `vite build --mode portable`; scripts/build-portable.mjs (same path there) inlines it into one HTML file. */
const PORTABLE_BUILD_DIR = 'node_modules/.portable-build'

/**
 * Portable mode (`npm run portable`): one JS bundle + one CSS file, no public/ copy, no service worker.
 * Chrome/Edge refuse module scripts and dynamic import() of sibling files on file:// (null origin),
 * so every lazy page must land in the entry chunk and scripts/build-portable.mjs then inlines it all
 * (every asset as a data: URI). three.js (the 3D town) is part of that one bundle.
 */
const portableBuild: UserConfig['build'] = {
  outDir: PORTABLE_BUILD_DIR,
  emptyOutDir: true,
  copyPublicDir: false,
  cssCodeSplit: false,
  modulePreload: false,
  assetsInlineLimit: () => true,
  chunkSizeWarningLimit: 4096, // one ~3 MB bundle (three.js included) is the point of this build
  rolldownOptions: {
    output: { codeSplitting: false },
  },
}

/**
 * Web build: React and the built-in course content get their own chunks. A deploy usually changes app code only,
 * so a returning learner re-downloads just that chunk (the hashed react / content files stay the same). Only
 * content the entry chunk already needs is grouped, so nothing extra is downloaded up front.
 * three.js (the 3D town) gets its own chunk too, loaded only with the town page (nothing else imports it): it does
 * not change between deploys, and the rest of the app never downloads it (the service worker caches it on first
 * use, not at install: swBuildManifest lists it as `lazy`).
 */
const webBuild: UserConfig['build'] = {
  // only three.js is over the usual 500 kB; chunkSizeGuard keeps that limit for every other chunk
  chunkSizeWarningLimit: 640,
  rolldownOptions: {
    output: {
      codeSplitting: {
        groups: [
          { name: 'react', test: /node_modules[/\\](react|react-dom|scheduler)[/\\]/ },
          // the town's episodes and the residents' arcs (data/stories, "Thân thiết"): over 200 kB of their own
          { name: 'stories', test: /src[/\\]data[/\\](townStories|townGifts|stories[/\\])/ },
          // the text scenes of courtship, marriage and children (data/romance, docs/town.md §15) and the street meetings
          { name: 'romance', test: /src[/\\]data[/\\](romance[/\\]|streetTalks[/\\]|townStreet|townCafe)/ },
          { name: 'content', test: /src[/\\]data[/\\](courses[/\\]|lessons|sentences|chunks|realClips)/ },
          { name: 'three', test: /node_modules[/\\]three[/\\]/ },
        ],
      },
    },
  },
}

export default defineConfig(({ mode }) => {
  const portable = mode === 'portable'
  return {
    base: portable ? './' : '/',
    plugins: portable ? [react()] : [react(), swBuildManifest(), chunkSizeGuard()],
    build: portable ? portableBuild : webBuild,
    test: {
      include: ['src/**/*.test.ts'],
      environment: 'node',
    },
  }
})
