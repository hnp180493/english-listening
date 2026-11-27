/// <reference types="vitest/config" />
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin, type UserConfig } from 'vite'

/**
 * Stamps public/sw.js (copied to the build output) with every emitted /assets/ file and a build id.
 * The app is code-split, so index.html only names the entry chunk; the service worker needs the full
 * list to precache the lazy page chunks for offline use. The three.js chunk (only the town page needs
 * it, about 580 kB) is listed apart as `lazy`: cached on first use, not downloaded at install for
 * every visitor; so are the English dictionaries (`en-*`: only English mode loads them). See the header of public/sw.js.
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
        return out.type === 'chunk' && (out.name === 'three' || out.name.startsWith('en-'))
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
          { name: 'romance', test: /src[/\\]data[/\\](romance[/\\]|streetTalks[/\\]|cases[/\\]|townStreet|townCafe|townDeliveries)/ },
          { name: 'content', test: /src[/\\]data[/\\](courses[/\\]|lessons|sentences|chunks|realClips)/ },
          // three.js, all but its glTF loader (that is the VRoid people's alone). First of the three: a group takes what
          // its modules import as well, and three's core must stay here, not go with the loader
          { name: 'three', test: /node_modules[/\\]three[/\\](?!examples[/\\]jsm[/\\]loaders[/\\]GLTFLoader)/, priority: 3 },
          // the VRoid people (features/town/three/chars/vrmBody.ts: three-vrm and the glTF loader), loaded only when a
          // resident with an avatar is on the stage and the learner wants avatars
          { name: 'vrm', test: /node_modules[/\\](@pixiv[/\\]three-vrm|three[/\\]examples[/\\]jsm[/\\]loaders[/\\]GLTFLoader)|src[/\\]features[/\\]town[/\\]three[/\\]chars[/\\]vrmBody/, priority: 2 },
          // the town's people (bodies, faces, hair, portraits; three/chars): code-built, loaded with the town page
          { name: 'town-people', test: /src[/\\]features[/\\]town[/\\]three[/\\]chars[/\\]/, priority: 1 },        // the English dictionaries (src/i18n/en, docs/i18n.md): one chunk per bundle, loaded only in English mode
          { name: 'en-ui', test: /src[/\\]i18n[/\\]en[/\\]ui/ },
          { name: 'en-content', test: /src[/\\]i18n[/\\]en[/\\]content/ },
          { name: 'en-town', test: /src[/\\]i18n[/\\]en[/\\]town/ },
          // the meanings of the English lines (docs/i18n.md §4): too big for one chunk, split by kind; the city's load with Westbay
          { name: 'en-town-arcs', test: /src[/\\]i18n[/\\]en[/\\]town[/\\]arc-[a-z]+-meaning/, priority: 1 },
          { name: 'en-town-romance', test: /src[/\\]i18n[/\\]en[/\\]town[/\\]romance-[a-z]+-meaning/, priority: 1 },
          { name: 'en-town-talk', test: /src[/\\]i18n[/\\]en[/\\]town[/\\](?!arc-|romance-)[a-z-]+-meaning/, priority: 1 },
          { name: 'en-city-jobs', test: /src[/\\]i18n[/\\]en[/\\]city[/\\]jobs/, priority: 1 },
          { name: 'en-city-seasons', test: /src[/\\]i18n[/\\]en[/\\]city[/\\]seasons/, priority: 1 },
          { name: 'en-city-talks', test: /src[/\\]i18n[/\\]en[/\\]city[/\\]talks/, priority: 1 },
          { name: 'en-city', test: /src[/\\]i18n[/\\]en[/\\]city/ },
        ],
      },
    },
  },
}

/**
 * The app's JSX runs through src/i18n/jsx-runtime.ts (React's runtime plus the English-mode translation of an
 * element's text, docs/i18n.md): every import of React's JSX runtime from the app's own files resolves to the
 * wrapper, which itself imports the real one. Packages in node_modules keep React's. Done by a resolver, not by
 * jsxImportSource: Vite pre-bundles a jsxImportSource as a dependency, which would give the wrapper a second copy
 * of the language state.
 */
function i18nJsx(): Plugin {
  const slashes = (p: string) => p.split(sep).join('/')
  const dir = slashes(fileURLToPath(new URL('./src/i18n/', import.meta.url)))
  const wrappers: Record<string, string> = {
    'react/jsx-runtime': `${dir}jsx-runtime.ts`,
    'react/jsx-dev-runtime': `${dir}jsx-dev-runtime.ts`,
  }
  return {
    name: 'nna-i18n-jsx',
    enforce: 'pre',
    resolveId(source, importer) {
      const wrapper = wrappers[source]
      if (!wrapper || !importer) return null
      const from = slashes(importer)
      if (from.includes('/node_modules/') || from.startsWith(`${dir}jsx-`)) return null
      return wrapper
    },
  }
}

export default defineConfig(({ mode }) => {
  const portable = mode === 'portable'
  return {
    base: portable ? './' : '/',
    plugins: portable ? [i18nJsx(), react()] : [i18nJsx(), react(), swBuildManifest(), chunkSizeGuard()],
    build: portable ? portableBuild : webBuild,
    test: {
      include: ['src/**/*.test.ts'],
      environment: 'node',
    },
  }
})
